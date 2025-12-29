interface ResponseMetadata {
  timestamp: Date;
  path: string;
  method: string;
  duration?: number;
}

class ApiResponse {
  statusCode: number;
  data: any;
  message: string;
  success: boolean;
  metadata?: ResponseMetadata;

  constructor(
    statusCode: number,
    data: any,
    message: string = "Success",
    metadata?: ResponseMetadata
  ) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    this.metadata = metadata;
  }

  // Static methods for common response types
  static success(
    data: any,
    message: string = "Success",
    metadata?: ResponseMetadata
  ) {
    return new ApiResponse(200, data, message, metadata);
  }

  static created(
    data: any,
    message: string = "Resource created successfully",
    metadata?: ResponseMetadata
  ) {
    return new ApiResponse(201, data, message, metadata);
  }

  static noContent(
    message: string = "No content",
    metadata?: ResponseMetadata
  ) {
    return new ApiResponse(204, null, message, metadata);
  }

  static accepted(
    data: any,
    message: string = "Request accepted",
    metadata?: ResponseMetadata
  ) {
    return new ApiResponse(202, data, message, metadata);
  }

  // Method to add metadata
  addMetadata(metadata: Partial<ResponseMetadata>) {
    this.metadata = { ...this.metadata, ...metadata } as ResponseMetadata;
    return this;
  }

  // Method to set response duration
  setDuration(duration: number) {
    if (!this.metadata) {
      this.metadata = {
        timestamp: new Date(),
        path: "",
        method: "",
      };
    }
    this.metadata.duration = duration;
    return this;
  }
}

export { ApiResponse, ResponseMetadata };
