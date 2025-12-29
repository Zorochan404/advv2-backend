import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";

// Define all roles in the system
export enum Role {
  USER = "user",
  VENDOR = "vendor", 
  PIC = "parkingincharge",
  ADMIN = "admin"
}

// Define permissions for different actions
export enum Permission {
  // User management
  CREATE_USER = "create:user",
  READ_USER = "read:user",
  UPDATE_USER = "update:user",
  DELETE_USER = "delete:user",
  
  // Car management
  CREATE_CAR = "create:car",
  READ_CAR = "read:car",
  UPDATE_CAR = "update:car",
  DELETE_CAR = "delete:car",
  
  // Booking management
  CREATE_BOOKING = "create:booking",
  READ_BOOKING = "read:booking",
  UPDATE_BOOKING = "update:booking",
  DELETE_BOOKING = "delete:booking",
  MANAGE_BOOKING_PAYMENTS = "manage:booking:payments",
  
  // Payment management
  CREATE_PAYMENT = "create:payment",
  READ_PAYMENT = "read:payment",
  UPDATE_PAYMENT = "update:payment",
  DELETE_PAYMENT = "delete:payment",
  
  // PIC operations
  CONFIRM_PICKUP = "confirm:pickup",
  CONFIRM_RETURN = "confirm:return",
  VERIFY_OTP = "verify:otp",
  
  // Parking management
  CREATE_PARKING = "create:parking",
  READ_PARKING = "read:parking",
  UPDATE_PARKING = "update:parking",
  DELETE_PARKING = "delete:parking",
  
  // Review management
  CREATE_REVIEW = "create:review",
  READ_REVIEW = "read:review",
  UPDATE_REVIEW = "update:review",
  DELETE_REVIEW = "delete:review",
  
  // Advertisement management
  CREATE_ADVERTISEMENT = "create:advertisement",
  READ_ADVERTISEMENT = "read:advertisement",
  UPDATE_ADVERTISEMENT = "update:advertisement",
  DELETE_ADVERTISEMENT = "delete:advertisement",
  
  // System operations
  SEED_DATA = "seed:data",
  MIGRATE_DATA = "migrate:data",
  VIEW_ANALYTICS = "view:analytics",
  
  // Resource ownership
  ACCESS_OWN_RESOURCES = "access:own:resources",
  ACCESS_ALL_RESOURCES = "access:all:resources"
}

// Role-Permission mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.CREATE_BOOKING,
    Permission.READ_BOOKING,
    Permission.UPDATE_BOOKING,
    Permission.DELETE_BOOKING,
    Permission.MANAGE_BOOKING_PAYMENTS,
    Permission.CREATE_REVIEW,
    Permission.READ_REVIEW,
    Permission.UPDATE_REVIEW,
    Permission.DELETE_REVIEW,
    Permission.READ_CAR,
    Permission.READ_PARKING,
    Permission.READ_ADVERTISEMENT,
    Permission.ACCESS_OWN_RESOURCES,
    Permission.UPDATE_USER, // Can update own profile only
  ],
  
  [Role.VENDOR]: [
    Permission.CREATE_CAR,
    Permission.READ_CAR,
    Permission.UPDATE_CAR,
    Permission.DELETE_CAR,
    Permission.READ_PARKING,
    Permission.READ_BOOKING, // Can see bookings for their cars
    Permission.READ_REVIEW,
    Permission.READ_ADVERTISEMENT,
    Permission.ACCESS_OWN_RESOURCES,
    Permission.UPDATE_USER, // Can update own profile only
  ],
  
  [Role.PIC]: [
    Permission.CONFIRM_PICKUP,
    Permission.CONFIRM_RETURN,
    Permission.VERIFY_OTP,
    Permission.READ_BOOKING, // Can see bookings for their parking lot
    Permission.UPDATE_BOOKING, // Can approve/reject bookings in their parking lot
    Permission.READ_CAR, // Can see cars in their parking lot
    Permission.READ_PARKING,
    Permission.READ_ADVERTISEMENT,
    Permission.ACCESS_OWN_RESOURCES,
    Permission.UPDATE_USER, // Can update own profile only
  ],
  
  [Role.ADMIN]: [
    // Users
    Permission.CREATE_USER,
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    
    // Cars
    Permission.CREATE_CAR,
    Permission.READ_CAR,
    Permission.UPDATE_CAR,
    Permission.DELETE_CAR,
    
    // Bookings
    Permission.READ_BOOKING,
    Permission.UPDATE_BOOKING,
    Permission.DELETE_BOOKING,
    
    // Parking
    Permission.CREATE_PARKING,
    Permission.READ_PARKING,
    Permission.UPDATE_PARKING,
    Permission.DELETE_PARKING,
    
    // Advertisements
    Permission.CREATE_ADVERTISEMENT,
    Permission.READ_ADVERTISEMENT,
    Permission.UPDATE_ADVERTISEMENT,
    Permission.DELETE_ADVERTISEMENT,
    
    // Reviews (moderation)
    Permission.READ_REVIEW,
    Permission.DELETE_REVIEW,
    
    // System
    Permission.SEED_DATA,
    Permission.MIGRATE_DATA,
    Permission.VIEW_ANALYTICS,
    Permission.ACCESS_ALL_RESOURCES,
  ],
};

// Helper function to check if user has permission
export const hasPermission = (userRole: string, permission: Permission): boolean => {
  if (!Object.values(Role).includes(userRole as Role)) {
    return false;
  }
  
  const role = userRole as Role;
  return ROLE_PERMISSIONS[role].includes(permission);
};

// Helper function to check if user can access resource
export const canAccessResource = (
  user: any, 
  resourceUserId?: number, 
  resourceVendorId?: number,
  resourceParkingId?: number
): boolean => {
  // Admin can access everything
  if (user.role === Role.ADMIN) {
    return true;
  }
  
  // Users can access their own resources
  if (resourceUserId && user.id === resourceUserId) {
    return true;
  }
  
  // Vendors can access resources related to their cars
  if (user.role === Role.VENDOR && resourceVendorId && user.id === resourceVendorId) {
    return true;
  }
  
  // PICs can access resources related to their parking lot
  if (user.role === Role.PIC && resourceParkingId && user.parkingid === resourceParkingId) {
    return true;
  }
  
  return false;
};

// Main RBAC middleware
export const requirePermission = (permission: Permission) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      throw new ApiError(401, "Authentication required");
    }
    
    if (!hasPermission(user.role, permission)) {
      throw new ApiError(403, `Access denied. Required permission: ${permission}`);
    }
    
    next();
  });
};

// Resource ownership middleware
export const requireResourceAccess = (options: {
  userIdParam?: string;
  vendorIdParam?: string;
  parkingIdParam?: string;
  checkOwnership?: boolean;
} = {}) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      throw new ApiError(401, "Authentication required");
    }
    
    // Admin has access to everything
    if (user.role === Role.ADMIN) {
      return next();
    }
    
    if (options.checkOwnership) {
      const resourceUserId = options.userIdParam ? parseInt(req.params[options.userIdParam]) : undefined;
      const resourceVendorId = options.vendorIdParam ? parseInt(req.params[options.vendorIdParam]) : undefined;
      const resourceParkingId = options.parkingIdParam ? parseInt(req.params[options.parkingIdParam]) : undefined;
      
      if (!canAccessResource(user, resourceUserId, resourceVendorId, resourceParkingId)) {
        throw new ApiError(403, "You can only access your own resources");
      }
    }
    
    next();
  });
};

// Convenient role-based middleware (for backward compatibility)
export const requireRole = (allowedRoles: Role[]) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      throw new ApiError(401, "Authentication required");
    }
    
    if (!allowedRoles.includes(user.role as Role)) {
      throw new ApiError(403, `Access denied. Required roles: ${allowedRoles.join(", ")}`);
    }
    
    next();
  });
};

// Specific role middlewares for common cases
export const requireUser = requireRole([Role.USER]);
export const requireVendor = requireRole([Role.VENDOR]);
export const requirePIC = requireRole([Role.PIC]);
export const requireAdmin = requireRole([Role.ADMIN]);
export const requireVendorOrAdmin = requireRole([Role.VENDOR, Role.ADMIN]);
export const requirePICOrAdmin = requireRole([Role.PIC, Role.ADMIN]);

// Combined permission and ownership check
export const requirePermissionAndOwnership = (
  permission: Permission,
  ownershipOptions: Parameters<typeof requireResourceAccess>[0] = {}
) => {
  return [
    requirePermission(permission),
    requireResourceAccess(ownershipOptions)
  ];
};
