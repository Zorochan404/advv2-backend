# Admin Dashboard API Documentation

## Overview

The Admin Dashboard API provides comprehensive data aggregation and analytics for the car rental and parking management system. It follows a hybrid approach with both comprehensive and granular endpoints for optimal performance and flexibility.

## Base URL
```
/api/v1/admin
```

## Authentication
All endpoints require JWT authentication and admin role access.

## Endpoints

### 1. Comprehensive Dashboard Data
**GET** `/dashboard`

Returns all dashboard data in a single request for optimal performance.

**Query Parameters:**
- `period` (optional): `today` | `week` | `month` (default: `week`)

**Response:**
```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "totalRevenue": 125000,
    "activeBookingsCount": 15,
    "totalUsersCount": 250,
    "carAvailability": {
      "total": 50,
      "available": 35,
      "rented": 10,
      "maintenance": 3,
      "outOfService": 2,
      "availabilityRate": "70.0"
    },
    "parkingUtilization": [
      {
        "name": "Downtown Parking",
        "cars": 8,
        "capacity": 20,
        "utilization": 40.0,
        "available": 12
      }
    ],
    "revenueByCarType": [
      {
        "type": "Sedan",
        "revenue": 75000,
        "bookings": 25
      }
    ],
    "chartData": [
      {
        "date": "2025-01-01",
        "revenue": 5000,
        "bookings": 3
      }
    ],
    "recentBookings": [
      {
        "id": 1,
        "status": "active",
        "totalPrice": 2500,
        "createdAt": "2025-01-08T10:00:00Z",
        "car": {
          "make": "Toyota",
          "model": "Camry",
          "uniqueId": "TN01AB1234"
        },
        "user": {
          "name": "John Doe"
        }
      }
    ]
  }
}
```

### 2. Key Metrics Only
**GET** `/dashboard/metrics`

Returns only the key metrics for quick widget updates.

**Query Parameters:**
- `period` (optional): `today` | `week` | `month` (default: `week`)

**Response:**
```json
{
  "success": true,
  "message": "Dashboard metrics retrieved successfully",
  "data": {
    "totalRevenue": 125000,
    "activeBookingsCount": 15,
    "totalUsersCount": 250,
    "carAvailability": {
      "total": 50,
      "available": 35,
      "availabilityRate": "70.0"
    }
  }
}
```

### 3. Car Availability Status
**GET** `/dashboard/car-availability`

Returns detailed car availability and status information.

**Response:**
```json
{
  "success": true,
  "message": "Car availability data retrieved successfully",
  "data": {
    "total": 50,
    "available": 35,
    "rented": 10,
    "maintenance": 3,
    "outOfService": 2,
    "availabilityRate": "70.0"
  }
}
```

### 4. Parking Utilization
**GET** `/dashboard/parking-utilization`

Returns parking spot utilization across all locations.

**Response:**
```json
{
  "success": true,
  "message": "Parking utilization data retrieved successfully",
  "data": [
    {
      "name": "Downtown Parking",
      "cars": 8,
      "capacity": 20,
      "utilization": 40.0,
      "available": 12
    },
    {
      "name": "Airport Parking",
      "cars": 15,
      "capacity": 25,
      "utilization": 60.0,
      "available": 10
    }
  ]
}
```

### 5. Revenue Trends
**GET** `/dashboard/revenue-trends`

Returns chart data for revenue trends and car type analysis.

**Query Parameters:**
- `period` (optional): `today` | `week` | `month` (default: `week`)

**Response:**
```json
{
  "success": true,
  "message": "Revenue trends data retrieved successfully",
  "data": {
    "chartData": [
      {
        "date": "2025-01-01",
        "revenue": 5000,
        "bookings": 3
      }
    ],
    "revenueByCarType": [
      {
        "type": "Sedan",
        "revenue": 75000,
        "bookings": 25
      },
      {
        "type": "SUV",
        "revenue": 50000,
        "bookings": 15
      }
    ]
  }
}
```

### 6. Recent Bookings
**GET** `/dashboard/recent-bookings`

Returns recent booking activity.

**Query Parameters:**
- `limit` (optional): Number of recent bookings to return (default: 5)

**Response:**
```json
{
  "success": true,
  "message": "Recent bookings retrieved successfully",
  "data": [
    {
      "id": 1,
      "status": "active",
      "totalPrice": 2500,
      "createdAt": "2025-01-08T10:00:00Z",
      "car": {
        "make": "Toyota",
        "model": "Camry",
        "uniqueId": "TN01AB1234"
      },
      "user": {
        "name": "John Doe"
      }
    }
  ]
}
```

## Usage Examples

### Frontend Integration

#### 1. Initial Dashboard Load
```javascript
// Load complete dashboard data
const response = await fetch('/api/v1/admin/dashboard?period=week', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const dashboardData = await response.json();
```

#### 2. Real-time Metrics Update
```javascript
// Update only metrics widget
const response = await fetch('/api/v1/admin/dashboard/metrics?period=today', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const metrics = await response.json();
```

#### 3. Car Availability Widget
```javascript
// Update car availability status
const response = await fetch('/api/v1/admin/dashboard/car-availability', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const carAvailability = await response.json();
```

## Performance Considerations

### 1. Caching Strategy
- **Comprehensive endpoint**: Cache for 5-10 minutes
- **Granular endpoints**: Cache for 1-2 minutes
- **Real-time data**: No caching or very short cache (30 seconds)

### 2. Database Optimization
- All queries use parallel execution with `Promise.all()`
- Proper indexing on `createdAt`, `status`, and `parkingid` fields
- Efficient aggregation queries for metrics

### 3. Response Size
- **Comprehensive endpoint**: ~2-5KB (typical dashboard)
- **Granular endpoints**: ~0.5-2KB each
- **Chart data**: Optimized for frontend consumption

## Security

### 1. Authentication
- JWT token required for all endpoints
- Admin role verification
- Rate limiting applied (100 requests per second per IP)

### 2. Authorization
- Admin-only access using `requireAdmin` middleware
- Alternative: Granular permissions using `requirePermission(Permission.VIEW_ANALYTICS)`

### 3. Data Privacy
- No sensitive user information exposed
- Only necessary booking and car data included
- Proper error handling without data leakage

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized access",
  "statusCode": 401
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin access required",
  "statusCode": 403
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to retrieve dashboard data",
  "statusCode": 500
}
```

## Monitoring and Analytics

### 1. Performance Metrics
- Response time monitoring
- Database query performance
- Cache hit rates

### 2. Usage Analytics
- Most accessed endpoints
- Peak usage times
- Error rates

### 3. Business Metrics
- Dashboard load frequency
- Most viewed time periods
- User engagement patterns

## Future Enhancements

### 1. Real-time Updates
- WebSocket integration for live data
- Server-sent events for metrics updates

### 2. Advanced Analytics
- Predictive analytics
- Trend analysis
- Performance forecasting

### 3. Customization
- User-specific dashboard layouts
- Custom date ranges
- Export functionality

## Testing

### 1. Unit Tests
- Controller function testing
- Data aggregation logic
- Error handling scenarios

### 2. Integration Tests
- End-to-end API testing
- Database integration
- Authentication flow

### 3. Performance Tests
- Load testing with concurrent requests
- Database query optimization
- Response time benchmarks
