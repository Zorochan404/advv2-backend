import express, { Router } from "express";
import {
  getAllPayments,
  getPaymentById,
  getPaymentStats,
  refundPayment,
} from "./adminpaymentcontroller";
import { verifyJWT } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";
import { validateRequest } from "../utils/validation";
import { z } from "zod";

const router: Router = Router();

// ========================================
// VALIDATION SCHEMAS
// ========================================

const paymentsQuerySchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']).optional(),
  method: z.enum(['razorpay', 'stripe', 'paypal', 'upi', 'card', 'netbanking', 'wallet', 'cash']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  customerId: z.coerce.number().positive().optional(),
  bookingId: z.coerce.number().positive().optional(),
  gateway: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

const paymentParamsSchema = z.object({
  id: z.coerce.number().positive()
});

const refundSchema = z.object({
  refundAmount: z.number().positive(),
  reason: z.string().min(1, "Refund reason is required")
});

// ========================================
// ADMIN PAYMENT ROUTES
// ========================================

// Get all payments with filtering and pagination
router.get(
  "/",
  verifyJWT,
  requireAdmin,
  validateRequest(paymentsQuerySchema),
  getAllPayments
);

// Get payment statistics (must come before /:id route)
router.get(
  "/stats",
  verifyJWT,
  requireAdmin,
  getPaymentStats
);

// Get single payment by ID
router.get(
  "/:id",
  verifyJWT,
  requireAdmin,
  validateRequest(paymentParamsSchema),
  getPaymentById
);

// Refund payment
router.post(
  "/:id/refund",
  verifyJWT,
  requireAdmin,
  validateRequest({ ...paymentParamsSchema, ...refundSchema }),
  refundPayment
);

export default router;
