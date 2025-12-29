import { Router } from "express";
import {
  createPayment,
  updatePaymentStatus,
  getPaymentById,
  getPaymentsByBooking,
  getUserPayments,
  getPaymentSummary,
  processRefund,
} from "./paymentcontroller";
import { verifyJWT } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { Permission } from "../middleware/rbac";

const router: Router = Router();

// Create a new payment
router.post(
  "/",
  verifyJWT,
  requirePermission(Permission.CREATE_PAYMENT),
  createPayment
);

// Update payment status (webhook endpoint)
router.put(
  "/status",
  updatePaymentStatus
);

// Get payment by ID
router.get(
  "/:paymentId",
  verifyJWT,
  requirePermission(Permission.READ_PAYMENT),
  getPaymentById
);

// Get payments by booking ID
router.get(
  "/booking/:bookingId",
  verifyJWT,
  requirePermission(Permission.READ_PAYMENT),
  getPaymentsByBooking
);

// Get user's payment history
router.get(
  "/",
  verifyJWT,
  requirePermission(Permission.READ_PAYMENT),
  getUserPayments
);

// Get payment summary
router.get(
  "/summary",
  verifyJWT,
  requirePermission(Permission.READ_PAYMENT),
  getPaymentSummary
);

// Process refund
router.post(
  "/refund",
  verifyJWT,
  requirePermission(Permission.UPDATE_PAYMENT),
  processRefund
);

export default router;
