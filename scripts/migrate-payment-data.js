#!/usr/bin/env node

/**
 * Script to migrate existing payment data from bookings table to payments table
 */

const postgres = require('postgres');
require('dotenv').config();

// Create database connection
const sql = postgres(process.env.DATABASE_URL);

async function migratePaymentData() {
  try {
    console.log('🔄 Starting payment data migration...\n');

    // Check if payments table exists
    try {
      await sql`SELECT 1 FROM payments LIMIT 1`;
      console.log('✅ Payments table exists');
    } catch (error) {
      console.log('❌ Payments table does not exist. Please run migrations first.');
      return;
    }

    // Get all bookings with payment data
    const bookings = await sql`
      SELECT id, user_id, advance_payment_status, final_payment_status, 
             advance_payment_reference_id, final_payment_reference_id,
             late_fees_paid, late_fees_payment_reference_id, late_fees_paid_at,
             advance_amount, remaining_amount, late_fees, total_price
      FROM bookings 
      WHERE advance_payment_status = 'paid' 
         OR final_payment_status = 'paid' 
         OR late_fees_paid = true
    `;

    console.log(`📊 Found ${bookings.length} bookings with payment data to migrate`);

    if (bookings.length === 0) {
      console.log('✅ No payment data to migrate');
      return;
    }

    let migratedCount = 0;

    for (const booking of bookings) {
      console.log(`\n🔄 Migrating booking ${booking.id}...`);

      // Migrate advance payment
      if (booking.advance_payment_status === 'paid' && booking.advance_payment_reference_id) {
        const advancePayment = await sql`
          INSERT INTO payments (
            payment_id, reference_id, type, status, method, amount, net_amount,
            user_id, booking_id, completed_at, created_at, updated_at
          ) VALUES (
            ${`adv_migrated_${booking.id}_${Date.now()}`},
            ${booking.advance_payment_reference_id},
            'advance',
            'completed',
            'razorpay',
            ${booking.advance_amount || 0},
            ${booking.advance_amount || 0},
            ${booking.user_id},
            ${booking.id},
            NOW(),
            NOW(),
            NOW()
          ) RETURNING id
        `;

        // Update booking with payment ID
        await sql`
          UPDATE bookings 
          SET advance_payment_id = ${advancePayment[0].id}
          WHERE id = ${booking.id}
        `;

        console.log(`  ✅ Migrated advance payment: ${advancePayment[0].id}`);
      }

      // Migrate final payment
      if (booking.final_payment_status === 'paid' && booking.final_payment_reference_id) {
        const finalPayment = await sql`
          INSERT INTO payments (
            payment_id, reference_id, type, status, method, amount, net_amount,
            user_id, booking_id, completed_at, created_at, updated_at
          ) VALUES (
            ${`fin_migrated_${booking.id}_${Date.now()}`},
            ${booking.final_payment_reference_id},
            'final',
            'completed',
            'razorpay',
            ${booking.remaining_amount || 0},
            ${booking.remaining_amount || 0},
            ${booking.user_id},
            ${booking.id},
            NOW(),
            NOW(),
            NOW()
          ) RETURNING id
        `;

        // Update booking with payment ID
        await sql`
          UPDATE bookings 
          SET final_payment_id = ${finalPayment[0].id}
          WHERE id = ${booking.id}
        `;

        console.log(`  ✅ Migrated final payment: ${finalPayment[0].id}`);
      }

      // Migrate late fees payment
      if (booking.late_fees_paid && booking.late_fees_payment_reference_id) {
        const lateFeesPayment = await sql`
          INSERT INTO payments (
            payment_id, reference_id, type, status, method, amount, net_amount,
            user_id, booking_id, completed_at, created_at, updated_at
          ) VALUES (
            ${`late_migrated_${booking.id}_${Date.now()}`},
            ${booking.late_fees_payment_reference_id},
            'late_fees',
            'completed',
            'razorpay',
            ${booking.late_fees || 0},
            ${booking.late_fees || 0},
            ${booking.user_id},
            ${booking.id},
            NOW(),
            NOW(),
            NOW()
          ) RETURNING id
        `;

        // Update booking with payment ID
        await sql`
          UPDATE bookings 
          SET late_fees_payment_id = ${lateFeesPayment[0].id}
          WHERE id = ${booking.id}
        `;

        console.log(`  ✅ Migrated late fees payment: ${lateFeesPayment[0].id}`);
      }

      migratedCount++;
    }

    console.log(`\n🎉 Successfully migrated ${migratedCount} bookings!`);
    console.log('\n📝 Next steps:');
    console.log('1. Verify the migration by checking the payments table');
    console.log('2. Test the booking system with the new payment structure');
    console.log('3. Remove old payment fields from bookings table (optional)');

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

migratePaymentData();
