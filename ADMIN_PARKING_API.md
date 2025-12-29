# Admin Parking Management API

This document describes the admin parking management API endpoints that provide comprehensive data for the admin portal's parking management page.

## Base URL
```
/api/v1/admin/parking
```

## Authentication
All endpoints require:
- **JWT Token**: Bearer token in Authorization header
- **Admin Role**: User must have admin role

## Endpoints

### 1. Get Parking Statistics
**GET** `/api/v1/admin/parking/stats`

Retrieves comprehensive parking statistics for the admin dashboard.

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/stats"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "totalSpots": 5,
    "totalCapacity": 379,
    "totalCars": 18,
    "availableCars": 18,
    "bookedCars": 0,
    "maintenanceCars": 0,
    "utilizationRate": 4.75,
    "spotsWithManagers": 4,
    "spotsWithoutManagers": 1
  },
  "message": "Parking statistics retrieved successfully",
  "success": true
}
```

### 2. Search Parking Spots
**GET** `/api/v1/admin/parking/search`

Search and filter parking spots with comprehensive filtering options.

#### Query Parameters
- `search` (string, optional): Search by parking name, locality, city, or state
- `city` (string, optional): Filter by city name
- `capacity` (number, optional): Filter by minimum capacity
- `hasManager` (string, optional): Filter by manager presence - `'true'` or `'false'`
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of results per page (default: 10, max: 100)

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/search?search=Mumbai&city=Mumbai&capacity=50&hasManager=true&limit=10"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "parkingSpots": [
      {
        "id": 1,
        "name": "Updated Parking Name",
        "locality": "Andheri",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 400058,
        "capacity": 60,
        "mainimg": "https://example.com/parking.jpg",
        "images": ["image1.jpg", "image2.jpg"],
        "lat": 19.076,
        "lng": 72.8777,
        "createdAt": "2025-08-01T01:14:46.981Z",
        "updatedAt": "2025-08-01T01:14:46.981Z",
        "totalCars": 11,
        "availableCars": 11,
        "utilizationRate": 18.33,
        "manager": {
          "id": 13,
          "name": "Rajesh Kumar",
          "email": "pic@example.com",
          "number": 9876563210,
          "avatar": null
        }
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 10
  },
  "message": "Parking spots retrieved successfully",
  "success": true
}
```

### 3. Get Parking Analytics
**GET** `/api/v1/admin/parking/analytics`

Get detailed analytics for a specific parking spot including utilization history.

#### Query Parameters
- `spotId` (number, required): The ID of the parking spot
- `period` (string, optional): Analytics period - `'daily'`, `'weekly'`, `'monthly'`, `'yearly'` (default: `'monthly'`)

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/analytics?spotId=1&period=monthly"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "spotId": 1,
    "spotName": "Updated Parking Name",
    "utilizationHistory": [
      {
        "date": "2025-08-31",
        "utilization": 18.33,
        "totalCars": 11,
        "availableCars": 11
      },
      {
        "date": "2025-09-01",
        "utilization": 18.33,
        "totalCars": 11,
        "availableCars": 11
      }
    ],
    "averageUtilization": 18.33,
    "peakUtilization": 18.33
  },
  "message": "Parking analytics retrieved successfully",
  "success": true
}
```

### 4. Get Parking Managers Performance
**GET** `/api/v1/admin/parking/managers/performance`

Retrieves performance data for all parking managers (PIC - Parking In Charge).

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/managers/performance"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "managers": [
      {
        "id": 13,
        "name": "Rajesh Kumar",
        "email": "pic@example.com",
        "number": 9876563210,
        "avatar": null,
        "parkingSpot": {
          "id": 1,
          "name": "Updated Parking Name",
          "locality": "Andheri",
          "city": "Mumbai",
          "capacity": 60
        },
        "carsManaged": 11,
        "utilizationRate": 18.33,
        "lastActivity": "2025-08-05T20:09:13.823Z"
      },
      {
        "id": 15,
        "name": "Parking Manager 2",
        "email": "manager2@parking.com",
        "number": 1234509877,
        "avatar": null,
        "parkingSpot": {
          "id": 2,
          "name": "New Modern Parking",
          "locality": "Andheri",
          "city": "Mumbai",
          "capacity": 50
        },
        "carsManaged": 6,
        "utilizationRate": 12.0,
        "lastActivity": "2025-08-08T09:24:24.291Z"
      }
    ]
  },
  "message": "Parking managers performance retrieved successfully",
  "success": true
}
```

## Data Structures

### Parking Statistics
```typescript
interface ParkingStats {
  totalSpots: number;           // Total number of parking spots
  totalCapacity: number;        // Total capacity across all spots
  totalCars: number;           // Total cars in all parking spots
  availableCars: number;       // Available cars (not booked/maintenance)
  bookedCars: number;          // Currently booked cars
  maintenanceCars: number;     // Cars in maintenance
  utilizationRate: number;     // Overall utilization percentage
  spotsWithManagers: number;   // Spots with assigned managers
  spotsWithoutManagers: number; // Spots without managers
}
```

### Parking Spot
```typescript
interface ParkingSpot {
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
  totalCars: number;           // Total cars in this spot
  availableCars: number;       // Available cars in this spot
  utilizationRate: number;     // Utilization percentage
  manager: Manager | null;     // Assigned manager details
}
```

### Manager
```typescript
interface Manager {
  id: number;
  name: string;
  email: string | null;
  number: number | null;
  avatar: string | null;
}
```

### Parking Analytics
```typescript
interface ParkingAnalytics {
  spotId: number;
  spotName: string;
  utilizationHistory: UtilizationData[];
  averageUtilization: number;
  peakUtilization: number;
}

interface UtilizationData {
  date: string;                // Date in YYYY-MM-DD format
  utilization: number;         // Utilization percentage
  totalCars: number;          // Total cars on this date
  availableCars: number;      // Available cars on this date
}
```

### Manager Performance
```typescript
interface ManagerPerformance {
  id: number;
  name: string;
  email: string | null;
  number: number | null;
  avatar: string | null;
  parkingSpot: ParkingSpotInfo | null;
  carsManaged: number;        // Number of cars managed
  utilizationRate: number;    // Utilization rate of managed parking
  lastActivity: string | null; // Last activity timestamp
}

interface ParkingSpotInfo {
  id: number;
  name: string;
  locality: string | null;
  city: string | null;
  capacity: number;
}
```

## Features

### Search and Filtering
- **Text Search**: Search across parking name, locality, city, and state
- **City Filter**: Filter by specific city
- **Capacity Filter**: Filter by minimum capacity
- **Manager Filter**: Filter by presence/absence of managers
- **Pagination**: Efficient data loading with page and limit

### Analytics
- **Multiple Periods**: Daily, weekly, monthly, and yearly analytics
- **Utilization History**: Historical utilization data
- **Performance Metrics**: Average and peak utilization rates
- **Real-time Data**: Current car counts and availability

### Manager Performance
- **Comprehensive Data**: Manager details with parking spot information
- **Performance Metrics**: Cars managed and utilization rates
- **Activity Tracking**: Last activity timestamps
- **Parking Assignment**: Shows which parking spot each manager is assigned to

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "data": null,
  "message": "Spot ID is required",
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

### 404 Not Found
```json
{
  "statusCode": 404,
  "data": null,
  "message": "Parking spot not found",
  "success": false
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "data": null,
  "message": "Failed to fetch parking statistics",
  "success": false
}
```

## Usage Examples

### Get Dashboard Statistics
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/stats"
```

### Search High-Capacity Parking in Mumbai
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/search?city=Mumbai&capacity=100"
```

### Get Monthly Analytics for Specific Spot
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/analytics?spotId=1&period=monthly"
```

### Find Parking Spots Without Managers
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/search?hasManager=false"
```

### Get Manager Performance Report
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/parking/managers/performance"
```

## Integration Notes

These APIs are designed to work seamlessly with admin portal pages for:

### Parking Dashboard
- **Statistics Cards**: Total spots, capacity, cars, utilization rate
- **Manager Status**: Spots with/without managers
- **Quick Overview**: Available vs booked vs maintenance cars

### Parking Management
- **Search and Filter**: Find parking spots by various criteria
- **Manager Assignment**: Track which spots have managers
- **Capacity Monitoring**: Monitor utilization and capacity

### Analytics and Reporting
- **Historical Data**: Track utilization trends over time
- **Performance Metrics**: Manager performance and efficiency
- **Capacity Planning**: Data for expansion and optimization

### Manager Performance
- **Performance Tracking**: Monitor manager efficiency
- **Activity Monitoring**: Track manager activity and engagement
- **Resource Allocation**: Optimize manager assignments

The response format provides all necessary data for building comprehensive admin management interfaces with real-time statistics, efficient search capabilities, and detailed analytics.
