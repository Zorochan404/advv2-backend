import { NextFunction, Request, Response } from "express";
import { ApiError } from "./apiError";

type AsyncFunction<T = Request> = (
  req: T,
  res: Response,
  next: NextFunction
) => Promise<any>;

const asyncHandler = <T = Request>(requestHandler: AsyncFunction<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(requestHandler(req as T, res, next)).catch((err: any) => {
      // Check if headers have already been sent
      if (res.headersSent) {
        return;
      }

      // If it's already an ApiError, pass it through
      if (err instanceof ApiError) {
        return next(err);
      }

      // If it's a known error type, convert it to ApiError
      if (err.name === "ValidationError") {
        return next(ApiError.validationError(err.message));
      }

      if (err.name === "CastError") {
        return next(ApiError.badRequest("Invalid ID format"));
      }

      if (err.code === 11000) {
        return next(ApiError.conflict("Duplicate field value"));
      }

      // For unknown errors, log them and return internal server error
      console.error("Unhandled error:", err);
      return next(ApiError.internal("Something went wrong"));
    });
  };
};

export { asyncHandler };
