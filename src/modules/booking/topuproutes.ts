import express, { Router } from "express";
import {
  createTopup,
  getActiveTopups,
  applyTopupToBooking,
  getBookingTopups,
  getAllTopups,
  updateTopup,
  deleteTopup,
} from "./topupcontroller";
import { verifyJWT } from "../middleware/auth";
import { 
  requirePermission, 
  Permission, 
  requireAdmin, 
  requireUser 
} from "../middleware/rbac";
import {
  validateRequest,
  idParamSchema,
  topupCreateSchema,
  topupUpdateSchema,
  topupApplySchema,
  paginationQuerySchema,
} from "../utils/validation";

const router: Router = express.Router();

// Public routes
router.get("/active", getActiveTopups);

// User routes
router.post(
  "/apply",
  verifyJWT,
  requirePermission(Permission.UPDATE_BOOKING),
  validateRequest(topupApplySchema),
  applyTopupToBooking
);
router.get(
  "/booking/:bookingId",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(idParamSchema),
  getBookingTopups
);

// Admin routes
router.get(
  "/",
  verifyJWT,
  requirePermission(Permission.READ_ADVERTISEMENT),
  validateRequest(paginationQuerySchema),
  getAllTopups
);
router.post(
  "/",
  verifyJWT,
  requirePermission(Permission.CREATE_ADVERTISEMENT),
  validateRequest(topupCreateSchema),
  createTopup
);
router.put(
  "/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_ADVERTISEMENT),
  validateRequest({ ...idParamSchema, ...topupUpdateSchema }),
  updateTopup
);
router.delete(
  "/:id",
  verifyJWT,
  requirePermission(Permission.DELETE_ADVERTISEMENT),
  validateRequest(idParamSchema),
  deleteTopup
);

export default router;
