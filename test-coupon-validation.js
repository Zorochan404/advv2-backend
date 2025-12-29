const axios = require('axios');

const BASE_URL = 'http://localhost:5500'; // Adjust this to your server URL

async function testCouponValidation() {
  try {
    console.log('🧪 Testing Coupon Validation...\n');

    // Step 1: Test coupon validation endpoint
    console.log('1. Testing coupon validation endpoint...');
    const validationResponse = await axios.post(`${BASE_URL}/api/v1/coupons/validate`, {
      code: 'WELCOME10',
      bookingAmount: 3000
    });

    if (validationResponse.data.success) {
      console.log('✅ Coupon validation successful!');
      console.log('Coupon details:', validationResponse.data.data.coupon);
      console.log('Discount amount:', validationResponse.data.data.discountAmount);
      console.log('Final amount:', validationResponse.data.data.finalAmount);
    } else {
      console.log('❌ Coupon validation failed:', validationResponse.data.message);
    }

    console.log('\n2. Testing with invalid coupon code...');
    try {
      const invalidResponse = await axios.post(`${BASE_URL}/api/v1/coupons/validate`, {
        code: 'INVALID123',
        bookingAmount: 3000
      });
      console.log('❌ Should have failed but got:', invalidResponse.data);
    } catch (error) {
      if (error.response && error.response.data.success === false) {
        console.log('✅ Invalid coupon correctly rejected:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n3. Testing active coupons endpoint...');
    const activeCouponsResponse = await axios.get(`${BASE_URL}/api/v1/coupons/active`);
    
    if (activeCouponsResponse.data.success) {
      console.log('✅ Active coupons retrieved successfully!');
      console.log('Number of active coupons:', activeCouponsResponse.data.data.total);
      console.log('First coupon:', activeCouponsResponse.data.data.data[0]);
    } else {
      console.log('❌ Failed to get active coupons:', activeCouponsResponse.data.message);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testCouponValidation(); 