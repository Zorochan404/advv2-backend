#!/usr/bin/env node

/**
 * Script to check the current database structure and existing payment data
 */

const postgres = require('postgres');
require('dotenv').config();

// Create database connection
const sql = postgres(process.env.DATABASE_URL);

async function checkDatabaseStructure() {
  try {
    console.log('🔍 Checking database structure...\n');

    // Check if payments table exists
    try {
      const paymentsCount = await sql`SELECT COUNT(*) FROM payments`;
      console.log('✅ Payments table exists');
      console.log(`   Records: ${paymentsCount[0].count}`);
    } catch (error) {
      console.log('❌ Payments table does not exist');
    }

    // Check if payment_summary table exists
    try {
      const summaryCount = await sql`SELECT COUNT(*) FROM payment_summary`;
      console.log('✅ Payment summary table exists');
      console.log(`   Records: ${summaryCount[0].count}`);
    } catch (error) {
      console.log('❌ Payment summary table does not exist');
    }

    // Check current bookings table structure
    console.log('\n📋 Current bookings table structure:');
    const bookingsColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      ORDER BY ordinal_position
    `;
    
    console.log('Columns:');
    bookingsColumns.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });

    // Check for old payment fields
    const oldPaymentFields = bookingsColumns.filter(row => 
      row.column_name.includes('payment_status') || 
      row.column_name.includes('payment_reference') ||
      row.column_name.includes('late_fees_paid')
    );

    if (oldPaymentFields.length > 0) {
      console.log('\n⚠️  Old payment fields still exist:');
      oldPaymentFields.forEach(field => {
        console.log(`  - ${field.column_name}`);
      });
    } else {
      console.log('\n✅ No old payment fields found');
    }

    // Check for new payment fields
    const newPaymentFields = bookingsColumns.filter(row => 
      row.column_name.includes('payment_id')
    );

    if (newPaymentFields.length > 0) {
      console.log('\n✅ New payment fields found:');
      newPaymentFields.forEach(field => {
        console.log(`  - ${field.column_name}`);
      });
    } else {
      console.log('\n❌ New payment fields not found');
    }

    // Check existing bookings data
    console.log('\n📊 Existing bookings data:');
    const bookingsCount = await sql`SELECT COUNT(*) FROM bookings`;
    console.log(`   Total bookings: ${bookingsCount[0].count}`);

    if (parseInt(bookingsCount[0].count) > 0) {
      // Get sample booking data
      const sampleBookings = await sql`
        SELECT id, status, advance_payment_status, final_payment_status, 
               advance_payment_reference_id, final_payment_reference_id,
               advance_payment_id, final_payment_id, late_fees_payment_id
        FROM bookings 
        LIMIT 5
      `;
      
      console.log('\nSample booking data:');
      sampleBookings.forEach(booking => {
        console.log(`  Booking ${booking.id}:`);
        console.log(`    Status: ${booking.status}`);
        console.log(`    Old fields: adv_status=${booking.advance_payment_status}, fin_status=${booking.final_payment_status}`);
        console.log(`    New fields: adv_id=${booking.advance_payment_id}, fin_id=${booking.final_payment_id}, late_id=${booking.late_fees_payment_id}`);
      });
    }

    // Check payment enums
    console.log('\n🔧 Payment enums:');
    try {
      const paymentTypes = await sql`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_type')
      `;
      console.log('Payment types:', paymentTypes.map(r => r.enumlabel).join(', '));
    } catch (error) {
      console.log('❌ Payment type enum not found');
    }

    try {
      const paymentStatuses = await sql`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')
      `;
      console.log('Payment statuses:', paymentStatuses.map(r => r.enumlabel).join(', '));
    } catch (error) {
      console.log('❌ Payment status enum not found');
    }

  } catch (error) {
    console.error('❌ Error checking database structure:', error.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

checkDatabaseStructure();
