import { Request, Response } from "express";
import { ApiResponse, ResponseMetadata } from "./apiResponse";

// Response handler class
export class ResponseHandler {
  private req: Request;
  private res: Response;
  private startTime: number;

  constructor(req: Request, res: Response) {
    this.req = req;
    this.res = res;
    this.startTime = Date.now();
  }

  // Success responses
  success(data: any, message: string = "Success") {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.success(data, message, metadata);
    return this.res.status(response.statusCode).json(response);
  }

  created(data: any, message: string = "Resource created successfully") {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.created(data, message, metadata);
    return this.res.status(response.statusCode).json(response);
  }

  noContent(message: string = "No content") {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.noContent(message, metadata);
    return this.res.status(response.statusCode).json(response);
  }

  accepted(data: any, message: string = "Request accepted") {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.accepted(data, message, metadata);
    return this.res.status(response.statusCode).json(response);
  }

  // Paginated response
  paginated(
    data: any[],
    total: number,
    page: number,
    limit: number,
    message: string = "Data retrieved successfully"
  ) {
    const duration = Date.now() - this.startTime;
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const pagination = {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : null,
      prevPage: hasPrev ? page - 1 : null,
    };

    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.success(
      {
        data,
        pagination,
      },
      message,
      metadata
    );

    return this.res.status(response.statusCode).json(response);
  }

  // List response with count
  list(
    data: any[],
    total: number,
    message: string = "Data retrieved successfully"
  ) {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.success(
      {
        data,
        total,
      },
      message,
      metadata
    );

    return this.res.status(response.statusCode).json(response);
  }

  // Single item response
  item(data: any, message: string = "Item retrieved successfully") {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.success(data, message, metadata);
    return this.res.status(response.statusCode).json(response);
  }

  // Delete response
  deleted(message: string = "Resource deleted successfully") {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.success(null, message, metadata);
    return this.res.status(response.statusCode).json(response);
  }

  // Update response
  updated(data: any, message: string = "Resource updated successfully") {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = ApiResponse.success(data, message, metadata);
    return this.res.status(response.statusCode).json(response);
  }

  // Custom response
  custom(statusCode: number, data: any, message: string) {
    const duration = Date.now() - this.startTime;
    const metadata: ResponseMetadata = {
      timestamp: new Date(),
      path: this.req.path,
      method: this.req.method,
      duration,
    };

    const response = new ApiResponse(statusCode, data, message, metadata);
    return this.res.status(response.statusCode).json(response);
  }
}

// Factory function to create response handler
export const createResponseHandler = (req: Request, res: Response) => {
  return new ResponseHandler(req, res);
};

// Express middleware to attach response handler
export const responseHandlerMiddleware = (
  req: Request,
  res: Response,
  next: any
) => {
  (req as any).response = createResponseHandler(req, res);
  next();
};

// Simple response helper functions for common use cases
export const sendSuccess = (
  res: Response,
  data: any,
  message: string = "Success",
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    statusCode,
  });
};

export const sendCreated = (
  res: Response,
  data: any,
  message: string = "Resource created successfully"
) => {
  return sendSuccess(res, data, message, 201);
};

export const sendUpdated = (
  res: Response,
  data: any,
  message: string = "Resource updated successfully"
) => {
  return sendSuccess(res, data, message, 200);
};

export const sendDeleted = (
  res: Response,
  message: string = "Resource deleted successfully"
) => {
  return sendSuccess(res, null, message, 200);
};

export const sendItem = (
  res: Response,
  data: any,
  message: string = "Item retrieved successfully"
) => {
  return sendSuccess(res, data, message, 200);
};

export const sendList = (
  res: Response,
  data: any[],
  total: number,
  message: string = "Data retrieved successfully"
) => {
  return sendSuccess(res, { data, total }, message, 200);
};

export const sendPaginated = (
  res: Response,
  data: any[],
  total: number,
  page: number,
  limit: number,
  message: string = "Data retrieved successfully"
) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const pagination = {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null,
  };

  return sendSuccess(res, { data, pagination }, message, 200);
};
