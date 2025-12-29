# Admin Payments API Documentation

This document describes the admin payment management API endpoints for the car rental system.

## Base URL
```
http://localhost:5500/api/v1/admin/payments
```

## Authentication
All endpoints require admin authentication via JWT token in the Authorization header:
```
Authorization: Bearer <admin_jwt_token>
```

---

## 1. Get All Payments

**Endpoint:** `GET /api/v1/admin/payments`

**Description:** Retrieve a paginated list of all payments with filtering options.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Payment status: `pending`, `processing`, `completed`, `failed`, `cancelled`, `refunded` |
| `method` | string | No | Payment method: `razorpay`, `stripe`, `paypal`, `upi`, `card`, `netbanking`, `wallet`, `cash` |
| `startDate` | string | No | Start date filter (ISO date format) |
| `endDate` | string | No | End date filter (ISO date format) |
| `minAmount` | number | No | Minimum payment amount |
| `maxAmount` | number | No | Maximum payment amount |
| `customerId` | number | No | Filter by customer ID |
| `bookingId` | number | No | Filter by booking ID |
| `gateway` | string | No | Filter by payment gateway |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |

### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5500/api/v1/admin/payments?status=completed&method=razorpay&limit=10"
```

### Response Structure
```json
{
  "success": true,
  "message": "Payments retrieved successfully",
  "data": {
    "data": [
      {
        "id": 27,
        "transactionId": "late_1757529105974_7",
        "bookingId": 7,
        "amount": 566,
        "refundAmount": 100,
        "status": "completed",
        "method": "razorpay",
        "gateway": "razorpay",
        "gatewayTransactionId": null,
        "gatewayResponse": null,
        "refundDate": "2025-09-14T10:57:49.250Z",
        "refundReason": "Customer cancellation",
        "createdAt": "2025-09-10T18:31:45.974Z",
        "updatedAt": "2025-09-10T18:31:45.974Z",
        "customerName": "John Doe",
        "customerEmail": "john@example.com",
        "customerPhone": 9101200169,
        "customerAvatar": "https://example.com/avatar.jpg",
        "carName": "XUV500 W8",
        "pickupLocation": "Mumbai Airport",
        "duration": 2,
        "currency": "INR",
        "fees": 0,
        "netAmount": 566,
        "description": "Car rental payment",
        "metadata": {
          "bookingType": "rental",
          "discountApplied": 100
        }
      }
    ],
    "total": 27,
    "page": 1,
    "limit": 10
  }
}
```

---

## 2. Get Payment by ID

**Endpoint:** `GET /api/v1/admin/payments/:id`

**Description:** Retrieve detailed information about a specific payment.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Payment ID |

### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5500/api/v1/admin/payments/27"
```

### Response Structure
```json
{
  "success": true,
  "message": "Payment retrieved successfully",
  "data": {
    "id": 27,
    "transactionId": "late_1757529105974_7",
    "bookingId": 7,
    "amount": 566,
    "refundAmount": 100,
    "status": "completed",
    "method": "razorpay",
    "gateway": "razorpay",
    "gatewayTransactionId": null,
    "gatewayResponse": null,
    "refundDate": "2025-09-14T10:57:49.250Z",
    "refundReason": "Customer cancellation",
    "createdAt": "2025-09-10T18:31:45.974Z",
    "updatedAt": "2025-09-10T18:31:45.974Z",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": 9101200169,
    "customerAvatar": "https://example.com/avatar.jpg",
    "carName": "XUV500 W8",
    "pickupLocation": "Mumbai Airport",
    "duration": 2,
    "currency": "INR",
    "fees": 0,
    "netAmount": 566,
    "description": "Car rental payment",
    "metadata": {}
  }
}
```

---

## 3. Get Payment Statistics

**Endpoint:** `GET /api/v1/admin/payments/stats`

**Description:** Retrieve comprehensive payment statistics and analytics.

### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5500/api/v1/admin/payments/stats"
```

### Response Structure
```json
{
  "success": true,
  "message": "Payment statistics retrieved successfully",
  "data": {
    "totalPayments": 27,
    "totalRevenue": 22330,
    "completedPayments": "27",
    "pendingPayments": "0",
    "failedPayments": "0",
    "refundedPayments": "0",
    "averagePayment": 827.0370370370371,
    "revenueByMethod": {
      "razorpay": 22330
    },
    "revenueByStatus": {
      "completed": 22330
    },
    "dailyRevenue": [
      {
        "date": "2025-09-10",
        "revenue": 22330,
        "count": 27
      }
    ],
    "monthlyRevenue": [
      {
        "month": "2025-09",
        "revenue": 22330,
        "count": 27
      }
    ]
  }
}
```

---

## 4. Refund Payment

**Endpoint:** `POST /api/v1/admin/payments/:id/refund`

**Description:** Process a refund for a completed payment.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Payment ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refundAmount` | number | Yes | Amount to refund (must be positive and ≤ original amount) |
| `reason` | string | Yes | Reason for refund |

### Example Request
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "refundAmount": 100,
    "reason": "Customer cancellation"
  }' \
  "http://localhost:5500/api/v1/admin/payments/27/refund"
```

### Response Structure
```json
{
  "success": true,
  "message": "Payment refunded successfully",
  "data": {
    "refundAmount": 100,
    "refundDate": "2025-09-14T10:57:49.250Z",
    "refundReason": "Customer cancellation",
    "status": "completed"
  }
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Valid refund amount is required",
  "statusCode": 400
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Payment not found",
  "statusCode": 404
}
```

#### 400 Bad Request - Invalid Status
```json
{
  "success": false,
  "message": "Only completed payments can be refunded",
  "statusCode": 400
}
```

---

## Data Models

### Payment Object
```typescript
interface Payment {
  id: number;
  transactionId: string;
  bookingId: number | null;
  amount: number;
  refundAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  method: 'razorpay' | 'stripe' | 'paypal' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'cash';
  gateway: string;
  gatewayTransactionId: string | null;
  gatewayResponse: string | null;
  refundDate: string | null;
  refundReason: string | null;
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: number | null;
  customerAvatar: string | null;
  carName: string | null;
  pickupLocation: string;
  duration: number;
  currency: string;
  fees: number;
  netAmount: number;
  description: string;
  metadata: Record<string, any>;
}
```

### Payment Statistics Object
```typescript
interface PaymentStats {
  totalPayments: number;
  totalRevenue: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  refundedPayments: number;
  averagePayment: number;
  revenueByMethod: Record<string, number>;
  revenueByStatus: Record<string, number>;
  dailyRevenue: Array<{
    date: string;
    revenue: number;
    count: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    count: number;
  }>;
}
```

---

## Error Handling

All endpoints return standardized error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed: <field>: <error>",
  "statusCode": 400,
  "timestamp": "2025-09-14T10:56:31.660Z",
  "path": "/api/v1/admin/payments",
  "method": "GET"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. Admin role required.",
  "statusCode": 401
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Payment not found",
  "statusCode": 404
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to fetch payments",
  "statusCode": 500
}
```

---

## Implementation Notes

### High Priority Features (Implemented)
- ✅ GET /api/v1/admin/payments - List payments with filtering
- ✅ GET /api/v1/admin/payments/:id - Payment details
- ✅ GET /api/v1/admin/payments/stats - Basic statistics
- ✅ POST /api/v1/admin/payments/:id/refund - Refund functionality

### Medium Priority Features (Pending)
- ⏳ GET /api/v1/admin/payments/export - Export capabilities
- ⏳ Advanced filtering options

### Low Priority Features (Pending)
- ⏳ GET /api/v1/admin/payments/analytics - Advanced insights
- ⏳ Bulk refund operations
- ⏳ Payment reconciliation features

### Security Considerations
- All endpoints require admin authentication
- Input validation on all parameters
- SQL injection protection via Drizzle ORM
- Rate limiting applied at application level

### Performance Considerations
- Pagination implemented for large datasets
- Database indexes on frequently queried fields
- Efficient joins for related data
- Caching considerations for statistics endpoints
