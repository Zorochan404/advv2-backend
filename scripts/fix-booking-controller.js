#!/usr/bin/env node

/**
 * Script to fix booking controller for new payment system
 */

const fs = require('fs');
const path = require('path');

const bookingControllerPath = path.join(__dirname, '../src/modules/booking/bookingcontroller.ts');

console.log('🔧 Fixing booking controller for new payment system...');

// Read the file
let content = fs.readFileSync(bookingControllerPath, 'utf8');

// Define replacements
const replacements = [
  // Add paymentsTable import
  {
    from: /import { paymentsTable } from "\.\.\/payment\/paymentmodel";/,
    to: 'import { paymentsTable } from "../payment/paymentmodel";'
  },
  
  // Fix advance payment logic
  {
    from: /if \(booking\.advancePaymentStatus === "paid"\) \{[\s\S]*?throw ApiError\.conflict\("Advance payment already confirmed"\);\s*\}/,
    to: `if (booking.advancePaymentId !== null) {
      throw ApiError.conflict("Advance payment already confirmed");
    }`
  },
  
  // Fix advance payment creation
  {
    from: /\/\/ Update booking status[\s\S]*?\.set\(\{[\s\S]*?advancePaymentStatus: "paid",[\s\S]*?advancePaymentReferenceId: paymentReferenceId,[\s\S]*?status: "advance_paid",[\s\S]*?otpCode: otpCode,[\s\S]*?otpExpiresAt: otpExpiresAt,[\s\S]*?otpVerified: false,[\s\S]*?\}\)/,
    to: `// Create payment record
    const payment = await db
      .insert(paymentsTable)
      .values({
        paymentId: \`adv_\${Date.now()}_\${bookingId}\`,
        referenceId: paymentReferenceId,
        type: "advance",
        status: "completed",
        method: "razorpay",
        amount: booking.advanceAmount,
        netAmount: booking.advanceAmount,
        userId: booking.userId,
        bookingId: bookingId,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Update booking status
    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        advancePaymentId: payment[0].id,
        status: "advance_paid",
        otpCode: otpCode,
        otpExpiresAt: otpExpiresAt,
        otpVerified: false,
      })`
  },
  
  // Fix final payment logic
  {
    from: /if \(booking\.finalPaymentStatus === "paid"\) \{[\s\S]*?throw ApiError\.conflict\("Final payment already confirmed"\);\s*\}/,
    to: `if (booking.finalPaymentId !== null) {
      throw ApiError.conflict("Final payment already confirmed");
    }`
  },
  
  // Fix final payment creation
  {
    from: /const updatedBooking = await db[\s\S]*?\.update\(bookingsTable\)[\s\S]*?\.set\(\{[\s\S]*?finalPaymentStatus: "paid",[\s\S]*?finalPaymentReferenceId: paymentReferenceId,[\s\S]*?status: "confirmed",[\s\S]*?\}\)/,
    to: `// Create payment record
    const payment = await db
      .insert(paymentsTable)
      .values({
        paymentId: \`fin_\${Date.now()}_\${bookingId}\`,
        referenceId: paymentReferenceId,
        type: "final",
        status: "completed",
        method: "razorpay",
        amount: booking.remainingAmount,
        netAmount: booking.remainingAmount,
        userId: booking.userId,
        bookingId: bookingId,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        finalPaymentId: payment[0].id,
        status: "confirmed",
      })`
  },
  
  // Fix payment status checks throughout the file
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
  
  // Fix queries that check payment status
  {
    from: /eq\(bookingsTable\.advancePaymentStatus, "paid"\)/g,
    to: 'isNotNull(bookingsTable.advancePaymentId)'
  },
  {
    from: /eq\(bookingsTable\.finalPaymentStatus, "paid"\)/g,
    to: 'isNotNull(bookingsTable.finalPaymentId)'
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
    console.log(`✅ Applied replacement: ${from.toString().substring(0, 50)}...`);
  }
});

// Write the updated file
fs.writeFileSync(bookingControllerPath, content);

console.log(`\n🎉 Applied ${changesCount} fixes to booking controller!`);
console.log('\n📝 Next steps:');
console.log('1. Test the server: pnpm dev');
console.log('2. Create migration script for existing payment data');
console.log('3. Run tests to verify everything works');
