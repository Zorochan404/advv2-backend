import express, { Router } from "express";
import { verifyJWT } from "../middleware/auth";
import { 
  requirePermission, 
  Permission, 
  requirePIC 
} from "../middleware/rbac";
import { validateRequest, picDateFilterSchema } from "../utils/validation";
import {
  getPickupCars,
  getDropoffCars,
  getAllCarsUnderPIC,
} from "./piccontroller";

const router: Router = Router();

// PIC-specific routes
router.get(
  "/pickup-cars",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(picDateFilterSchema),
  getPickupCars
);

// Also support singular form for flexibility
router.get(
  "/pickup-car",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(picDateFilterSchema),
  getPickupCars
);

router.get(
  "/dropoff-cars",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(picDateFilterSchema),
  getDropoffCars
);

// Also support singular form for flexibility
router.get(
  "/dropoff-car",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  validateRequest(picDateFilterSchema),
  getDropoffCars
);

// Get all cars under the PIC's parking lot
router.get(
  "/cars", 
  verifyJWT, 
  requirePermission(Permission.READ_CAR), 
  getAllCarsUnderPIC
);

export default router;
