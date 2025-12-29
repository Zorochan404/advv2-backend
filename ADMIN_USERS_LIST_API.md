# Admin Users List API

This document describes the admin users list API endpoint that provides comprehensive user management data for the admin portal.

## Base URL
```
/api/v1/admin/users
```

## Authentication
All endpoints require:
- **JWT Token**: Bearer token in Authorization header
- **Admin Role**: User must have admin role

## Endpoints

### 1. Get Users List
**GET** `/api/v1/admin/users`

Retrieves a paginated list of users with search and filtering capabilities, including role-specific statistics.

#### Query Parameters
- `search` (string, optional): Search by user name, email, or phone number
- `role` (string, optional): Filter by user role - `'user'`, `'admin'`, `'vendor'`, `'parkingincharge'`
- `limit` (number, optional): Number of results per page (default: 20, max: 100)
- `offset` (number, optional): Number of results to skip for pagination (default: 0)

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/users?search=John&role=vendor&limit=10"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "users": [
      {
        "id": 6,
        "name": "John Doe",
        "email": "john@example.com",
        "number": 9876543210,
        "avatar": "https://example.com/avatar.jpg",
        "role": "vendor",
        "isverified": true,
        "locality": "Downtown",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 400001,
        "parkingid": null,
        "createdAt": "2025-08-01T10:30:00.000Z",
        "updatedAt": "2025-08-01T10:30:00.000Z",
        "carCount": 5
      },
      {
        "id": 13,
        "name": "Rajesh Kumar",
        "email": "rajesh@example.com",
        "number": 9876563210,
        "avatar": null,
        "role": "parkingincharge",
        "isverified": true,
        "locality": "Andheri",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 400058,
        "parkingid": 1,
        "createdAt": "2025-08-05T20:09:13.823Z",
        "updatedAt": "2025-08-05T20:09:13.823Z",
        "parkingInfo": {
          "id": 1,
          "name": "Updated Parking Name",
          "locality": "Andheri",
          "city": "Mumbai",
          "capacity": 60
        },
        "carsManaged": 11
      },
      {
        "id": 15,
        "name": "Regular User",
        "email": "user@example.com",
        "number": 9876543211,
        "avatar": null,
        "role": "user",
        "isverified": false,
        "locality": "Bandra",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 400050,
        "parkingid": null,
        "createdAt": "2025-08-10T15:30:00.000Z",
        "updatedAt": "2025-08-10T15:30:00.000Z",
        "bookingCount": 3
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 10,
      "offset": 0,
      "hasMore": true
    }
  },
  "message": "Users retrieved successfully",
  "success": true
}
```

## Data Structures

### User Object
```typescript
interface User {
  id: number;
  name: string | null;
  email: string | null;
  number: number | null;
  avatar: string | null;
  role: 'user' | 'admin' | 'vendor' | 'parkingincharge';
  isverified: boolean;
  locality: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: number | null;
  parkingid: number | null;
  createdAt: string;
  updatedAt: string;
  
  // Role-specific additional data
  carCount?: number;           // For vendors: number of cars owned
  parkingInfo?: ParkingInfo;   // For PIC: assigned parking details
  carsManaged?: number;        // For PIC: number of cars managed
  bookingCount?: number;       // For users: number of bookings made
}

interface ParkingInfo {
  id: number;
  name: string;
  locality: string | null;
  city: string | null;
  capacity: number;
}
```

### Pagination Object
```typescript
interface Pagination {
  total: number;        // Total number of users matching the criteria
  limit: number;        // Number of results per page
  offset: number;       // Number of results skipped
  hasMore: boolean;     // Whether there are more results available
}
```

## Role-Specific Data

### Vendor Users
Vendor users include additional `carCount` field showing the number of cars they own:
```json
{
  "id": 6,
  "name": "John Doe",
  "role": "vendor",
  "carCount": 5
}
```

### Parking In Charge (PIC) Users
PIC users include additional parking management data:
```json
{
  "id": 13,
  "name": "Rajesh Kumar",
  "role": "parkingincharge",
  "parkingid": 1,
  "parkingInfo": {
    "id": 1,
    "name": "Updated Parking Name",
    "locality": "Andheri",
    "city": "Mumbai",
    "capacity": 60
  },
  "carsManaged": 11
}
```

### Regular Users
Regular users include booking count:
```json
{
  "id": 15,
  "name": "Regular User",
  "role": "user",
  "bookingCount": 3
}
```

### Admin Users
Admin users don't have additional role-specific data beyond the basic user information.

## Error Responses

### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "message": "Validation failed: role: Invalid option: expected one of \"user\"|\"admin\"|\"vendor\"|\"parkingincharge\"",
  "statusCode": 400,
  "timestamp": "2025-09-14T09:30:00.000Z",
  "path": "/users",
  "method": "GET"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "data": null,
  "message": "Unauthorized access",
  "success": false
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "data": null,
  "message": "Admin access required",
  "success": false
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "data": null,
  "message": "Failed to fetch users",
  "success": false
}
```

## Usage Examples

### Get All Users (Paginated)
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/users?limit=20&offset=0"
```

### Search Users by Name or Email
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/users?search=John&limit=10"
```

### Filter Users by Role
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/users?role=vendor&limit=10"
```

### Search Vendors by Name
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/users?search=John&role=vendor&limit=10"
```

### Get Parking In Charge Users
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/users?role=parkingincharge&limit=10"
```

### Get Regular Users with Bookings
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/users?role=user&limit=10"
```

## Features

### Search Functionality
- **Multi-field Search**: Search across user name, email, and phone number
- **Case Insensitive**: Search is case-insensitive
- **Partial Matching**: Supports partial string matching

### Role Filtering
- **Specific Roles**: Filter by any of the four user roles
- **Role Statistics**: Each role includes relevant additional data
- **Combined Filtering**: Combine search with role filtering

### Pagination
- **Efficient Loading**: Configurable page size (1-100 users per page)
- **Offset-based**: Standard offset-based pagination
- **Total Count**: Includes total count for UI pagination controls
- **Has More Indicator**: Boolean flag indicating if more results exist

### Role-Specific Data
- **Vendor Stats**: Car count for vendors
- **PIC Management**: Parking info and cars managed for parking in charge
- **User Activity**: Booking count for regular users
- **Admin Users**: Basic information without additional stats

## Integration Notes

This API is designed for admin dashboard integration where:

### User Management Interface
- **User List**: Display paginated list of all users
- **Search Bar**: Real-time search across user fields
- **Role Filter**: Dropdown to filter by user role
- **User Details**: Show role-specific information and statistics

### Admin Workflows
- **User Overview**: Get comprehensive view of all platform users
- **Role Management**: Identify users by role for management actions
- **Performance Tracking**: Monitor user activity and engagement
- **User Support**: Find specific users for support purposes

### Data Analytics
- **User Distribution**: Analyze user distribution across roles
- **Activity Metrics**: Track user engagement and activity levels
- **Growth Tracking**: Monitor user registration and growth trends
- **Role Performance**: Assess performance of different user types

The response format provides all necessary data for building comprehensive admin interfaces with efficient user management capabilities, role-based filtering, and detailed user statistics.
