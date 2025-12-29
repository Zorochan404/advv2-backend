#!/usr/bin/env node

/**
 * Script to check current booking data
 */

const postgres = require('postgres');
require('dotenv').config();

// Create database connection
const sql = postgres(process.env.DATABASE_URL);

async function checkCurrentBookings() {
  try {
    console.log('🔍 Checking current booking data...\n');

    // Get all bookings
    const bookings = await sql`
      SELECT id, user_id, car_id, status, advance_payment_id, final_payment_id, 
             late_fees_payment_id, advance_amount, remaining_amount, total_price,
             created_at, updated_at
      FROM bookings 
      ORDER BY id
    `;

    console.log(`📊 Found ${bookings.length} bookings:`);
    
    bookings.forEach(booking => {
      console.log(`\nBooking ${booking.id}:`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  User ID: ${booking.user_id}`);
      console.log(`  Car ID: ${booking.car_id}`);
      console.log(`  Advance Payment ID: ${booking.advance_payment_id || 'null'}`);
      console.log(`  Final Payment ID: ${booking.final_payment_id || 'null'}`);
      console.log(`  Late Fees Payment ID: ${booking.late_fees_payment_id || 'null'}`);
      console.log(`  Amounts: adv=${booking.advance_amount}, rem=${booking.remaining_amount}, total=${booking.total_price}`);
      console.log(`  Created: ${booking.created_at}`);
    });

    // Check payments table
    const payments = await sql`SELECT COUNT(*) FROM payments`;
    console.log(`\n💰 Payments table has ${payments[0].count} records`);

    if (parseInt(payments[0].count) > 0) {
      const paymentDetails = await sql`
        SELECT id, payment_id, type, status, amount, user_id, booking_id, created_at
        FROM payments 
        ORDER BY id
      `;
      
      console.log('\nPayment records:');
      paymentDetails.forEach(payment => {
        console.log(`  Payment ${payment.id}: ${payment.type} - ${payment.status} - ₹${payment.amount} (Booking ${payment.booking_id})`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking bookings:', error.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

checkCurrentBookings();
