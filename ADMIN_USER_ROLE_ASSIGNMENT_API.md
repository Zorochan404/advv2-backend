# Admin User Role Assignment API

This document describes the admin user role assignment API endpoint that allows admins to assign roles to multiple users simultaneously.

## Base URL
```
/api/v1/admin/users
```

## Authentication
All endpoints require:
- **JWT Token**: Bearer token in Authorization header
- **Admin Role**: User must have admin role

## Endpoints

### 1. Assign Roles to Multiple Users
**POST** `/api/v1/admin/users/assign-roles`

Assigns a specific role to multiple users by providing an array of user IDs.

#### Request Body
```json
{
  "userIds": [6, 8, 12],
  "role": "vendor"
}
```

#### Parameters
- `userIds` (array of numbers, required): Array of user IDs to assign the role to
- `role` (string, required): The role to assign. Must be one of:
  - `"user"` - Regular user
  - `"admin"` - Administrator
  - `"vendor"` - Car vendor
  - `"parkingincharge"` - Parking in charge (PIC)

#### Example Request
```bash
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"userIds": [6, 8, 12], "role": "vendor"}' \
  "http://localhost:5500/api/v1/admin/users/assign-roles"
```

#### Success Response (200)
```json
{
  "statusCode": 200,
  "data": {
    "message": "Successfully assigned role 'vendor' to 3 user(s)",
    "roleAssignments": [
      {
        "id": 6,
        "name": "John Doe",
        "email": "john@example.com",
        "previousRole": "user",
        "newRole": "vendor",
        "updatedAt": "2025-09-14T09:26:19.814Z"
      },
      {
        "id": 8,
        "name": "Jane Smith",
        "email": "jane@example.com",
        "previousRole": "user",
        "newRole": "vendor",
        "updatedAt": "2025-09-14T09:26:19.814Z"
      },
      {
        "id": 12,
        "name": "Bob Johnson",
        "email": "bob@example.com",
        "previousRole": "admin",
        "newRole": "vendor",
        "updatedAt": "2025-09-14T09:26:19.814Z"
      }
    ],
    "summary": {
      "totalUsers": 3,
      "assignedRole": "vendor",
      "successCount": 3
    }
  },
  "message": "User roles assigned successfully",
  "success": true
}
```

## Data Structures

### Role Assignment Response
```typescript
interface RoleAssignmentResponse {
  message: string;                    // Success message
  roleAssignments: RoleAssignment[];  // Array of role assignments
  summary: AssignmentSummary;         // Summary of the operation
}

interface RoleAssignment {
  id: number;           // User ID
  name: string;         // User name
  email: string;        // User email
  previousRole: string; // Previous role before assignment
  newRole: string;      // New role after assignment
  updatedAt: string;    // Timestamp of the update
}

interface AssignmentSummary {
  totalUsers: number;     // Total number of users processed
  assignedRole: string;   // Role that was assigned
  successCount: number;   // Number of successful assignments
}
```

## Error Responses

### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "message": "Validation failed: userIds: At least one user ID is required",
  "statusCode": 400,
  "timestamp": "2025-09-14T09:24:05.548Z",
  "path": "/users/assign-roles",
  "method": "POST"
}
```

### 400 Bad Request - Invalid Role
```json
{
  "success": false,
  "message": "Validation failed: role: Invalid option: expected one of \"user\"|\"admin\"|\"vendor\"|\"parkingincharge\"",
  "statusCode": 400,
  "timestamp": "2025-09-14T09:26:39.558Z",
  "path": "/users/assign-roles",
  "method": "POST"
}
```

### 400 Bad Request - Empty User IDs
```json
{
  "statusCode": 400,
  "data": null,
  "message": "User IDs array is required and cannot be empty",
  "success": false
}
```

### 400 Bad Request - Invalid Role Value
```json
{
  "statusCode": 400,
  "data": null,
  "message": "Valid role is required (user, admin, vendor, parkingincharge)",
  "success": false
}
```

### 404 Not Found - Users Not Found
```json
{
  "statusCode": 404,
  "data": null,
  "message": "Users not found: 999, 1000",
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
  "message": "Failed to assign user roles",
  "success": false
}
```

## Usage Examples

### Assign Vendor Role to Multiple Users
```bash
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"userIds": [6, 8, 12], "role": "vendor"}' \
  "http://localhost:5500/api/v1/admin/users/assign-roles"
```

### Promote Users to Admin
```bash
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"userIds": [15, 16], "role": "admin"}' \
  "http://localhost:5500/api/v1/admin/users/assign-roles"
```

### Assign Parking In Charge Role
```bash
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"userIds": [20], "role": "parkingincharge"}' \
  "http://localhost:5500/api/v1/admin/users/assign-roles"
```

### Demote Users to Regular User
```bash
curl -X POST \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"userIds": [25, 26, 27], "role": "user"}' \
  "http://localhost:5500/api/v1/admin/users/assign-roles"
```

## Features

### Bulk Role Assignment
- **Multiple Users**: Assign roles to multiple users in a single request
- **Atomic Operation**: All role assignments succeed or fail together
- **Efficient Processing**: Uses batch operations for better performance

### Comprehensive Validation
- **User Existence**: Validates that all provided user IDs exist
- **Role Validation**: Ensures only valid roles are assigned
- **Input Validation**: Validates array format and required fields

### Detailed Response
- **Before/After Tracking**: Shows previous and new roles for each user
- **Operation Summary**: Provides summary statistics of the operation
- **Individual Results**: Details for each user's role assignment

### Error Handling
- **Missing Users**: Identifies which specific user IDs don't exist
- **Validation Errors**: Clear error messages for invalid input
- **Partial Failures**: Prevents partial updates if any user is invalid

## Security Considerations

### Admin Only Access
- **Role-Based Access**: Only users with admin role can assign roles
- **JWT Authentication**: Requires valid authentication token
- **Permission Validation**: Validates admin permissions before processing

### Data Integrity
- **User Validation**: Ensures all users exist before making changes
- **Role Validation**: Prevents assignment of invalid roles
- **Atomic Updates**: All-or-nothing approach prevents partial failures

### Audit Trail
- **Update Timestamps**: Records when role assignments were made
- **Before/After Tracking**: Maintains history of role changes
- **Detailed Logging**: Comprehensive logging for audit purposes

## Integration Notes

This API is designed for admin dashboard integration where:

### User Management Interface
- **Bulk Operations**: Select multiple users and assign roles
- **Role Management**: Easy role assignment for user administration
- **Status Updates**: Real-time feedback on role assignment success

### Admin Workflows
- **User Onboarding**: Assign appropriate roles during user setup
- **Role Changes**: Handle role promotions and demotions
- **Access Management**: Control user access levels across the platform

### Reporting and Analytics
- **Role Distribution**: Track role assignments across the platform
- **Change History**: Monitor role changes over time
- **User Management**: Comprehensive user role administration

The response format provides all necessary data for building comprehensive admin interfaces with real-time role management capabilities.
