# Error Handling System Documentation

This document describes the comprehensive error handling system implemented in the application.

## Overview

The error handling system provides:

- **Consistent error responses** across all endpoints
- **Detailed error logging** with context information
- **Graceful error recovery** and proper HTTP status codes
- **Validation utilities** for request data
- **Global error handling** middleware
- **Security features** like rate limiting and CORS

## Components

### 1. ApiError Class (`apiError.ts`)

Enhanced error class with static methods for common error types:

```typescript
// Common error types
throw ApiError.badRequest("Invalid input");
throw ApiError.unauthorized("Authentication required");
throw ApiError.forbidden("Access denied");
throw ApiError.notFound("Resource not found");
throw ApiError.conflict("Resource conflict");
throw ApiError.validationError("Validation failed", errors);
throw ApiError.internal("Server error");
throw ApiError.serviceUnavailable("Service unavailable");

// Adding field-specific errors
const error = ApiError.validationError("Validation failed");
error.addError("email", "Invalid email format", "invalid@email");
error.addError("password", "Password too short", "123");
```

### 2. ApiResponse Class (`apiResponse.ts`)

Enhanced response class with metadata support:

```typescript
// Common response types
ApiResponse.success(data, message, metadata);
ApiResponse.created(data, message, metadata);
ApiResponse.noContent(message, metadata);
ApiResponse.accepted(data, message, metadata);

// Adding metadata
const response = ApiResponse.success(data, "Success");
response.addMetadata({ path: "/api/users", method: "GET" });
response.setDuration(150); // milliseconds
```

### 3. AsyncHandler (`asyncHandler.ts`)

Enhanced async handler with automatic error conversion:

```typescript
// Automatically converts common errors to ApiError
const controller = asyncHandler(async (req, res) => {
  // Your controller logic
  // Errors are automatically handled
});
```

### 4. Global Error Handler (`errorHandler.ts`)

Comprehensive error handling middleware:

**Features:**

- Handles different error types (database, JWT, validation, etc.)
- Provides detailed error logging
- Returns consistent error responses
- Includes stack traces in development
- Graceful shutdown handling

**Error Types Handled:**

- `ApiError` instances
- Database errors (PostgreSQL specific)
- JWT errors
- Validation errors
- File upload errors
- Rate limiting errors

### 5. Validation System (`validator.ts`)

Request validation utilities:

```typescript
// Validation rules
const schema = {
  body: [
    validationRules.requiredString("name", 100),
    validationRules.email("email"),
    validationRules.requiredNumber("age", 1, 120),
    validationRules.enum("role", ["admin", "user", "vendor"]),
    validationRules.custom("password", (value) => {
      return value.length >= 8 ? true : "Password too short";
    }),
  ],
  query: [
    validationRules.optionalNumber("page", 1),
    validationRules.optionalNumber("limit", 1, 100),
  ],
};

// Apply validation middleware
router.post("/users", validateRequest(schema), createUser);
```

**Common Validation Rules:**

- `requiredString(field, maxLength?)`
- `optionalString(field, maxLength?)`
- `email(field)`
- `phone(field)`
- `requiredNumber(field, min?, max?)`
- `optionalNumber(field, min?, max?)`
- `requiredBoolean(field)`
- `requiredArray(field, minLength?, maxLength?)`
- `requiredObject(field)`
- `id(field)`
- `enum(field, values[])`
- `custom(field, validator)`

**Common Schemas:**

- `commonSchemas.pagination` - For paginated endpoints
- `commonSchemas.idParam` - For ID parameters
- `commonSchemas.search` - For search endpoints

### 6. Response Handler (`responseHandler.ts`)

Consistent response handling with metadata:

```typescript
// In your controller
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const response = (req as any).response;

  // Different response types
  response.success(data, "Users retrieved successfully");
  response.created(data, "User created successfully");
  response.paginated(data, total, page, limit, "Users retrieved");
  response.list(data, total, "Users retrieved");
  response.item(data, "User retrieved");
  response.deleted("User deleted successfully");
  response.updated(data, "User updated successfully");
  response.custom(202, data, "Request accepted");
});
```

## Usage Examples

### 1. Controller with Validation

```typescript
import { validateRequest, validationRules } from "../utils/validator";
import { asyncHandler } from "../utils/asyncHandler";

const createUserSchema = {
  body: [
    validationRules.requiredString("name", 100),
    validationRules.email("email"),
    validationRules.requiredNumber("age", 1, 120),
    validationRules.enum("role", ["admin", "user", "vendor"]),
  ],
};

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const response = (req as any).response;

  // Your logic here
  const user = await createUserInDB(req.body);

  return response.created(user, "User created successfully");
});

// Apply validation middleware
router.post("/users", validateRequest(createUserSchema), createUser);
```

### 2. Error Handling in Controllers

```typescript
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const response = (req as any).response;

  // Validate ID
  if (!id || !/^[0-9]+$/.test(id)) {
    throw ApiError.badRequest("Invalid user ID");
  }

  const user = await db
    .select()
    .from(UserTable)
    .where(eq(UserTable.id, parseInt(id)));

  if (user.length === 0) {
    throw ApiError.notFound("User not found");
  }

  return response.item(user[0], "User retrieved successfully");
});
```

### 3. Database Error Handling

```typescript
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = await db.insert(UserTable).values(req.body).returning();
    return response.created(user[0], "User created successfully");
  } catch (error: any) {
    // Handle specific database errors
    if (error.code === "23505") {
      // unique_violation
      throw ApiError.conflict("User with this email already exists");
    }

    if (error.code === "23503") {
      // foreign_key_violation
      throw ApiError.badRequest("Referenced resource does not exist");
    }

    // Re-throw ApiError instances
    if (error instanceof ApiError) {
      throw error;
    }

    // Log and throw generic error
    console.error("Database error:", error);
    throw ApiError.internal("Failed to create user");
  }
});
```

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message",
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users",
  "method": "POST",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "invalid@email"
    }
  ]
}
```

## Success Response Format

All success responses follow this format:

```json
{
  "success": true,
  "message": "Success message",
  "data": { ... },
  "statusCode": 200,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "path": "/api/users",
    "method": "GET",
    "duration": 150
  }
}
```

## Security Features

### Rate Limiting

- 100 requests per 15 minutes per IP
- Configurable limits and windows
- Custom error messages

### CORS Configuration

- Configurable origins
- Credentials support
- Method and header restrictions

### Helmet Security

- Content Security Policy
- XSS protection
- Frame options
- And more security headers

## Logging

### Request Logging

- Logs all incoming requests with timestamp
- Logs response status and duration
- Uses emojis for quick visual identification

### Error Logging

- Detailed error context
- User information (if available)
- Request details
- Stack traces in development

## Health Check

The application includes a health check endpoint:

```
GET /health
```

Returns:

```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "environment": "development"
}
```

## Best Practices

1. **Always use asyncHandler** for controller functions
2. **Use specific error types** (badRequest, unauthorized, etc.)
3. **Validate input data** using the validation system
4. **Handle database errors** specifically
5. **Log unexpected errors** for debugging
6. **Use response handler** for consistent responses
7. **Add field-specific errors** for validation failures
8. **Include metadata** in responses when useful

## Environment Variables

```env
NODE_ENV=development|production
PORT=5500
ACCESS_TOKEN_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

This error handling system provides a robust foundation for building reliable APIs with proper error management, validation, and security features.
