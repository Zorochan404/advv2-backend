# Admin Vendors & Parkings Management API

This document describes the admin vendors and parkings management API endpoints that provide comprehensive data for managing vendors and parking locations in the admin portal.

## Base URL
```
/api/v1/admin
```

## Authentication
All endpoints require:
- **JWT Token**: Bearer token in Authorization header
- **Admin Role**: User must have admin role

## Endpoints

### 1. Get Vendors List
**GET** `/api/v1/admin/vendors`

Retrieves a paginated list of all vendors with their details and car counts.

#### Query Parameters
- `search` (string, optional): Search by vendor name, email, or phone number
- `limit` (number, optional): Number of results to return (default: 20, max: 100)
- `offset` (number, optional): Number of results to skip (default: 0)

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/vendors?search=Vendor&limit=10"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "vendors": [
      {
        "id": 6,
        "name": "Vendor Name",
        "email": "vendor@example.com",
        "number": 9780623415,
        "avatar": null,
        "locality": null,
        "city": null,
        "state": null,
        "isverified": false,
        "createdAt": "2025-08-01T00:34:05.016Z",
        "updatedAt": "2025-08-01T00:34:05.016Z",
        "carCount": 14
      }
    ],
    "pagination": {
      "total": 3,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  },
  "message": "Vendors retrieved successfully",
  "success": true
}
```

### 2. Get Parkings List
**GET** `/api/v1/admin/parkings`

Retrieves a paginated list of all parking locations with their details, car counts, and utilization statistics.

#### Query Parameters
- `search` (string, optional): Search by parking name, locality, city, or state
- `limit` (number, optional): Number of results to return (default: 20, max: 100)
- `offset` (number, optional): Number of results to skip (default: 0)

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parkings?search=Mumbai&limit=10"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "parkings": [
      {
        "id": 1,
        "name": "Updated Parking Name",
        "locality": "Andheri",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 400058,
        "capacity": 60,
        "mainimg": "https://...",
        "images": ["parking1.jpg", "parking2.jpg"],
        "lat": 19.076,
        "lng": 72.8777,
        "createdAt": "2025-08-01T01:14:46.981Z",
        "updatedAt": "2025-08-01T01:14:46.981Z",
        "totalCars": 11,
        "availableCars": 11,
        "utilizationPercentage": 18
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  },
  "message": "Parkings retrieved successfully",
  "success": true
}
```

## Data Structures

### Vendor Object
```typescript
interface Vendor {
  id: number;
  name: string;
  email: string;
  number: number;
  avatar: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  isverified: boolean;
  createdAt: string;
  updatedAt: string;
  carCount: number; // Number of cars owned by this vendor
}
```

### Parking Object
```typescript
interface Parking {
  id: number;
  name: string;
  locality: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: number | null;
  capacity: number;
  mainimg: string;
  images: string[] | null;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
  totalCars: number; // Total cars in this parking
  availableCars: number; // Available cars in this parking
  utilizationPercentage: number; // Utilization percentage (0-100)
}
```

### Pagination Object
```typescript
interface Pagination {
  total: number; // Total number of records
  limit: number; // Number of records per page
  offset: number; // Number of records skipped
  hasMore: boolean; // Whether there are more records
}
```

## Features

### Search Functionality

#### Vendors Search
The search parameter searches across:
- Vendor name
- Email address
- Phone number

#### Parkings Search
The search parameter searches across:
- Parking name
- Locality
- City
- State

### Pagination
Both endpoints support pagination with:
- `limit`: Number of results per page (1-100)
- `offset`: Number of results to skip
- `hasMore`: Boolean indicating if more results are available

### Statistics

#### Vendor Statistics
- `carCount`: Number of cars owned by each vendor

#### Parking Statistics
- `totalCars`: Total number of cars in the parking
- `availableCars`: Number of available cars (not rented/maintenance)
- `utilizationPercentage`: Percentage of parking capacity being used

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "data": null,
  "message": "Invalid query parameters",
  "success": false
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
  "message": "Failed to fetch vendors/parkings",
  "success": false
}
```

## Usage Examples

### Get All Vendors
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/vendors"
```

### Search Vendors by Name
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/vendors?search=Vendor%20Name"
```

### Get Parkings with Pagination
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parkings?limit=10&offset=0"
```

### Search Parkings by City
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parkings?search=Mumbai"
```

### Get High Utilization Parkings
```bash
# This would require additional filtering logic in the frontend
# based on the utilizationPercentage field
```

## Integration Notes

These APIs are designed to work seamlessly with admin portal pages for:

### Vendors Management
- Vendor listing with search and pagination
- Vendor details with car count statistics
- Vendor verification status tracking

### Parkings Management
- Parking location listing with search and pagination
- Parking utilization monitoring
- Capacity and availability tracking
- Geographic location data for mapping

The response format provides all necessary data for building comprehensive admin management interfaces with real-time statistics and efficient pagination.

