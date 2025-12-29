#!/usr/bin/env node

/**
 * Script to create dummy payment data against existing bookings
 */

const postgres = require('postgres');
require('dotenv').config();

// Create database connection
const sql = postgres(process.env.DATABASE_URL);

async function createDummyPaymentData() {
  try {
    console.log('🔍 Creating dummy payment data for existing bookings...\n');

    // First, check existing bookings
    const bookings = await sql`
      SELECT 
        id, 
        user_id, 
        car_id, 
        status, 
        advance_amount, 
        remaining_amount, 
        total_price,
        advance_payment_id,
        final_payment_id,
        late_fees_payment_id,
        created_at
      FROM bookings
      ORDER BY id ASC
    `;

    console.log(`📊 Found ${bookings.length} existing bookings\n`);

    if (bookings.length === 0) {
      console.log('❌ No bookings found. Please create some bookings first.');
      return;
    }

    let paymentsCreated = 0;
    let bookingsUpdated = 0;

    for (const booking of bookings) {
      console.log(`Processing booking ${booking.id}...`);

      // Create advance payment if not exists
      if (!booking.advance_payment_id && booking.advance_amount > 0) {
        const advancePayment = await sql`
          INSERT INTO payments (
            payment_id,
            reference_id,
            type,
            status,
            method,
            amount,
            net_amount,
            user_id,
            booking_id,
            completed_at,
            created_at,
            updated_at
          ) VALUES (
            ${`adv_${Date.now()}_${booking.id}`},
            ${`ref_adv_${Date.now()}_${booking.id}`},
            'advance',
            'completed',
            'razorpay',
            ${booking.advance_amount},
            ${booking.advance_amount},
            ${booking.user_id},
            ${booking.id},
            ${new Date()},
            ${new Date()},
            ${new Date()}
          )
          RETURNING id
        `;

        // Update booking with advance payment ID
        await sql`
          UPDATE bookings 
          SET 
            advance_payment_id = ${advancePayment[0].id},
            status = CASE 
              WHEN status = 'pending' THEN 'advance_paid'
              ELSE status 
            END,
            updated_at = ${new Date()}
          WHERE id = ${booking.id}
        `;

        console.log(`  ✅ Created advance payment: ${advancePayment[0].id}`);
        paymentsCreated++;
        bookingsUpdated++;
      }

      // Create final payment if not exists and booking is confirmed/active
      if (!booking.final_payment_id && booking.remaining_amount > 0 && 
          (booking.status === 'confirmed' || booking.status === 'active' || booking.status === 'completed')) {
        const finalPayment = await sql`
          INSERT INTO payments (
            payment_id,
            reference_id,
            type,
            status,
            method,
            amount,
            net_amount,
            user_id,
            booking_id,
            completed_at,
            created_at,
            updated_at
          ) VALUES (
            ${`fin_${Date.now()}_${booking.id}`},
            ${`ref_fin_${Date.now()}_${booking.id}`},
            'final',
            'completed',
            'razorpay',
            ${booking.remaining_amount},
            ${booking.remaining_amount},
            ${booking.user_id},
            ${booking.id},
            ${new Date()},
            ${new Date()},
            ${new Date()}
          )
          RETURNING id
        `;

        // Update booking with final payment ID
        await sql`
          UPDATE bookings 
          SET 
            final_payment_id = ${finalPayment[0].id},
            status = CASE 
              WHEN status = 'advance_paid' THEN 'confirmed'
              WHEN status = 'pending' THEN 'confirmed'
              ELSE status 
            END,
            updated_at = ${new Date()}
          WHERE id = ${booking.id}
        `;

        console.log(`  ✅ Created final payment: ${finalPayment[0].id}`);
        paymentsCreated++;
        bookingsUpdated++;
      }

      // Create late fees payment for some bookings (randomly)
      if (!booking.late_fees_payment_id && Math.random() > 0.7) {
        const lateFeesAmount = Math.floor(Math.random() * 500) + 100; // Random amount between 100-600
        
        const lateFeesPayment = await sql`
          INSERT INTO payments (
            payment_id,
            reference_id,
            type,
            status,
            method,
            amount,
            net_amount,
            user_id,
            booking_id,
            completed_at,
            created_at,
            updated_at
          ) VALUES (
            ${`late_${Date.now()}_${booking.id}`},
            ${`ref_late_${Date.now()}_${booking.id}`},
            'late_fees',
            'completed',
            'razorpay',
            ${lateFeesAmount},
            ${lateFeesAmount},
            ${booking.user_id},
            ${booking.id},
            ${new Date()},
            ${new Date()},
            ${new Date()}
          )
          RETURNING id
        `;

        // Update booking with late fees payment ID
        await sql`
          UPDATE bookings 
          SET 
            late_fees_payment_id = ${lateFeesPayment[0].id},
            updated_at = ${new Date()}
          WHERE id = ${booking.id}
        `;

        console.log(`  ✅ Created late fees payment: ${lateFeesPayment[0].id} (₹${lateFeesAmount})`);
        paymentsCreated++;
        bookingsUpdated++;
      }
    }

    // Create payment summaries for users
    console.log('\n📊 Creating payment summaries...');
    
    const usersWithPayments = await sql`
      SELECT DISTINCT user_id 
      FROM payments 
      WHERE user_id IS NOT NULL
    `;

    for (const user of usersWithPayments) {
      const userPayments = await sql`
        SELECT 
          COUNT(*) as total_payments,
          SUM(amount) as total_amount,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_amount,
          SUM(CASE WHEN type = 'advance' THEN amount ELSE 0 END) as advance_amount,
          SUM(CASE WHEN type = 'final' THEN amount ELSE 0 END) as final_amount,
          SUM(CASE WHEN type = 'late_fees' THEN amount ELSE 0 END) as late_fees_amount
        FROM payments 
        WHERE user_id = ${user.user_id}
      `;

      const summary = userPayments[0];

      // Insert payment summary (check if exists first)
      const existingSummary = await sql`
        SELECT id FROM payment_summary WHERE user_id = ${user.user_id}
      `;

      if (existingSummary.length === 0) {
        await sql`
          INSERT INTO payment_summary (
            user_id,
            total_payments,
            successful_payments,
            failed_payments,
            total_paid,
            net_amount,
            last_payment_at,
            last_payment_amount,
            last_payment_status,
            created_at,
            updated_at
          ) VALUES (
            ${user.user_id},
            ${summary.total_payments},
            ${summary.completed_amount},
            ${summary.total_payments - summary.completed_amount},
            ${summary.total_amount},
            ${summary.total_amount},
            ${new Date()},
            ${summary.total_amount},
            'completed',
            ${new Date()},
            ${new Date()}
          )
        `;
      } else {
        await sql`
          UPDATE payment_summary SET
            total_payments = ${summary.total_payments},
            successful_payments = ${summary.completed_amount},
            failed_payments = ${summary.total_payments - summary.completed_amount},
            total_paid = ${summary.total_amount},
            net_amount = ${summary.total_amount},
            last_payment_at = ${new Date()},
            last_payment_amount = ${summary.total_amount},
            last_payment_status = 'completed',
            updated_at = ${new Date()}
          WHERE user_id = ${user.user_id}
        `;
      }

      console.log(`  ✅ Created/updated payment summary for user ${user.user_id}`);
    }

    // Final statistics
    const finalPaymentsCount = await sql`SELECT COUNT(*) FROM payments`;
    const finalBookingsCount = await sql`SELECT COUNT(*) FROM bookings`;
    const finalSummaryCount = await sql`SELECT COUNT(*) FROM payment_summary`;

    console.log('\n🎉 Dummy payment data creation completed!');
    console.log(`📊 Statistics:`);
    console.log(`   - Payments created: ${paymentsCreated}`);
    console.log(`   - Bookings updated: ${bookingsUpdated}`);
    console.log(`   - Total payments in DB: ${finalPaymentsCount[0].count}`);
    console.log(`   - Total bookings in DB: ${finalBookingsCount[0].count}`);
    console.log(`   - Payment summaries: ${finalSummaryCount[0].count}`);

  } catch (error) {
    console.error('❌ Error creating dummy payment data:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

createDummyPaymentData();
