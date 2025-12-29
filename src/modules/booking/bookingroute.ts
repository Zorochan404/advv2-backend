import express, { Router } from "express";
import {
  createBooking,
  getBookingByDateRange,
  getbookingbyid,
  getbookingbyuserid,
  updatebooking,
  deletebooking,
  confirmAdvancePayment,
  submitConfirmationRequest,
  picApproveConfirmation,
  confirmFinalPayment,
  getPICDashboard,
  verifyBookingOTP,
  resendBookingOTP,
  getBookingOTP,
  rescheduleBooking,
  getPICByEntity,
  getPICConfirmationRequests,
  resubmitConfirmationRequest,
  getUserRejectedConfirmations,
  getBookingStatus,
  getUserBookingsWithStatus,
  confirmCarPickup,
  checkBookingOverdue,
  applyTopupToBooking,
  getBookingTimelineStatus,
  confirmCarReturn,
  getEarningsOverview,
  getPICBookings,
  getPublicBookingStatus,
  getUserBookingsFormatted,
  getDetailedBookingById,
  getAllBookings,
} from "./bookingcontroller";
import { verifyJWT } from "../middleware/auth";
import { 
  requirePermission, 
  requireResourceAccess, 
  Permission, 
  requireUser,
  requirePIC,
  requireAdmin 
} from "../middleware/rbac";
import {
  validateRequest,
  idParamSchema,
  bookingIdParamSchema,
  bookingCreateSchema,
  bookingPaymentSchema,
  bookingConfirmationSchema,
  bookingPICApprovalSchema,
  bookingOTPVerificationSchema,
  bookingResendOTPSchema,
  bookingRescheduleSchema,
  bookingCarReturnSchema,
  paginationQuerySchema,
  topupApplySchema,
  // Late fee payment schema removed
  earningsOverviewSchema,
  picDateFilterSchema,
} from "../utils/validation";

const router: Router = express.Router();

// Create booking route
router.post(
  "/",
  verifyJWT,
  requirePermission(Permission.CREATE_BOOKING),
  validateRequest(bookingCreateSchema),
  createBooking
);

// Admin route to get all bookings
router.get(
  "/get",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  getAllBookings
);

// User routes

router.get(
  "/user",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(paginationQuerySchema),
  getbookingbyuserid
);

// Get user's own bookings using JWT (no user ID needed)
router.get(
  "/my-bookings", 
  verifyJWT, 
  requirePermission(Permission.READ_BOOKING), 
  getUserBookingsWithStatus
);

// Get user's formatted bookings (current and past)
router.get(
  "/user/formatted", 
  verifyJWT, 
  requirePermission(Permission.READ_BOOKING), 
  getUserBookingsFormatted
);

// Get detailed booking by ID (user can only see their own bookings)
router.get(
  "/detail/:id", 
  verifyJWT, 
  requirePermission(Permission.READ_BOOKING),
  getDetailedBookingById
);

// Payment routes
router.post(
  "/advance-payment",
  verifyJWT,
  requirePermission(Permission.MANAGE_BOOKING_PAYMENTS),
  validateRequest(bookingPaymentSchema),
  confirmAdvancePayment
);
router.post(
  "/submit-confirmation",
  verifyJWT,
  requirePermission(Permission.UPDATE_BOOKING),
  validateRequest(bookingConfirmationSchema),
  submitConfirmationRequest
);

// Resubmit confirmation request after rejection
router.post(
  "/resubmit-confirmation",
  verifyJWT,
  requirePermission(Permission.UPDATE_BOOKING),
  validateRequest(bookingConfirmationSchema),
  resubmitConfirmationRequest
);

// Get user's rejected confirmation requests
router.get(
  "/user/rejected-confirmations",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  getUserRejectedConfirmations
);

// Get comprehensive booking status (requires authentication)
router.get(
  "/status/:bookingId", 
  verifyJWT, 
  requirePermission(Permission.READ_BOOKING),
  getBookingStatus
);

// Get public booking status (no authentication required)
router.get("/public/status/:bookingId", getPublicBookingStatus);

// Get all user bookings with status summaries
router.get(
  "/user/with-status",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  getUserBookingsWithStatus
);

// Confirm car pickup (PIC confirms car has been taken from parking lot)
router.post(
  "/confirm-pickup", 
  verifyJWT, 
  requirePermission(Permission.CONFIRM_PICKUP), 
  confirmCarPickup
);

// PIC (Parking In Charge) routes
router.get(
  "/pic/dashboard",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(picDateFilterSchema),
  getPICDashboard
);

// Get all bookings for PIC's parking lot
router.get(
  "/pic/bookings", 
  verifyJWT, 
  requirePermission(Permission.READ_BOOKING), 
  getPICBookings
);

// Get all confirmation requests for PIC's parking lot
router.get(
  "/pic/confirmation-requests",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  getPICConfirmationRequests
);

// Get PIC by entity (car, booking, or parking) - Must come after /pic/* routes
router.get(
  "/pic-by-entity", 
  verifyJWT, 
  requirePermission(Permission.READ_BOOKING),
  getPICByEntity
);

// Extension and topup routes
router.get(
  "/:bookingId/overdue", 
  verifyJWT, 
  requirePermission(Permission.READ_BOOKING),
  checkBookingOverdue
);
router.post(
  "/apply-topup",
  verifyJWT,
  requirePermission(Permission.UPDATE_BOOKING),
  validateRequest(topupApplySchema),
  applyTopupToBooking
);
// Get booking timeline status (replaces late fee calculation)
router.get(
  "/:bookingId/timeline-status", 
  verifyJWT, 
  requirePermission(Permission.READ_BOOKING),
  getBookingTimelineStatus
);

// Confirm car return (PIC confirms car has been returned to parking lot)
router.post(
  "/confirm-return", 
  verifyJWT, 
  requirePermission(Permission.CONFIRM_RETURN),
  validateRequest(bookingCarReturnSchema),
  confirmCarReturn
);

// Admin routes
router.get(
  "/earnings/overview",
  verifyJWT,
  requirePermission(Permission.VIEW_ANALYTICS),
  validateRequest(earningsOverviewSchema),
  getEarningsOverview
);

router.post(
  "/pic-approve",
  verifyJWT,
  requirePermission(Permission.UPDATE_BOOKING),
  validateRequest(bookingPICApprovalSchema),
  picApproveConfirmation
);
router.post(
  "/final-payment",
  verifyJWT,
  requirePermission(Permission.MANAGE_BOOKING_PAYMENTS),
  validateRequest(bookingPaymentSchema),
  confirmFinalPayment
);

// OTP Verification Routes
router.post(
  "/verify-otp",
  verifyJWT,
  requirePermission(Permission.VERIFY_OTP),
  validateRequest(bookingOTPVerificationSchema),
  verifyBookingOTP
);

router.post(
  "/resend-otp",
  verifyJWT,
  requirePermission(Permission.UPDATE_BOOKING),
  validateRequest(bookingResendOTPSchema),
  resendBookingOTP
);

router.get(
  "/otp/:bookingId",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(bookingIdParamSchema),
  getBookingOTP
);

// Reschedule booking
router.put(
  "/reschedule/:bookingId",
  verifyJWT,
  requirePermission(Permission.UPDATE_BOOKING),
  validateRequest({ ...bookingIdParamSchema, ...bookingRescheduleSchema }),
  rescheduleBooking
);

// Generic booking routes (must come after all specific routes to avoid conflicts)
router.get(
  "/:id",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(idParamSchema),
  getbookingbyid
);
router.put(
  "/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_BOOKING),
  validateRequest({ ...idParamSchema, ...bookingCreateSchema }),
  updatebooking
);
router.delete(
  "/:id",
  verifyJWT,
  requirePermission(Permission.DELETE_BOOKING),
  validateRequest(idParamSchema),
  deletebooking
);

export default router;
