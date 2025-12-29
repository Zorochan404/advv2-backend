import { Request, Response, NextFunction } from "express";
import { ApiError, ErrorDetails } from "./apiError";

// Validation types
type ValidationRule = {
  field: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "array" | "object";
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
};

type ValidationSchema = {
  body?: ValidationRule[];
  query?: ValidationRule[];
  params?: ValidationRule[];
};

// Validation function
const validateField = (value: any, rule: ValidationRule): string | null => {
  const {
    field,
    required,
    type,
    minLength,
    maxLength,
    min,
    max,
    pattern,
    enum: enumValues,
    custom,
  } = rule;

  // Check if required
  if (required && (value === undefined || value === null || value === "")) {
    return `${field} is required`;
  }

  // Skip validation if value is not provided and not required
  if (value === undefined || value === null) {
    return null;
  }

  // Type validation
  if (type) {
    switch (type) {
      case "string":
        if (typeof value !== "string") {
          return `${field} must be a string`;
        }
        break;
      case "number":
        if (typeof value !== "number" || isNaN(value)) {
          return `${field} must be a number`;
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          return `${field} must be a boolean`;
        }
        break;
      case "array":
        if (!Array.isArray(value)) {
          return `${field} must be an array`;
        }
        break;
      case "object":
        if (
          typeof value !== "object" ||
          Array.isArray(value) ||
          value === null
        ) {
          return `${field} must be an object`;
        }
        break;
    }
  }

  // String-specific validations
  if (typeof value === "string") {
    if (minLength && value.length < minLength) {
      return `${field} must be at least ${minLength} characters long`;
    }
    if (maxLength && value.length > maxLength) {
      return `${field} must be at most ${maxLength} characters long`;
    }
    if (pattern && !pattern.test(value)) {
      return `${field} format is invalid`;
    }
  }

  // Number-specific validations
  if (typeof value === "number") {
    if (min !== undefined && value < min) {
      return `${field} must be at least ${min}`;
    }
    if (max !== undefined && value > max) {
      return `${field} must be at most ${max}`;
    }
  }

  // Array-specific validations
  if (Array.isArray(value)) {
    if (minLength && value.length < minLength) {
      return `${field} must have at least ${minLength} items`;
    }
    if (maxLength && value.length > maxLength) {
      return `${field} must have at most ${maxLength} items`;
    }
  }

  // Enum validation
  if (enumValues && !enumValues.includes(value)) {
    return `${field} must be one of: ${enumValues.join(", ")}`;
  }

  // Custom validation
  if (custom) {
    const result = custom(value);
    if (result !== true) {
      return typeof result === "string" ? result : `${field} is invalid`;
    }
  }

  return null;
};

// Main validation middleware
export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ErrorDetails[] = [];

    // Validate body
    if (schema.body) {
      schema.body.forEach((rule) => {
        const error = validateField(req.body[rule.field], rule);
        if (error) {
          errors.push({
            field: rule.field,
            message: error,
            value: req.body[rule.field],
          });
        }
      });
    }

    // Validate query parameters
    if (schema.query) {
      schema.query.forEach((rule) => {
        const error = validateField(req.query[rule.field], rule);
        if (error) {
          errors.push({
            field: rule.field,
            message: error,
            value: req.query[rule.field],
          });
        }
      });
    }

    // Validate path parameters
    if (schema.params) {
      schema.params.forEach((rule) => {
        const error = validateField(req.params[rule.field], rule);
        if (error) {
          errors.push({
            field: rule.field,
            message: error,
            value: req.params[rule.field],
          });
        }
      });
    }

    if (errors.length > 0) {
      throw ApiError.validationError("Validation failed", errors);
    }

    next();
  };
};

// Common validation rules
export const validationRules = {
  // String validations
  requiredString: (field: string, maxLength?: number): ValidationRule => ({
    field,
    required: true,
    type: "string",
    maxLength,
  }),

  optionalString: (field: string, maxLength?: number): ValidationRule => ({
    field,
    type: "string",
    maxLength,
  }),

  email: (field: string): ValidationRule => ({
    field,
    required: true,
    type: "string",
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  }),

  phone: (field: string): ValidationRule => ({
    field,
    required: true,
    type: "string",
    pattern: /^[0-9]{10}$/,
  }),

  // Number validations
  requiredNumber: (
    field: string,
    min?: number,
    max?: number
  ): ValidationRule => ({
    field,
    required: true,
    type: "number",
    min,
    max,
  }),

  optionalNumber: (
    field: string,
    min?: number,
    max?: number
  ): ValidationRule => ({
    field,
    type: "number",
    min,
    max,
  }),

  // Boolean validations
  requiredBoolean: (field: string): ValidationRule => ({
    field,
    required: true,
    type: "boolean",
  }),

  // Array validations
  requiredArray: (
    field: string,
    minLength?: number,
    maxLength?: number
  ): ValidationRule => ({
    field,
    required: true,
    type: "array",
    minLength,
    maxLength,
  }),

  // Object validations
  requiredObject: (field: string): ValidationRule => ({
    field,
    required: true,
    type: "object",
  }),

  // ID validation
  id: (field: string): ValidationRule => ({
    field,
    required: true,
    type: "string",
    pattern: /^[0-9]+$/,
  }),

  // Enum validation
  enum: (field: string, values: any[]): ValidationRule => ({
    field,
    required: true,
    enum: values,
  }),

  // Custom validation
  custom: (
    field: string,
    validator: (value: any) => boolean | string
  ): ValidationRule => ({
    field,
    required: true,
    custom: validator,
  }),
};

// Common validation schemas
export const commonSchemas = {
  // Pagination schema
  pagination: {
    query: [
      validationRules.optionalNumber("page", 1),
      validationRules.optionalNumber("limit", 1, 100),
    ],
  },

  // ID parameter schema
  idParam: {
    params: [validationRules.id("id")],
  },

  // Search schema
  search: {
    query: [
      validationRules.optionalString("q", 100),
      validationRules.optionalNumber("page", 1),
      validationRules.optionalNumber("limit", 1, 100),
    ],
  },
};
