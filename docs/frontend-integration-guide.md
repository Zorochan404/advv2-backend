# Frontend Integration Guide for Coupon and Insurance Features

## Overview
This guide explains how to integrate the newly added coupon and insurance features into the frontend application. The backend has been updated to support coupon application during booking creation and insurance amount calculation as part of the total price.

## API Changes

### 1. Booking Creation Endpoint
**Endpoint:** POST `/api/booking/create`

**New Request Parameters:**
- `couponCode` (optional): String - The coupon code to apply to the booking

**Example Request:**
```json
{
  "carId": 123,
  "startDate": "2025-08-15T10:00:00Z",
  "endDate": "2025-08-17T10:00:00Z",
  "deliveryCharges": 100,
  "couponCode": "SUMMER25"
}
```

### 2. Booking Response Format
All booking endpoints now include enhanced response data with:
- Coupon details (if a coupon was applied)
- Detailed billing breakdown

**Example Response:**
```json
{
  "id": 456,
  "carId": 123,
  "userId": 789,
  "startDate": "2025-08-15T10:00:00Z",
  "endDate": "2025-08-17T10:00:00Z",
  "status": "confirmed",
  "couponId": 42,
  "couponDetails": {
    "id": 42,
    "code": "SUMMER25",
    "discountAmount": 25,
    "discountType": "percentage",
    "minBookingAmount": 1000,
    "maxDiscountAmount": 500,
    "startDate": "2025-06-01T00:00:00Z",
    "endDate": "2025-08-31T23:59:59Z"
  },
  "billingBreakdown": {
    "basePrice": 2000,
    "insuranceAmount": 500,
    "deliveryCharges": 100,
    "discountAmount": 500,
    "totalBeforeDiscount": 2600,
    "totalPrice": 2100,
    "advanceAmount": 1050,
    "remainingAmount": 1050
  }
}
```

### 3. Coupon Seeding Endpoint
**Endpoint:** POST `/api/v1/coupons/seed`

**Access:** Admin only

**Description:** Seeds the database with predefined coupon data for testing or initial setup.

**Example Request:**
```bash
curl -X POST http://localhost:5500/api/v1/coupons/seed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Coupons seeded successfully",
  "data": {
    "coupons": [
      {
        "id": 1,
        "code": "WELCOME10",
        "name": "Welcome Discount",
        "description": "10% off on your first booking",
        "discountAmount": "10.00",
        "discountType": "percentage",
        "minBookingAmount": "1000.00",
        "maxDiscountAmount": "500.00",
        "startDate": "2025-08-10T08:06:33.952Z",
        "endDate": "2025-11-08T08:06:33.952Z",
        "status": "active",
        "usageLimit": 100,
        "usageCount": 0,
        "perUserLimit": 1,
        "isActive": true,
        "createdBy": 11,
        "createdAt": "2025-08-10T08:06:33.981Z",
        "updatedAt": "2025-08-10T08:06:33.981Z"
      },
      {
        "id": 2,
        "code": "SUMMER25",
        "name": "Summer Special",
        "description": "25% off on summer bookings",
        "discountAmount": "25.00",
        "discountType": "percentage",
        "minBookingAmount": "2000.00",
        "maxDiscountAmount": "1000.00",
        "startDate": "2025-08-10T08:06:33.952Z",
        "endDate": "2025-10-09T08:06:33.952Z",
        "status": "active",
        "usageLimit": 50,
        "usageCount": 0,
        "perUserLimit": 1,
        "isActive": true,
        "createdBy": 11,
        "createdAt": "2025-08-10T08:06:33.981Z",
        "updatedAt": "2025-08-10T08:06:33.981Z"
      }
      // Additional coupons omitted for brevity
    ],
    "count": 5
  },
  "statusCode": 201
}
```

### 4. Insurance Seeding Endpoint
**Endpoint:** POST `/api/v1/cars/seed-insurance`

**Access:** Admin only

**Description:** Seeds insurance amounts for cars that have null insurance values.

**Example Request:**
```bash
curl -X POST http://localhost:5500/api/v1/cars/seed-insurance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"defaultAmount": "750"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Insurance amounts seeded successfully",
  "data": {
    "updatedCars": [
      {
        "id": 1,
        "make": "Toyota",
        "model": "Corolla",
        "year": 2023,
        "insuranceAmount": "750.00",
        "updatedAt": "2025-08-10T08:15:22.123Z"
      },
      {
        "id": 3,
        "make": "Honda",
        "model": "Civic",
        "year": 2022,
        "insuranceAmount": "750.00",
        "updatedAt": "2025-08-10T08:15:22.123Z"
      }
    ],
    "count": 2
  },
  "statusCode": 200
}
```

### 5. Get Active Coupons Endpoint
**Endpoint:** GET `/api/v1/coupons/active`

**Access:** Public

**Description:** Retrieves all active coupons that can be used by customers.

**Example Request:**
```bash
curl -X GET http://localhost:5500/api/v1/coupons/active \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Active coupons retrieved successfully",
  "data": {
    "data": [
      {
        "id": 1,
        "code": "WELCOME10",
        "name": "Welcome Discount",
        "description": "10% off on your first booking",
        "discountAmount": "10.00",
        "discountType": "percentage",
        "minBookingAmount": "1000.00",
        "maxDiscountAmount": "500.00",
        "startDate": "2025-08-10T08:06:33.952Z",
        "endDate": "2025-11-08T08:06:33.952Z",
        "status": "active",
        "usageLimit": 100,
        "usageCount": 0,
        "perUserLimit": 1,
        "isActive": true
      },
      {
        "id": 2,
        "code": "SUMMER25",
        "name": "Summer Special",
        "description": "25% off on summer bookings",
        "discountAmount": "25.00",
        "discountType": "percentage",
        "minBookingAmount": "2000.00",
        "maxDiscountAmount": "1000.00",
        "startDate": "2025-08-10T08:06:33.952Z",
        "endDate": "2025-10-09T08:06:33.952Z",
        "status": "active",
        "usageLimit": 50,
        "usageCount": 0,
        "perUserLimit": 1,
        "isActive": true
      }
      // Additional coupons omitted for brevity
    ],
    "total": 5
  },
  "statusCode": 200
}
```

### 6. Validate Coupon Endpoint
**Endpoint:** POST `/api/v1/coupons/validate`

**Access:** Public

**Description:** Validates a coupon code for a specific booking amount.

**Example Request:**
```bash
curl -X POST http://localhost:5500/api/v1/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUMMER25",
    "bookingAmount": 3000
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Coupon is valid",
  "data": {
    "coupon": {
      "id": 2,
      "code": "SUMMER25",
      "name": "Summer Special",
      "description": "25% off on summer bookings",
      "discountAmount": "25.00",
      "discountType": "percentage",
      "minBookingAmount": "2000.00",
      "maxDiscountAmount": "1000.00",
      "calculatedDiscount": 750
    }
  },
  "statusCode": 200
}
```

### 7. Car Addition Endpoint
**Endpoint:** POST `/api/v1/cars/add`

**Access:** Vendor or Admin only

**Description:** Creates a new car entry with price and discount price automatically inferred from the car catalog when catalogId is provided.

**Example Request:**
```bash
curl -X POST http://localhost:5500/api/v1/cars/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VENDOR_TOKEN" \
  -d '{
    "name": "Honda City",
    "number": "KA01AB1234",
    "color": "White",
    "vendorid": 5,
    "parkingid": 2,
    "catalogId": 3,
    "rcnumber": "RC12345678",
    "images": ["https://example.com/car1.jpg", "https://example.com/car2.jpg"]
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Car created successfully",
  "data": {
    "id": 15,
    "name": "Honda City",
    "number": "KA01AB1234",
    "vendorid": 5,
    "parkingid": 2,
    "color": "White",
    "price": 2000,
    "discountprice": 1800,
    "inmaintainance": false,
    "isavailable": true,
    "insuranceAmount": "500.00",
    "rcnumber": "RC12345678",
    "images": ["https://example.com/car1.jpg", "https://example.com/car2.jpg"],
    "catalogId": 3,
    "status": "available",
    "createdAt": "2025-08-10T08:30:22.123Z",
    "updatedAt": "2025-08-10T08:30:22.123Z"
  },
  "statusCode": 201
}
```

**Note:** When providing a `catalogId`, the `price` and `discountprice` fields are automatically inferred from the car catalog's `carPlatformPrice` and `carVendorPrice` respectively. You don't need to include these fields in your request.

## UI Implementation Guidelines

### 1. Booking Form

#### Coupon Field
Add a coupon input field to the booking form with validation:

```jsx
// Example React component snippet
const BookingForm = () => {
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [validatedCoupon, setValidatedCoupon] = useState(null);
  const [bookingAmount, setBookingAmount] = useState(0);
  
  const validateCoupon = async () => {
    try {
      const response = await fetch('/api/v1/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, bookingAmount })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCouponSuccess('Coupon applied successfully!');
        setCouponError('');
        setValidatedCoupon(data.data.coupon);
      } else {
        setCouponError(data.message || 'Invalid coupon');
        setCouponSuccess('');
        setValidatedCoupon(null);
      }
    } catch (error) {
      setCouponError('Error validating coupon');
      setCouponSuccess('');
      setValidatedCoupon(null);
    }
  };
  
  return (
    <form>
      {/* Other booking fields */}
      
      <div className="coupon-section">
        <label>Have a coupon?</label>
        <div className="coupon-input-group">
          <input 
            type="text" 
            value={couponCode} 
            onChange={(e) => setCouponCode(e.target.value)} 
            placeholder="Enter coupon code"
          />
          <button type="button" onClick={validateCoupon}>Apply</button>
        </div>
        
        {couponError && <div className="error-message">{couponError}</div>}
        {couponSuccess && <div className="success-message">{couponSuccess}</div>}
        
        {validatedCoupon && (
          <div className="coupon-details">
            <p><strong>{validatedCoupon.name}</strong></p>
            <p>{validatedCoupon.description}</p>
            <p>Discount: {validatedCoupon.calculatedDiscount} INR</p>
          </div>
        )}
      </div>
      
      {/* Submit button */}
    </form>
  );
};
```

### 2. Billing Summary Component
Create a component to display the detailed billing breakdown:

```jsx
// Example React component
const BillingSummary = ({ billingDetails }) => {
  return (
    <div className="billing-summary">
      <h3>Billing Summary</h3>
      
      <div className="billing-row">
        <span>Base Price:</span>
        <span>₹{billingDetails.basePrice}</span>
      </div>
      
      <div className="billing-row">
        <span>Insurance:</span>
        <span>₹{billingDetails.insuranceAmount}</span>
      </div>
      
      {billingDetails.deliveryCharges > 0 && (
        <div className="billing-row">
          <span>Delivery Charges:</span>
          <span>₹{billingDetails.deliveryCharges}</span>
        </div>
      )}
      
      <div className="billing-row subtotal">
        <span>Subtotal:</span>
        <span>₹{billingDetails.totalBeforeDiscount}</span>
      </div>
      
      {billingDetails.discountAmount > 0 && (
        <div className="billing-row discount">
          <span>Discount:</span>
          <span>-₹{billingDetails.discountAmount}</span>
        </div>
      )}
      
      <div className="billing-row total">
        <span>Total:</span>
        <span>₹{billingDetails.totalPrice}</span>
      </div>
      
      <div className="payment-details">
        <div className="billing-row">
          <span>Advance Payment (50%):</span>
          <span>₹{billingDetails.advanceAmount}</span>
        </div>
        
        <div className="billing-row">
          <span>Remaining Amount:</span>
          <span>₹{billingDetails.remainingAmount}</span>
        </div>
      </div>
    </div>
  );
};
```

### 3. Coupon Display Component
Create a component to display available coupons to users:

```jsx
// Example React component
const AvailableCoupons = ({ onSelectCoupon }) => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const response = await fetch('/api/v1/coupons/active');
        const data = await response.json();
        
        if (data.success) {
          setCoupons(data.data.data);
        } else {
          setError('Failed to load coupons');
        }
      } catch (error) {
        setError('Error loading coupons');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCoupons();
  }, []);
  
  if (loading) return <div>Loading coupons...</div>;
  if (error) return <div className="error-message">{error}</div>;
  
  return (
    <div className="available-coupons">
      <h3>Available Offers</h3>
      
      {coupons.length === 0 ? (
        <p>No active coupons available</p>
      ) : (
        <div className="coupon-list">
          {coupons.map(coupon => (
            <div key={coupon.id} className="coupon-card">
              <div className="coupon-header">
                <h4>{coupon.name}</h4>
                <span className="coupon-code">{coupon.code}</span>
              </div>
              
              <p className="coupon-description">{coupon.description}</p>
              
              <div className="coupon-details">
                {coupon.discountType === 'percentage' ? (
                  <p>{coupon.discountAmount}% off</p>
                ) : (
                  <p>₹{coupon.discountAmount} off</p>
                )}
                
                <p>Min. Order: ₹{coupon.minBookingAmount}</p>
                
                {coupon.maxDiscountAmount && (
                  <p>Max Discount: ₹{coupon.maxDiscountAmount}</p>
                )}
              </div>
              
              <button 
                onClick={() => onSelectCoupon(coupon.code)}
                className="apply-coupon-btn"
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```
- Add a coupon code input field to the booking form
- Implement validation for the coupon code
- Display appropriate error messages for invalid coupons

### 2. Booking Summary Display
Display the billing breakdown in a clear, itemized format:

```
Booking Summary:
----------------
Base Price:         ₹2,000
Insurance:          ₹500
Delivery Charges:   ₹100
                   -------
Subtotal:           ₹2,600
Discount:          -₹500 (SUMMER25)
                   -------
Total Price:        ₹2,100
                   =======
Advance Payment:    ₹1,050 (50%)
Remaining Amount:   ₹1,050 (Due at pickup)
```

### 3. Car Details Page
- Display the insurance amount as part of the car details
- Include insurance in the price breakdown when showing estimated costs

### 4. My Bookings Page
- Update the booking cards/details to show the complete billing breakdown
- Display coupon information if a coupon was applied
- Clearly indicate the advance payment and remaining amount

## Testing Checklist
- [ ] Verify coupon application works correctly with different coupon types (percentage/fixed)
- [ ] Test coupon validation (expired, usage limits, minimum booking amount)
- [ ] Confirm insurance amount is correctly added to the total price
- [ ] Ensure billing breakdown displays correctly in all booking views
- [ ] Test edge cases (zero delivery charges, zero discount, etc.)

## Example Components

### Coupon Input Component
```jsx
const CouponInput = ({ onApply }) => {
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);
    setError('');
    try {
      // Validate coupon code
      // If valid, call onApply callback
      onApply(couponCode);
    } catch (err) {
      setError(err.message || 'Invalid coupon code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="coupon-input">
      <input
        type="text"
        value={couponCode}
        onChange={(e) => setCouponCode(e.target.value)}
        placeholder="Enter coupon code"
      />
      <button onClick={handleApply} disabled={loading}>
        {loading ? 'Applying...' : 'Apply'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};
```

### Billing Breakdown Component
```jsx
const BillingBreakdown = ({ breakdown, coupon }) => {
  return (
    <div className="billing-breakdown">
      <h3>Booking Summary</h3>
      <div className="breakdown-item">
        <span>Base Price:</span>
        <span>₹{breakdown.basePrice.toLocaleString()}</span>
      </div>
      <div className="breakdown-item">
        <span>Insurance:</span>
        <span>₹{breakdown.insuranceAmount.toLocaleString()}</span>
      </div>
      <div className="breakdown-item">
        <span>Delivery Charges:</span>
        <span>₹{breakdown.deliveryCharges.toLocaleString()}</span>
      </div>
      <div className="breakdown-item subtotal">
        <span>Subtotal:</span>
        <span>₹{breakdown.totalBeforeDiscount.toLocaleString()}</span>
      </div>
      {breakdown.discountAmount > 0 && (
        <div className="breakdown-item discount">
          <span>Discount {coupon && `(${coupon.code})`}:</span>
          <span>-₹{breakdown.discountAmount.toLocaleString()}</span>
        </div>
      )}
      <div className="breakdown-item total">
        <span>Total Price:</span>
        <span>₹{breakdown.totalPrice.toLocaleString()}</span>
      </div>
      <div className="breakdown-item">
        <span>Advance Payment (50%):</span>
        <span>₹{breakdown.advanceAmount.toLocaleString()}</span>
      </div>
      <div className="breakdown-item remaining">
        <span>Remaining Amount:</span>
        <span>₹{breakdown.remainingAmount.toLocaleString()}</span>
      </div>
    </div>
  );
};
```
