import express from "express";
import {
  createCoupon,
  getAllCoupons,
  getActiveCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} from "./couponcontroller";
import { seedCoupons, clearCoupons } from "./seedCoupons";
import { verifyJWT } from "../middleware/auth";
import { 
  requirePermission, 
  Permission 
} from "../middleware/rbac";

const router = express.Router();

// Admin routes (protected)
router.post("/", verifyJWT, requirePermission(Permission.CREATE_ADVERTISEMENT), createCoupon);
router.get("/admin", verifyJWT, requirePermission(Permission.READ_ADVERTISEMENT), getAllCoupons);
router.put("/:id", verifyJWT, requirePermission(Permission.UPDATE_ADVERTISEMENT), updateCoupon);
router.delete("/:id", verifyJWT, requirePermission(Permission.DELETE_ADVERTISEMENT), deleteCoupon);
router.post("/seed", verifyJWT, requirePermission(Permission.SEED_DATA), seedCoupons);
router.delete("/clear", verifyJWT, requirePermission(Permission.SEED_DATA), clearCoupons);

// Public routes
router.get("/active", getActiveCoupons);
router.get("/:id", getCouponById);
router.post("/validate", validateCoupon);

export default router as express.Router;
