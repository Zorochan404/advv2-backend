import { ApiError } from "./apiError";

// PostgreSQL error codes mapping
const POSTGRES_ERROR_CODES: Record<
  string,
  { message: string; statusCode: number; type: string }
> = {
  // Unique constraint violations
  "23505": {
    message: "Duplicate entry found",
    statusCode: 409,
    type: "conflict",
  },

  // Foreign key violations
  "23503": {
    message: "Referenced resource does not exist",
    statusCode: 400,
    type: "badRequest",
  },

  // Not null violations
  "23502": {
    message: "Required field is missing",
    statusCode: 422,
    type: "validationError",
  },

  // Invalid text representation (e.g., invalid UUID, invalid number)
  "22P02": {
    message: "Invalid data format",
    statusCode: 400,
    type: "badRequest",
  },

  // Invalid datetime format
  "22007": {
    message: "Invalid date/time format",
    statusCode: 400,
    type: "badRequest",
  },

  // String data right truncation
  "22001": {
    message: "Data too long for field",
    statusCode: 400,
    type: "badRequest",
  },

  // Division by zero
  "22012": {
    message: "Division by zero",
    statusCode: 400,
    type: "badRequest",
  },

  // Invalid parameter value
  "22023": {
    message: "Invalid parameter value",
    statusCode: 400,
    type: "badRequest",
  },

  // Connection errors
  "08000": {
    message: "Database connection error",
    statusCode: 503,
    type: "serviceUnavailable",
  },

  "08003": {
    message: "Database connection terminated",
    statusCode: 503,
    type: "serviceUnavailable",
  },

  "08006": {
    message: "Database connection failure",
    statusCode: 503,
    type: "serviceUnavailable",
  },

  // Transaction errors
  "25P01": {
    message: "Transaction rollback",
    statusCode: 500,
    type: "internal",
  },

  "25P02": {
    message: "Transaction in progress",
    statusCode: 500,
    type: "internal",
  },

  "25P03": {
    message: "Transaction failed",
    statusCode: 500,
    type: "internal",
  },

  // Lock errors
  "55P03": {
    message: "Lock not available",
    statusCode: 409,
    type: "conflict",
  },

  // Insufficient privileges
  "42501": {
    message: "Insufficient privileges",
    statusCode: 403,
    type: "forbidden",
  },

  // Undefined table
  "42P01": {
    message: "Table does not exist",
    statusCode: 500,
    type: "internal",
  },

  // Undefined column
  "42703": {
    message: "Column does not exist",
    statusCode: 500,
    type: "internal",
  },

  // Undefined function
  "42883": {
    message: "Function does not exist",
    statusCode: 500,
    type: "internal",
  },

  // Syntax error
  "42601": {
    message: "SQL syntax error",
    statusCode: 500,
    type: "internal",
  },

  // Invalid password
  "28P01": {
    message: "Invalid database credentials",
    statusCode: 500,
    type: "internal",
  },

  // Database does not exist
  "3D000": {
    message: "Database does not exist",
    statusCode: 500,
    type: "internal",
  },

  // Schema does not exist
  "3F000": {
    message: "Schema does not exist",
    statusCode: 500,
    type: "internal",
  },
};

// Custom field-specific error messages
const FIELD_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  "23505": {
    // unique_violation
    users_number_role_key:
      "User with this phone number and role already exists",
    users_email_key: "User with this email already exists",
    cars_number_key: "Car with this number already exists",
    parkings_name_key: "Parking with this name already exists",
    bookings_userid_carid_key: "Booking already exists for this user and car",
    reviews_userid_carid_key: "Review already exists for this user and car",
    advertisements_title_key: "Advertisement with this title already exists",
    car_catalog_car_name_key: "Car model with this name already exists",
    topups_name_key: "Topup with this name already exists",
  },
  "23503": {
    // foreign_key_violation
    bookings_userid_fkey: "User does not exist",
    bookings_carid_fkey: "Car does not exist",
    bookings_pickupparkingid_fkey: "Pickup parking does not exist",
    bookings_dropoffparkingid_fkey: "Dropoff parking does not exist",
    cars_vendorid_fkey: "Vendor does not exist",
    cars_parkingid_fkey: "Parking does not exist",
    cars_catalogid_fkey: "Car catalog entry does not exist",
    reviews_userid_fkey: "User does not exist",
    reviews_carid_fkey: "Car does not exist",
    advertisements_createdby_fkey: "User does not exist",
    topups_createdby_fkey: "User does not exist",
    car_catalog_createdby_fkey: "User does not exist",
  },
};

/**
 * Handle database errors and convert them to appropriate ApiError instances
 */
export const handleDatabaseError = (error: any, context?: string): ApiError => {
  const errorCode = error.code;
  const constraint = error.constraint;

  // Check for field-specific error messages first
  if (
    errorCode &&
    constraint &&
    FIELD_ERROR_MESSAGES[errorCode]?.[constraint]
  ) {
    const message = FIELD_ERROR_MESSAGES[errorCode][constraint];
    const statusCode = POSTGRES_ERROR_CODES[errorCode]?.statusCode || 400;

    switch (POSTGRES_ERROR_CODES[errorCode]?.type) {
      case "conflict":
        return ApiError.conflict(message);
      case "badRequest":
        return ApiError.badRequest(message);
      case "validationError":
        return ApiError.validationError(message);
      case "forbidden":
        return ApiError.forbidden(message);
      case "serviceUnavailable":
        return ApiError.serviceUnavailable(message);
      default:
        return new ApiError(statusCode, message);
    }
  }

  // Check for general error codes
  if (errorCode && POSTGRES_ERROR_CODES[errorCode]) {
    const { message, statusCode, type } = POSTGRES_ERROR_CODES[errorCode];

    switch (type) {
      case "conflict":
        return ApiError.conflict(message);
      case "badRequest":
        return ApiError.badRequest(message);
      case "validationError":
        return ApiError.validationError(message);
      case "forbidden":
        return ApiError.forbidden(message);
      case "serviceUnavailable":
        return ApiError.serviceUnavailable(message);
      case "internal":
        return ApiError.internal(message);
      default:
        return new ApiError(statusCode, message);
    }
  }

  // Handle specific error types
  if (error.name === "ValidationError") {
    return ApiError.validationError(error.message);
  }

  if (error.name === "CastError") {
    return ApiError.badRequest("Invalid ID format");
  }

  if (error.code === 11000) {
    // MongoDB duplicate key error
    return ApiError.conflict("Duplicate field value");
  }

  // Log unknown database errors for debugging
  console.error("Unknown database error:", {
    code: error.code,
    message: error.message,
    detail: error.detail,
    constraint: error.constraint,
    table: error.table,
    column: error.column,
    context,
  });

  // Return generic error for unknown database errors
  return ApiError.internal("Database operation failed");
};

/**
 * Wrapper function to handle database operations with automatic error handling
 */
export const withDatabaseErrorHandling = async <T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle database errors
    if (
      error.code &&
      (error.code.startsWith("23") ||
        error.code.startsWith("22") ||
        error.code.startsWith("42"))
    ) {
      throw handleDatabaseError(error, context);
    }

    // For other errors, log and throw generic error
    console.error("Unexpected error in database operation:", error);
    throw ApiError.internal("Database operation failed");
  }
};

/**
 * Decorator for database operations (alternative approach)
 */
export const dbErrorHandler = (context?: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error: any) {
        if (error instanceof ApiError) {
          throw error;
        }

        if (
          error.code &&
          (error.code.startsWith("23") ||
            error.code.startsWith("22") ||
            error.code.startsWith("42"))
        ) {
          throw handleDatabaseError(
            error,
            context || `${target.constructor.name}.${propertyKey}`
          );
        }

        console.error("Unexpected error in database operation:", error);
        throw ApiError.internal("Database operation failed");
      }
    };

    return descriptor;
  };
};
