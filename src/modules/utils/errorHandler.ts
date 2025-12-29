import { Request, Response, NextFunction } from "express";
import { ApiError, ErrorDetails } from "./apiError";
import { ApiResponse } from "./apiResponse";

interface ErrorResponse {
  success: boolean;
  message: string;
  errors?: ErrorDetails[];
  stack?: string;
  timestamp: Date;
  path: string;
  method: string;
  statusCode: number;
}

// Custom error logger
const logError = (error: ApiError, req: Request) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    statusCode: error.statusCode,
    message: error.message,
    stack: error.stack,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    userId: (req as any).user?.id || "anonymous",
  };

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("🚨 Error Log:", JSON.stringify(errorLog, null, 2));
  }

  // In production, you might want to log to a file or external service
  // logger.error(errorLog);
};

// Validation error formatter
const formatValidationErrors = (error: any): ErrorDetails[] => {
  if (error.errors && Array.isArray(error.errors)) {
    return error.errors.map((err: any) => ({
      field: err.path || err.field,
      message: err.message,
      value: err.value,
    }));
  }
  return [];
};

// Database error handler
const handleDatabaseError = (error: any): ApiError => {
  // PostgreSQL specific errors
  if (error.code === "23505") {
    // unique_violation
    return ApiError.conflict("Duplicate entry found");
  }

  if (error.code === "23503") {
    // foreign_key_violation
    return ApiError.badRequest("Referenced resource does not exist");
  }

  if (error.code === "23502") {
    // not_null_violation
    return ApiError.validationError("Required field is missing");
  }

  if (error.code === "22P02") {
    // invalid_text_representation
    return ApiError.badRequest("Invalid data format");
  }

  return ApiError.internal("Database operation failed");
};

// JWT error handler
const handleJWTError = (error: any): ApiError => {
  if (error.name === "JsonWebTokenError") {
    return ApiError.unauthorized("Invalid token");
  }

  if (error.name === "TokenExpiredError") {
    return ApiError.unauthorized("Token expired");
  }

  if (error.name === "NotBeforeError") {
    return ApiError.unauthorized("Token not active");
  }

  return ApiError.unauthorized("Token verification failed");
};

// Rate limiting error handler
const handleRateLimitError = (error: any): ApiError => {
  return ApiError.badRequest("Too many requests, please try again later");
};

// Main error handler middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let apiError: ApiError;
  let statusCode = 500;
  let message = "Internal Server Error";
  let errors: ErrorDetails[] = [];

  // Handle different types of errors
  if (error instanceof ApiError) {
    apiError = error;
    statusCode = error.statusCode;
    message = error.message;
    errors = error.errors;
  } else if (error.name === "ValidationError") {
    apiError = ApiError.validationError(
      "Validation failed",
      formatValidationErrors(error)
    );
    statusCode = 422;
    message = "Validation failed";
    errors = apiError.errors;
  } else if (error.name === "CastError") {
    apiError = ApiError.badRequest("Invalid ID format");
    statusCode = 400;
    message = "Invalid ID format";
  } else if (error.code && error.code.startsWith("23")) {
    apiError = handleDatabaseError(error);
    statusCode = apiError.statusCode;
    message = apiError.message;
    errors = apiError.errors;
  } else if (error.name && error.name.includes("JsonWebToken")) {
    apiError = handleJWTError(error);
    statusCode = apiError.statusCode;
    message = apiError.message;
    errors = apiError.errors;
  } else if (error.type === "entity.too.large") {
    apiError = ApiError.badRequest("Request entity too large");
    statusCode = 413;
    message = "Request entity too large";
  } else if (error.type === "entity.parse.failed") {
    apiError = ApiError.badRequest("Invalid JSON format");
    statusCode = 400;
    message = "Invalid JSON format";
  } else if (error.code === "LIMIT_FILE_SIZE") {
    apiError = ApiError.badRequest("File too large");
    statusCode = 413;
    message = "File too large";
  } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
    apiError = ApiError.badRequest("Unexpected file field");
    statusCode = 400;
    message = "Unexpected file field";
  } else {
    // Unknown error
    apiError = ApiError.internal("Something went wrong");
    statusCode = 500;
    message = "Something went wrong";
  }

  // Log the error
  logError(apiError, req);

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    message,
    statusCode,
    timestamp: new Date(),
    path: req.path,
    method: req.method,
  };

  // Add errors array if there are validation errors
  if (errors.length > 0) {
    errorResponse.errors = errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = error.stack;
  }

  // Send error response
  if (!res.headersSent) {
    res.status(statusCode).json(errorResponse);
  }
};

// 404 handler for undefined routes
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = ApiError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};

// Graceful shutdown handler
export const gracefulShutdown = (server: any) => {
  return (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    server.close(() => {
      console.log("✅ Server closed successfully");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error(
        "❌ Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 10000);
  };
};

// Unhandled rejection handler
export const handleUnhandledRejection = (
  reason: any,
  promise: Promise<any>
) => {
  console.error("🚨 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
};

// Uncaught exception handler
export const handleUncaughtException = (error: Error) => {
  console.error("🚨 Uncaught Exception:", error);
  process.exit(1);
};
