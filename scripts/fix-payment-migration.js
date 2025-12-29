#!/usr/bin/env node

/**
 * Script to fix all payment-related references in booking controller
 * after migration to centralized payment system
 */

const fs = require('fs');
const path = require('path');

const bookingControllerPath = path.join(__dirname, '../src/modules/booking/bookingcontroller.ts');

console.log('🔧 Fixing payment migration issues in booking controller...');

// Read the file
let content = fs.readFileSync(bookingControllerPath, 'utf8');

// Define replacements
const replacements = [
  // Replace old payment status checks with new payment ID checks
  {
    from: /booking\.advancePaymentStatus === "paid"/g,
    to: 'booking.advancePaymentId !== null'
  },
  {
    from: /booking\.advancePaymentStatus !== "paid"/g,
    to: 'booking.advancePaymentId === null'
  },
  {
    from: /booking\.finalPaymentStatus === "paid"/g,
    to: 'booking.finalPaymentId !== null'
  },
  {
    from: /booking\.finalPaymentStatus !== "paid"/g,
    to: 'booking.finalPaymentId === null'
  },
  {
    from: /booking\.lateFeesPaid/g,
    to: 'booking.lateFeesPaymentId !== null'
  },
  
  // Replace old payment status fields in queries
  {
    from: /eq\(bookingsTable\.advancePaymentStatus, "paid"\)/g,
    to: 'isNotNull(bookingsTable.advancePaymentId)'
  },
  {
    from: /eq\(bookingsTable\.finalPaymentStatus, "paid"\)/g,
    to: 'isNotNull(bookingsTable.finalPaymentId)'
  },
  
  // Replace old payment status fields in select statements
  {
    from: /advancePaymentStatus: bookingsTable\.advancePaymentStatus,/g,
    to: 'advancePaymentId: bookingsTable.advancePaymentId,'
  },
  {
    from: /finalPaymentStatus: bookingsTable\.finalPaymentStatus,/g,
    to: 'finalPaymentId: bookingsTable.finalPaymentId,'
  },
  {
    from: /lateFeesPaid: bookingsTable\.lateFeesPaid,/g,
    to: 'lateFeesPaymentId: bookingsTable.lateFeesPaymentId,'
  },
  {
    from: /lateFeesPaymentReferenceId: bookingsTable\.lateFeesPaymentReferenceId,/g,
    to: '// lateFeesPaymentReferenceId: bookingsTable.lateFeesPaymentReferenceId, // Removed in migration'
  },
  {
    from: /lateFeesPaidAt: bookingsTable\.lateFeesPaidAt,/g,
    to: '// lateFeesPaidAt: bookingsTable.lateFeesPaidAt, // Removed in migration'
  },
  {
    from: /advancePaymentReferenceId: bookingsTable\.advancePaymentReferenceId,/g,
    to: '// advancePaymentReferenceId: bookingsTable.advancePaymentReferenceId, // Removed in migration'
  },
  {
    from: /finalPaymentReferenceId: bookingsTable\.finalPaymentReferenceId,/g,
    to: '// finalPaymentReferenceId: bookingsTable.finalPaymentReferenceId, // Removed in migration'
  },
  
  // Replace old payment status fields in update statements
  {
    from: /lateFeesPaid: true,/g,
    to: '// lateFeesPaid: true, // Use payments table instead'
  },
  {
    from: /lateFeesPaid: booking\.lateFeesPaid \|\| false,/g,
    to: 'lateFeesPaymentId: booking.lateFeesPaymentId,'
  },
  
  // Add isNotNull import
  {
    from: /import { eq, between, and, gte, lte, sql, inArray, desc } from "drizzle-orm";/,
    to: 'import { eq, between, and, gte, lte, sql, inArray, desc, isNotNull } from "drizzle-orm";'
  }
];

// Apply replacements
let changesCount = 0;
replacements.forEach(({ from, to }) => {
  const matches = content.match(from);
  if (matches) {
    content = content.replace(from, to);
    changesCount += matches.length;
    console.log(`✅ Replaced ${matches.length} instances of: ${from.toString()}`);
  }
});

// Write the updated file
fs.writeFileSync(bookingControllerPath, content);

console.log(`\n🎉 Fixed ${changesCount} payment migration issues!`);
console.log('\n📝 Next steps:');
console.log('1. Run: pnpm test tests/booking-e2e.test.ts');
console.log('2. Check for any remaining TypeScript errors');
console.log('3. Update queries to include proper relations (car, parking, coupon)');

console.log('\n⚠️  Note: Some queries may still need manual fixes for relations.');
console.log('   Look for queries that access booking.car, booking.pickupParking, etc.');
console.log('   These need to include proper "with" clauses in the query.');
