interface ErrorDetails {
  field?: string;
  message: string;
  value?: any;
}

class ApiError extends Error {
  statusCode: number;
  data: any;
  message: string;
  success: boolean;
  errors: ErrorDetails[];
  isOperational: boolean;
  timestamp: Date;

  constructor(
    statusCode: number,
    message: string = "Something went wrong",
    errors: ErrorDetails[] = [],
    stack: string = "",
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Static methods for common error types
  static badRequest(
    message: string = "Bad Request",
    errors: ErrorDetails[] = []
  ) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(
    message: string = "Unauthorized",
    errors: ErrorDetails[] = []
  ) {
    return new ApiError(401, message, errors);
  }

  static forbidden(message: string = "Forbidden", errors: ErrorDetails[] = []) {
    return new ApiError(403, message, errors);
  }

  static notFound(
    message: string = "Resource not found",
    errors: ErrorDetails[] = []
  ) {
    return new ApiError(404, message, errors);
  }

  static conflict(
    message: string = "Resource conflict",
    errors: ErrorDetails[] = []
  ) {
    return new ApiError(409, message, errors);
  }

  static validationError(
    message: string = "Validation failed",
    errors: ErrorDetails[] = []
  ) {
    return new ApiError(422, message, errors);
  }

  static internal(
    message: string = "Internal Server Error",
    errors: ErrorDetails[] = []
  ) {
    return new ApiError(500, message, errors, "", false);
  }

  static serviceUnavailable(
    message: string = "Service Unavailable",
    errors: ErrorDetails[] = []
  ) {
    return new ApiError(503, message, errors, "", false);
  }

  // Method to add field-specific errors
  addError(field: string, message: string, value?: any) {
    this.errors.push({ field, message, value });
    return this;
  }

  // Method to check if error is operational
  isOperationalError(): boolean {
    return this.isOperational;
  }
}

export { ApiError, ErrorDetails };
