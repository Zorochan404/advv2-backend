import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "./apiError";

// Base schemas for common fields
export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9]+$/, "Invalid ID format"),
});

export const carIdParamSchema = z.object({
  carid: z.string().regex(/^[0-9]+$/, "Invalid car ID format"),
});

export const reviewIdParamSchema = z.object({
  reviewid: z.string().regex(/^[0-9]+$/, "Invalid review ID format"),
});

export const parkingIdParamSchema = z.object({
  parkingid: z.string().regex(/^[0-9]+$/, "Invalid parking ID format"),
});

export const bookingIdParamSchema = z.object({
  bookingId: z.string().regex(/^[0-9]+$/, "Invalid booking ID format"),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
  page: z.coerce.number().min(1).default(1),
  sort: z
    .enum(["createdAt", "updatedAt", "rating", "name", "price"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// PIC date filtering schema
export const picDateFilterSchema = z.object({
  startDate: z.string().datetime("Invalid start date format").optional(),
  endDate: z.string().datetime("Invalid end date format").optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  page: z.coerce.number().min(1).default(1),
});

// User schemas
export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email format").optional(),
  number: z.string().regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
  role: z.enum(["admin", "user", "vendor", "parkingincharge"]).default("user"),
  aadharNumber: z.string().optional(),
  dlNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  locality: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.number().optional(),
  avatar: z.string().url("Invalid avatar URL").optional(),
});

export const userUpdateSchema = userCreateSchema.partial();

export const userSearchSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    number: z.string().optional(),
    phone: z.string().optional(),
    role: z.enum(["user", "admin", "vendor", "parkingincharge"]).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    locality: z.string().optional(),
    pincode: z.coerce.number().optional(),
    aadharnumber: z.string().optional(),
    aadhar: z.string().optional(),
    dlnumber: z.string().optional(),
    dl: z.string().optional(),
    passportnumber: z.string().optional(),
    passport: z.string().optional(),
    isverified: z.coerce.boolean().optional(),
    search: z.string().optional(), // For backward compatibility
    // Pagination parameters
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
  })
  .passthrough(); // Allow any additional parameters

export const userRoleSchema = z.object({
  role: z.enum(["admin", "user", "vendor", "parkingincharge"]),
});

export const parkingInchargeAssignSchema = z.object({
  id: z.number().positive("Invalid user ID"),
  parkingid: z.number().positive("Invalid parking ID"),
});

export const parkingInchargeByNumberSchema = z.object({
  number: z.string().regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),
});

// Auth schemas
export const loginSchema = z
  .object({
    number: z.string().regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),
    otp: z
      .string()
      .regex(/^[0-9]{4,6}$/, "OTP must be 4-6 digits")
      .optional(),
    password: z.string().min(1, "Password is required").optional(),
  })
  .refine(
    (data) => {
      // Either otp or password must be provided, but not both
      const hasOtp = !!data.otp;
      const hasPassword = !!data.password;
      return (hasOtp && !hasPassword) || (!hasOtp && hasPassword);
    },
    {
      message: "Either OTP or password must be provided, but not both",
      path: ["otp"],
    }
  );

export const adminRegisterSchema = z.object({
  number: z.string().regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user", "vendor", "parkingincharge"]),
});

export const adminLoginSchema = z.object({
  number: z.string().regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),
  password: z.string().min(1, "Password is required"),
});

// Password update schema
export const passwordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation password do not match",
    path: ["confirmPassword"],
  });

// Car schemas
export const carCreateSchema = z.object({
  name: z.string().min(1, "Car name is required").max(100, "Car name too long"),
  number: z.string().min(1, "Car number is required"),
  // Make price and discountprice optional as they will be inferred from catalog
  price: z.number().positive("Price must be positive").optional(),
  discountprice: z.number().positive("Discount price must be positive").optional(),
  color: z.string().optional(),
  rcnumber: z.string().optional(),
  rcimg: z.string().url("Invalid RC image URL").optional(),
  pollutionimg: z.string().url("Invalid pollution image URL").optional(),
  insuranceimg: z.string().url("Invalid insurance image URL").optional(),
  images: z.array(z.string().url("Invalid image URL")).optional(),
  vendorid: z.number().positive("Invalid vendor ID"),
  parkingid: z.number().positive("Invalid parking ID"),
  catalogId: z.number().positive("Invalid catalog ID").optional(),
  status: z
    .enum(["available", "booked", "maintenance", "unavailable"])
    .default("available"),
});

export const carUpdateSchema = carCreateSchema.partial().extend({
  // Allow updating catalog-related fields
  transmission: z.enum(["manual", "automatic"]).optional(),
  fuel: z.enum(["petrol", "diesel", "electric", "hybrid"]).optional(),
  seats: z.number().int().positive().optional(),
  maker: z.string().optional(),
  year: z.number().int().positive().optional(),
  engineCapacity: z.string().optional(),
  mileage: z.string().optional(),
  features: z.string().optional(),
  category: z
    .enum(["sedan", "hatchback", "suv", "luxury", "electric"])
    .optional(),
});

export const carSearchSchema = z.object({
  search: z.string().min(1, "Search term is required"),
});

export const carFilterSchema = z.object({
  // Basic car fields
  name: z.string().optional(),
  number: z.string().optional(),
  color: z.string().optional(),
  status: z
    .enum(["available", "booked", "maintenance", "unavailable"])
    .optional(),
  price_min: z.coerce.number().positive().optional(),
  price_max: z.coerce.number().positive().optional(),
  discountprice_min: z.coerce.number().positive().optional(),
  discountprice_max: z.coerce.number().positive().optional(),

  // Catalog fields
  maker: z.string().optional(),
  year: z.coerce.number().int().positive().optional(),
  transmission: z.enum(["manual", "automatic"]).optional(),
  fuel: z.enum(["petrol", "diesel", "electric", "hybrid"]).optional(),
  seats: z.coerce.number().int().positive().optional(),
  category: z
    .enum(["sedan", "hatchback", "suv", "luxury", "electric"])
    .optional(),

  // Location fields
  parkingid: z.coerce.number().positive().optional(),
  vendorid: z.coerce.number().positive().optional(),

  // Pagination
  limit: z.coerce.number().min(1).max(50).default(10),
  page: z.coerce.number().min(1).default(1),
  sort: z
    .enum(["name", "price", "createdAt", "updatedAt"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const carLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90, "Invalid latitude"),
  lng: z.coerce.number().min(-180).max(180, "Invalid longitude"),
  radius: z.coerce.number().positive("Radius must be positive").default(500),
  limit: z.coerce.number().positive().max(50).default(3),
  page: z.coerce.number().positive().default(1),
});

export const carLocationFilterSchema = z.object({
  lat: z.coerce.number().min(-90).max(90, "Invalid latitude"),
  lng: z.coerce.number().min(-180).max(180, "Invalid longitude"),
  radius: z.coerce.number().positive("Radius must be positive").default(500),
  limit: z.coerce.number().positive().max(50).default(10),
  page: z.coerce.number().positive().default(1),
  // Date filtering
  startDate: z.string().datetime("Invalid start date format").optional(),
  endDate: z.string().datetime("Invalid end date format").optional(),
  // Category filtering - supports both string (query) and array (JSON body)
  categories: z.union([
    z.string(), // Comma-separated categories from query params
    z.array(z.string()) // Array of categories from JSON body
  ]).optional(),
  category: z.string().optional(), // Single category
  // Additional car filters
  minPrice: z.coerce.number().positive("Min price must be positive").optional(),
  maxPrice: z.coerce.number().positive("Max price must be positive").optional(),
  transmission: z.enum(["manual", "automatic"]).optional(),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid"]).optional(),
  minSeats: z.coerce.number().positive("Min seats must be positive").optional(),
  maxSeats: z.coerce.number().positive("Max seats must be positive").optional(),
  // Car name/number search
  search: z.string().optional(),
});

// Car Catalog schemas
export const carCatalogCreateSchema = z.object({
  carName: z.string().min(1, "Car name is required"),
  carMaker: z.string().min(1, "Car maker is required"),
  carModelYear: z.number().int().positive("Model year must be positive"),
  carVendorPrice: z.number().positive("Vendor price must be positive"),
  carPlatformPrice: z.number().positive("Platform price must be positive"),
  transmission: z.enum(["manual", "automatic"]).default("manual"),
  fuelType: z
    .enum(["petrol", "diesel", "electric", "hybrid"])
    .default("petrol"),
  seats: z.number().int().positive("Seats must be positive").default(5),
  engineCapacity: z.string().optional(),
  mileage: z.string().optional(),
  features: z.string().optional(),
  imageUrl: z.string().url("Invalid image URL").optional(),
  category: z
    .enum(["sedan", "hatchback", "suv", "luxury", "electric"])
    .default("sedan"),
  // Late fee rate removed - users can use topup instead
});

export const carCatalogUpdateSchema = carCatalogCreateSchema.partial();

export const carCatalogFilterSchema = z.object({
  category: z
    .enum(["sedan", "hatchback", "suv", "luxury", "electric"])
    .optional(),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid"]).optional(),
  transmission: z.enum(["manual", "automatic"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

// Parking schemas
export const parkingCreateSchema = z.object({
  name: z.string().min(1, "Parking name is required"),
  locality: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.number().optional(),
  capacity: z.number().positive("Capacity must be positive").optional(),
  mainimg: z.string().url("Invalid main image URL").optional(),
  images: z.array(z.string().url("Invalid image URL")).optional(),
  lat: z.number().min(-90).max(90, "Invalid latitude"),
  lng: z.number().min(-180).max(180, "Invalid longitude"),
});

export const parkingUpdateSchema = parkingCreateSchema.partial();

export const parkingFilterSchema = z.object({
  state: z.string().optional(),
  pincode: z.coerce.number().optional(),
  name: z.string().optional(),
  city: z.string().optional(),
  locality: z.string().optional(),
  country: z.string().optional(),
});

export const parkingLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90, "Invalid latitude"),
  lng: z.coerce.number().min(-180).max(180, "Invalid longitude"),
  radius: z.coerce.number().positive("Radius must be positive").default(500),
  limit: z.coerce.number().min(1).max(50).default(10),
  page: z.coerce.number().min(1).default(1),
});

// Parking approval schemas
export const parkingApprovalCreateSchema = z.object({
  parkingName: z.string().min(1, "Parking name is required"),
  locality: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.number().optional(),
  capacity: z.number().positive("Capacity must be positive"),
  mainimg: z.string().url("Invalid main image URL"),
  images: z.array(z.string().url("Invalid image URL")),
  lat: z.number().min(-90).max(90, "Invalid latitude"),
  lng: z.number().min(-180).max(180, "Invalid longitude"),
});

export const parkingApprovalUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  adminComments: z.string().optional(),
});

export const parkingApprovalFilterSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  userId: z.coerce.number().positive().optional(),
});

// Review schemas
export const reviewCreateSchema = z.object({
  rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z
    .string()
    .min(1, "Comment is required")
    .max(500, "Comment too long"),
});

export const reviewUpdateSchema = reviewCreateSchema;

export const reviewQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(["createdAt", "updatedAt", "rating"]).default("createdAt"),
});

// Booking schemas
export const bookingCreateSchema = z.object({
  carId: z.number().positive("Invalid car ID"),
  startDate: z.string().datetime("Invalid start date"),
  endDate: z.string().datetime("Invalid end date"),
  pickupParkingId: z.number().positive("Invalid pickup parking ID").optional(),
  dropoffParkingId: z
    .number()
    .positive("Invalid dropoff parking ID")
    .optional(),
  deliveryType: z.enum(["pickup", "delivery"]).default("pickup"),
  deliveryAddress: z.string().optional(),
  deliveryCharges: z
    .number()
    .positive("Delivery charges must be positive")
    .optional(),
});

export const bookingPaymentSchema = z.object({
  bookingId: z.number().positive("Invalid booking ID"),
  paymentReferenceId: z.string().min(1, "Payment reference ID is required"),
});

export const bookingConfirmationSchema = z.object({
  bookingId: z.number().positive("Invalid booking ID"),
  carConditionImages: z
    .array(z.string().url("Invalid image URL"))
    .min(1, "At least one image required"),
  tools: z
    .array(
      z.object({
        name: z.string().min(1, "Tool name is required"),
        imageUrl: z.string().url("Invalid tool image URL"),
      })
    )
    .optional(),
});

export const bookingPICApprovalSchema = z.object({
  bookingId: z.number().positive("Invalid booking ID"),
  approved: z.boolean(),
  comments: z.string().optional(),
});

export const bookingOTPVerificationSchema = z.object({
  bookingId: z.number().positive("Invalid booking ID"),
  otp: z.string().regex(/^\d{4}$/, "OTP must be a 4-digit number"),
});

export const bookingResendOTPSchema = z.object({
  bookingId: z.number().positive("Invalid booking ID"),
});

export const bookingRescheduleSchema = z.object({
  newPickupDate: z.string().datetime("Invalid pickup date format"),
  newStartDate: z.string().datetime("Invalid start date format").optional(),
  newEndDate: z.string().datetime("Invalid end date format").optional(),
});

export const bookingCarReturnSchema = z.object({
  bookingId: z.number().positive("Invalid booking ID"),
  returnCondition: z.enum(["good", "fair", "poor"]).optional().default("good"),
  returnImages: z.array(z.string().url("Invalid return image URL")).optional().default([]),
  comments: z.string().max(500, "Comments too long").optional(),
});

// Topup schemas
export const topupCreateSchema = z.object({
  name: z.string().min(1, "Topup name is required"),
  description: z.string().optional(),
  duration: z.number().positive("Duration must be positive"),
  price: z.number().positive("Price must be positive"),
  category: z.enum(["extension", "feature", "service"]).default("extension"),
});

export const topupUpdateSchema = topupCreateSchema.partial();

export const topupApplySchema = z.object({
  bookingId: z.coerce.number().positive("Invalid booking ID"),
  topupId: z.coerce.number().positive("Invalid topup ID"),
  paymentReferenceId: z.string().min(1, "Payment reference ID is required"),
});

// Late fee payment schema removed - users should use topup instead

export const earningsOverviewSchema = z.object({
  startDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      // Handle various date formats
      let date: Date;
      if (val.includes("T")) {
        // ISO format
        date = new Date(val);
      } else {
        // Simple date format (YYYY-MM-DD)
        date = new Date(val + "T00:00:00.000Z");
      }
      return isNaN(date.getTime()) ? undefined : date;
    }),
  endDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      // Handle various date formats
      let date: Date;
      if (val.includes("T")) {
        // ISO format
        date = new Date(val);
      } else {
        // Simple date format (YYYY-MM-DD)
        date = new Date(val + "T23:59:59.999Z");
      }
      return isNaN(date.getTime()) ? undefined : date;
    }),
});

// Advertisement schemas
export const advertisementCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description too long"),
  imageUrl: z.string().url("Invalid image URL"),
  linkUrl: z.string().url("Invalid link URL").optional(),
  adType: z.enum(["banner", "popup", "carousel"]).default("banner"),
  startDate: z.string().datetime("Invalid start date"),
  endDate: z.string().datetime("Invalid end date"),
  isActive: z.boolean().default(true),
});

export const advertisementUpdateSchema = advertisementCreateSchema.partial();

export const advertisementFilterSchema = z.object({
  status: z.enum(["active", "inactive", "expired"]).optional(),
  adType: z.enum(["banner", "popup", "carousel"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  location: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
});

// Validation middleware
export const validateRequest = <T extends z.ZodSchema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let data: any;

      // Validate based on request type
      if (req.method === "GET") {
        data = { ...req.params, ...req.query };
      } else {
        data = { ...req.params, ...req.body };
      }

      const result = schema.safeParse(data);

      if (!result.success) {
        const errorMessages = result.error.issues
          .map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");
        const validationError = ApiError.badRequest(
          `Validation failed: ${errorMessages}`
        );

        // Check if headers have already been sent
        if (!res.headersSent) {
          return res.status(validationError.statusCode).json({
            success: false,
            message: validationError.message,
            statusCode: validationError.statusCode,
            timestamp: new Date(),
            path: req.path,
            method: req.method,
          });
        }
      } else {
        // Replace request data with validated data
        Object.assign(req, result.data);
        next();
      }
    } catch (error) {
      const genericError = ApiError.badRequest("Invalid request data");

      // Check if headers have already been sent
      if (!res.headersSent) {
        return res.status(genericError.statusCode).json({
          success: false,
          message: genericError.message,
          statusCode: genericError.statusCode,
          timestamp: new Date(),
          path: req.path,
          method: req.method,
        });
      }
    }
  };
};

// Type exports for use in controllers
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type CarCreateInput = z.infer<typeof carCreateSchema>;
export type CarUpdateInput = z.infer<typeof carUpdateSchema>;
export type CarCatalogCreateInput = z.infer<typeof carCatalogCreateSchema>;
export type CarCatalogUpdateInput = z.infer<typeof carCatalogUpdateSchema>;
export type ParkingCreateInput = z.infer<typeof parkingCreateSchema>;
export type ParkingUpdateInput = z.infer<typeof parkingUpdateSchema>;
export type ParkingApprovalCreateInput = z.infer<
  typeof parkingApprovalCreateSchema
>;
export type ParkingApprovalUpdateInput = z.infer<
  typeof parkingApprovalUpdateSchema
>;
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type TopupCreateInput = z.infer<typeof topupCreateSchema>;
export type TopupUpdateInput = z.infer<typeof topupUpdateSchema>;
export type AdvertisementCreateInput = z.infer<
  typeof advertisementCreateSchema
>;
export type AdvertisementUpdateInput = z.infer<
  typeof advertisementUpdateSchema
>;
