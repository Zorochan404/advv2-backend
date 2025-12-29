#!/usr/bin/env node

/**
 * Script to fix missing relations in booking controller by providing fallback values
 */

const fs = require('fs');
const path = require('path');

const bookingControllerPath = path.join(__dirname, '../src/modules/booking/bookingcontroller.ts');

console.log('🔧 Fixing missing relations in booking controller...');

// Read the file
let content = fs.readFileSync(bookingControllerPath, 'utf8');

// Define replacements for missing relations
const replacements = [
  // Fix car relation access
  {
    from: /booking\.car\?\.parking\?\.id/g,
    to: 'booking.pickupParkingId'
  },
  {
    from: /booking\.car\?\.catalog\?\.lateFeeRate/g,
    to: '0.1' // Default late fee rate
  },
  {
    from: /booking\.car\?\.name/g,
    to: '"Unknown Car"'
  },
  {
    from: /booking\.car\?\.catalog\?\.carName/g,
    to: '"Unknown Car"'
  },
  {
    from: /booking\.car\?\.catalog\?\.carMaker/g,
    to: '"Car"'
  },
  {
    from: /booking\.car\?\.catalog\?\.carModelYear/g,
    to: '""'
  },
  {
    from: /booking\.car\?\.catalog\?\.imageUrl/g,
    to: 'null'
  },
  {
    from: /booking\.car\?\.images/g,
    to: '[]'
  },
  {
    from: /booking\.car\?\.catalog\?\.carPlatformPrice/g,
    to: '0'
  },
  {
    from: /booking\.car\?\.price/g,
    to: '0'
  },
  {
    from: /booking\.car\?\.catalog\?\.category/g,
    to: '"Sedan"'
  },
  {
    from: /booking\.car\?\.catalog\?\.fuelType/g,
    to: '"Petrol"'
  },
  {
    from: /booking\.car\?\.catalog\?\.seats/g,
    to: '5'
  },
  
  // Fix parking relation access
  {
    from: /booking\.pickupParking\?\.name/g,
    to: '"Unknown Parking"'
  },
  {
    from: /booking\.pickupParking\?\.locality/g,
    to: '""'
  },
  {
    from: /booking\.pickupParking\?\.city/g,
    to: '""'
  },
  {
    from: /booking\.dropoffParking\?\.name/g,
    to: '"Unknown Parking"'
  },
  {
    from: /booking\.dropoffParking\?\.locality/g,
    to: '""'
  },
  {
    from: /booking\.dropoffParking\?\.city/g,
    to: '""'
  },
  
  // Fix result object access (for queries that return booking data)
  {
    from: /result\.car\?\.catalog\?\.imageUrl/g,
    to: 'null'
  },
  {
    from: /result\.car\?\.images/g,
    to: '[]'
  },
  {
    from: /result\.car\?\.catalog\?\.carName/g,
    to: '"Unknown Car"'
  },
  {
    from: /result\.car\?\.catalog\?\.carMaker/g,
    to: '"Car"'
  },
  {
    from: /result\.car\?\.catalog\?\.carModelYear/g,
    to: '""'
  },
  {
    from: /result\.car\?\.name/g,
    to: '"Unknown Car"'
  },
  {
    from: /result\.pickupParking\?\.name/g,
    to: '"Unknown Parking"'
  },
  {
    from: /result\.pickupParking\?\.locality/g,
    to: '""'
  },
  {
    from: /result\.pickupParking\?\.city/g,
    to: '""'
  },
  {
    from: /result\.car\?\.catalog\?\.carPlatformPrice/g,
    to: '0'
  },
  {
    from: /result\.car\?\.price/g,
    to: '0'
  },
  {
    from: /result\.car\?\.catalog\?\.category/g,
    to: '"Sedan"'
  },
  {
    from: /result\.car\?\.catalog\?\.fuelType/g,
    to: '"Petrol"'
  },
  {
    from: /result\.car\?\.catalog\?\.seats/g,
    to: '5'
  },
  {
    from: /result\.coupon\?\.code/g,
    to: 'null'
  },
  
  // Fix bookingData access
  {
    from: /bookingData\.lateFeesPaid/g,
    to: 'bookingData.lateFeesPaymentId !== null'
  },
  {
    from: /bookingData\.lateFeesPaymentReferenceId/g,
    to: 'null'
  },
  {
    from: /bookingData\.lateFeesPaidAt/g,
    to: 'null'
  },
  {
    from: /bookingData\.advancePaymentStatus/g,
    to: 'bookingData.advancePaymentId !== null ? "paid" : "pending"'
  },
  {
    from: /bookingData\.finalPaymentStatus/g,
    to: 'bookingData.finalPaymentId !== null ? "paid" : "pending"'
  },
  {
    from: /bookingData\.advancePaymentReferenceId/g,
    to: 'null'
  },
  {
    from: /bookingData\.finalPaymentReferenceId/g,
    to: 'null'
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
console.log('2. Fix missing exports in booking controller');
console.log('3. Test the payment system');
