# Admin Cars Management API

This document describes the admin cars management API endpoints that provide comprehensive car data for the admin portal's cars management page.

## Base URL
```
/api/v1/admin/cars
```

## Authentication
All endpoints require:
- **JWT Token**: Bearer token in Authorization header
- **Admin Role**: User must have admin role

## Endpoints

### 1. Get All Cars
**GET** `/api/v1/admin/cars`

Retrieves all cars with comprehensive data including catalog information, vendor details, and parking information.

#### Query Parameters
- `search` (string, optional): Search by car name, maker, car number, RC number, or vendor name
- `status` (string, optional): Filter by status - `all`, `available`, `rented`, `maintenance`, `out_of_service`
- `popularOnly` (boolean, optional): Show only popular cars (cars with 3+ bookings)
- `startDate` (string, optional): Filter cars by booking date range start (ISO datetime)
- `endDate` (string, optional): Filter cars by booking date range end (ISO datetime)
- `limit` (number, optional): Number of results to return (default: 100, max: 1000)
- `offset` (number, optional): Number of results to skip (default: 0)

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/cars?search=Hyundai&status=available&limit=10"
```

#### Response
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 7,
      "name": "i20 Sportz",
      "maker": "Hyundai",
      "year": 2023,
      "carnumber": "CAR-HI-001",
      "price": 1000,
      "insurancePrice": 500,
      "discountedprice": 850,
      "color": "Phantom Black",
      "transmission": "manual",
      "fuel": "petrol",
      "type": "hatchback",
      "seats": 5,
      "rcnumber": "",
      "rcimg": "",
      "pollutionimg": "",
      "insuranceimg": "",
      "inmaintainance": false,
      "isavailable": true,
      "images": ["image1.jpg", "image2.jpg"],
      "mainimg": "image1.jpg",
      "vendorid": 8,
      "parkingid": 1,
      "isapproved": true,
      "ispopular": false,
      "createdAt": "2025-08-05T17:43:43.907Z",
      "updatedAt": "2025-08-05T17:43:43.907Z"
    }
  ],
  "message": "Cars retrieved successfully",
  "success": true
}
```

### 2. Get Car by ID
**GET** `/api/v1/admin/cars/:id`

Retrieves detailed information for a specific car by its ID. Perfect for prefilling edit forms.

#### Path Parameters
- `id` (number, required): The unique identifier of the car

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/cars/23"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "id": 23,
    "name": "XUV500 W8",
    "maker": "Mahindra",
    "year": 2023,
    "carnumber": "AS83459",
    "price": 1500,
    "insurancePrice": 500,
    "discountedprice": 1000,
    "color": "VIBGROG",
    "transmission": "manual",
    "fuel": "diesel",
    "type": "suv",
    "seats": 7,
    "rcnumber": "",
    "rcimg": "",
    "pollutionimg": "",
    "insuranceimg": "",
    "inmaintainance": false,
    "isavailable": true,
    "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
    "mainimg": "https://example.com/image1.jpg",
      "vendorid": 6,
      "parkingid": 1,
      "catalogId": 5,
      "vendor": {
      "id": 6,
      "name": "Vendor Name",
      "avatar": null,
      "email": "vendor@example.com",
      "number": 9780623415
    },
    "parking": {
      "id": 1,
      "name": "Updated Parking Name",
      "mainimg": "https://example.com/parking.jpg",
      "locality": "Andheri",
      "city": "Mumbai",
      "capacity": 60
    },
    "isapproved": true,
    "ispopular": false,
    "createdAt": "2025-08-10T08:31:13.510Z",
    "updatedAt": "2025-08-10T08:31:13.510Z"
  },
  "message": "Car details retrieved successfully",
  "success": true
}
```

#### Error Response (Car Not Found)
```json
{
  "statusCode": 404,
  "data": null,
  "message": "Car not found",
  "success": false
}
```

### 3. Get Car Statistics
**GET** `/api/v1/admin/cars/stats`

Retrieves car statistics for dashboard cards.

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:5500/api/v1/admin/cars/stats"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "total": 17,
    "available": 17,
    "rented": 0,
    "maintenance": 0,
    "outOfService": 0
  },
  "message": "Car statistics retrieved successfully",
  "success": true
}
```

### 4. Update Car Information
**PUT** `/api/v1/admin/cars/:id`

Updates car information including basic details, catalog information, and vendor/parking assignments. Admin-only endpoint.

#### Path Parameters
- `id` (number): Car ID

#### Request Body
```json
{
  "name": "Updated Car Name",
  "price": 1600,
  "discountedprice": 1200,
  "insuranceAmount": 600,
  "color": "BLUE",
  "carnumber": "NEW123",
  "rcnumber": "RC123456",
  "rcimg": "rc_image_url",
  "pollutionimg": "pollution_image_url",
  "insuranceimg": "insurance_image_url",
  "images": ["image1.jpg", "image2.jpg"],
  "vendorid": 6,
  "parkingid": 1,
  "isavailable": true,
  "inmaintainance": false,
  "status": "available",
  "maker": "Updated Maker",
  "year": 2024,
  "transmission": "automatic",
  "fuel": "petrol",
  "seats": 8,
  "type": "suv",
  "engineCapacity": "2.0L",
  "mileage": "15 kmpl",
  "features": "AC, Power Steering, ABS"
}
```

#### Example Request
```bash
curl -X PUT -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated XUV500 W8", "price": 1600, "color": "BLUE"}' \
  "http://localhost:5500/api/v1/admin/cars/23"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "id": 23,
    "name": "Updated XUV500 W8",
    "maker": "Mahindra",
    "year": 2023,
    "carnumber": "AS83459",
    "price": 1600,
    "insurancePrice": 500,
    "discountedprice": 1000,
    "color": "BLUE",
    "transmission": "manual",
    "fuel": "diesel",
    "type": "suv",
    "seats": 7,
    "vendor": {
      "id": 6,
      "name": "Vendor Name",
      "avatar": null,
      "email": "vendor@example.com",
      "number": 9780623415
    },
    "parking": {
      "id": 1,
      "name": "Updated Parking Name",
      "mainimg": "https://...",
      "locality": "Andheri",
      "city": "Mumbai",
      "capacity": 60
    },
    "isapproved": true,
    "ispopular": false,
    "createdAt": "2025-08-10T08:31:13.510Z",
    "updatedAt": "2025-08-10T08:31:13.510Z"
  },
  "message": "Car updated successfully",
  "success": true
}
```

### 5. Update Car Status
**PUT** `/api/v1/admin/cars/:id/status`

Updates the status of a specific car.

#### Path Parameters
- `id` (number): Car ID

#### Request Body
```json
{
  "status": "available" | "rented" | "maintenance" | "out_of_service"
}
```

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d '{"status": "maintenance"}' \
  "http://localhost:5500/api/v1/admin/cars/7/status"
```

#### Response
```json
{
  "statusCode": 200,
  "data": {
    "id": 7,
    "name": "i20 Sportz",
    "inmaintainance": true,
    "isavailable": false,
    "updatedAt": "2025-09-10T21:30:00.000Z"
  },
  "message": "Car status updated successfully",
  "success": true
}
```

### 6. Delete Car
**DELETE** `/api/v1/admin/cars/:id`

Deletes a specific car from the system.

#### Path Parameters
- `id` (number): Car ID

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  -X DELETE \
  "http://localhost:5500/api/v1/admin/cars/7"
```

#### Response
```json
{
  "statusCode": 200,
  "data": null,
  "message": "Car deleted successfully",
  "success": true
}
```

### 7. Filter Cars by Booking Date Range
**POST** `/api/v1/admin/cars/filter-by-bookings`

Filters cars based on booking date range.

#### Request Body
```json
{
  "startDate": "2025-09-01T00:00:00.000Z",
  "endDate": "2025-09-30T23:59:59.999Z"
}
```

#### Example Request
```bash
curl -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"startDate":"2025-09-01T00:00:00.000Z","endDate":"2025-09-30T23:59:59.999Z"}' \
  "http://localhost:5500/api/v1/admin/cars/filter-by-bookings"
```

#### Response
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": 7,
      "name": "i20 Sportz",
      "maker": "Hyundai",
      "year": 2023,
      "carnumber": "CAR-HI-001",
      "price": 1000,
      "insurancePrice": 500,
      "discountedprice": 850,
      "color": "Phantom Black",
      "transmission": "manual",
      "fuel": "petrol",
      "type": "hatchback",
      "seats": 5,
      "rcnumber": "",
      "rcimg": "",
      "pollutionimg": "",
      "insuranceimg": "",
      "inmaintainance": false,
      "isavailable": true,
      "images": ["image1.jpg", "image2.jpg"],
      "mainimg": "image1.jpg",
      "vendorid": 8,
      "parkingid": 1,
      "isapproved": true,
      "ispopular": false,
      "createdAt": "2025-08-05T17:43:43.907Z",
      "updatedAt": "2025-08-05T17:43:43.907Z"
    }
  ],
  "message": "Cars filtered by booking date range successfully",
  "success": true
}
```

## Data Structure

### Car Object
```typescript
interface Car {
  id: number;
  name: string;
  maker: string;
  year: number;
  carnumber: string;
  price: number;
  insurancePrice: number;
  discountedprice: number;
  color: string;
  transmission: string;
  fuel: string;
  type: string;
  seats: number;
  rcnumber: string;
  rcimg: string;
  pollutionimg: string;
  insuranceimg: string;
  inmaintainance: boolean;
  isavailable: boolean;
  images: string[] | null;
  mainimg: string;
  vendorid: number;
  parkingid: number | null;
  catalogId: number | null;
  isapproved: boolean;
  ispopular: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Car Statistics Object
```typescript
interface CarStats {
  total: number;
  available: number;
  rented: number;
  maintenance: number;
  outOfService: number;
}
```

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "data": null,
  "message": "Start date and end date are required",
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
  "message": "Car not found",
  "success": false
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "data": null,
  "message": "Failed to fetch cars",
  "success": false
}
```

## Features

### Search Functionality
The search parameter searches across:
- Car name
- Car maker (from catalog)
- Car number
- RC number
- Vendor name

### Status Filtering
- `all`: All cars
- `available`: Cars that are available and not in maintenance
- `rented`: Cars that are not available and not in maintenance
- `maintenance`: Cars currently in maintenance
- `out_of_service`: Cars that are not available and not in maintenance

### Popular Cars Filter
Cars with 3 or more bookings are considered popular and can be filtered using the `popularOnly` parameter.

### Date Range Filtering
Cars can be filtered by booking date range using the `startDate` and `endDate` parameters or the dedicated `/filter-by-bookings` endpoint.

### Pagination
Results can be paginated using `limit` and `offset` parameters.

## Integration Notes

This API is designed to work seamlessly with the frontend cars management page, providing all the data needed for:
- Car listing with search and filters
- Statistics cards
- Car details modal
- Status updates
- Car deletion
- Date range filtering for bookings

The response format matches exactly what the frontend expects, ensuring smooth integration.
