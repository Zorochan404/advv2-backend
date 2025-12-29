import express, { Router } from "express";
import {
  getDashboardData,
  getDashboardMetrics,
  getCarAvailability,
  getParkingUtilization,
  getRevenueTrends,
  getRecentBookings,
  getBookingTimelineOverview,
  getVendorsList,
  getParkingsList,
  assignUserRoles,
  getUsersList,
  getBookingById,
} from "./admincontroller";
import { verifyJWT } from "../middleware/auth";
import { requireAdmin, requirePermission, Permission } from "../middleware/rbac";
import { validateRequest } from "../utils/validation";
import { z } from "zod";

const router: Router = express.Router();

// Validation schemas
const periodQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month']).optional().default('week')
});

const limitQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(5)
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0)
});

const userRoleAssignmentSchema = z.object({
  userIds: z.array(z.coerce.number().positive()).min(1, "At least one user ID is required"),
  role: z.enum(['user', 'admin', 'vendor', 'parkingincharge'])
});

const usersListQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(['user', 'admin', 'vendor', 'parkingincharge']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0)
});

const bookingParamsSchema = z.object({
  id: z.coerce.number().positive()
});

// ========================================
// ADMIN DASHBOARD ROUTES
// ========================================

// Main comprehensive dashboard endpoint
router.get(
  "/dashboard",
  verifyJWT,
  requireAdmin,
  validateRequest(periodQuerySchema),
  getDashboardData
);

// Granular dashboard endpoints for specific widgets

// Key metrics (revenue, bookings, users, car availability)
router.get(
  "/dashboard/metrics",
  verifyJWT,
  requireAdmin,
  validateRequest(periodQuerySchema),
  getDashboardMetrics
);

// Car availability status
router.get(
  "/dashboard/car-availability",
  verifyJWT,
  requireAdmin,
  getCarAvailability
);

// Parking spot utilization
router.get(
  "/dashboard/parking-utilization",
  verifyJWT,
  requireAdmin,
  getParkingUtilization
);

// Revenue trends and charts data
router.get(
  "/dashboard/revenue-trends",
  verifyJWT,
  requireAdmin,
  validateRequest(periodQuerySchema),
  getRevenueTrends
);

// Recent bookings activity
router.get(
  "/dashboard/recent-bookings",
  verifyJWT,
  requireAdmin,
  validateRequest(limitQuerySchema),
  getRecentBookings
);

// Booking timeline overview with status tracking
router.get(
  "/dashboard/booking-timeline",
  verifyJWT,
  requireAdmin,
  getBookingTimelineOverview
);

// ========================================
// ADMIN MANAGEMENT ROUTES
// ========================================

// Get list of vendors - COMMENTED OUT: Now handled by adminvendorroutes.ts
// router.get(
//   "/vendors",
//   verifyJWT,
//   requireAdmin,
//   validateRequest(listQuerySchema),
//   getVendorsList
// );

// Get list of parkings
router.get(
  "/parkings",
  verifyJWT,
  requireAdmin,
  validateRequest(listQuerySchema),
  getParkingsList
);

// Get list of users
router.get(
  "/users",
  verifyJWT,
  requireAdmin,
  validateRequest(usersListQuerySchema),
  getUsersList
);

// Assign roles to multiple users
router.post(
  "/users/assign-roles",
  verifyJWT,
  requireAdmin,
  validateRequest(userRoleAssignmentSchema),
  assignUserRoles
);

// Get single booking by ID
router.get(
  "/bookings/:id",
  verifyJWT,
  requireAdmin,
  validateRequest(bookingParamsSchema),
  getBookingById
);

// ========================================
// ALTERNATIVE RBAC-BASED ROUTES
// ========================================
// These routes use specific permissions instead of just admin role
// Uncomment if you want more granular permission control

/*
// Dashboard with analytics permission
router.get(
  "/dashboard",
  verifyJWT,
  requirePermission(Permission.VIEW_ANALYTICS),
  validateRequest(periodQuerySchema, 'query'),
  getDashboardData
);

// Metrics with analytics permission
router.get(
  "/dashboard/metrics",
  verifyJWT,
  requirePermission(Permission.VIEW_ANALYTICS),
  validateRequest(periodQuerySchema, 'query'),
  getDashboardMetrics
);

// Car availability with car management permission
router.get(
  "/dashboard/car-availability",
  verifyJWT,
  requirePermission(Permission.READ_CAR),
  getCarAvailability
);

// Parking utilization with parking management permission
router.get(
  "/dashboard/parking-utilization",
  verifyJWT,
  requirePermission(Permission.READ_PARKING),
  getParkingUtilization
);

// Revenue trends with analytics permission
router.get(
  "/dashboard/revenue-trends",
  verifyJWT,
  requirePermission(Permission.VIEW_ANALYTICS),
  validateRequest(periodQuerySchema, 'query'),
  getRevenueTrends
);

// Recent bookings with booking management permission
router.get(
  "/dashboard/recent-bookings",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(limitQuerySchema, 'query'),
  getRecentBookings
);
*/

export default router;
