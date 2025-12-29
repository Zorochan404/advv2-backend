import express, { Router } from "express";
import {
  createAdvertisement,
  getAllAdvertisements,
  getAdvertisementById,
  updateAdvertisement,
  deleteAdvertisement,
  getActiveAdvertisements,
  incrementViewCount,
  incrementClickCount,
  getAdvertisementStats,
} from "./advertisementcontroller";
import { verifyJWT } from "../middleware/auth";
import { 
  requirePermission, 
  Permission, 
  requireAdmin 
} from "../middleware/rbac";
import {
  validateRequest,
  idParamSchema,
  advertisementCreateSchema,
  advertisementUpdateSchema,
  advertisementFilterSchema,
  paginationQuerySchema,
} from "../utils/validation";

const router: Router = express.Router();

// Public routes
router.get(
  "/active",
  validateRequest(advertisementFilterSchema),
  getActiveAdvertisements
);

// Create advertisement (admin only)
router.post(
  "/create",
  verifyJWT,
  requirePermission(Permission.CREATE_ADVERTISEMENT),
  validateRequest(advertisementCreateSchema),
  createAdvertisement
);

// Admin routes
router.get(
  "/admin/all",
  verifyJWT,
  requirePermission(Permission.READ_ADVERTISEMENT),
  validateRequest({ ...advertisementFilterSchema, ...paginationQuerySchema }),
  getAllAdvertisements
);

router.get(
  "/admin/stats", 
  verifyJWT, 
  requirePermission(Permission.VIEW_ANALYTICS), 
  getAdvertisementStats
);

// Parameterized routes (must come after specific routes) - require auth to prevent abuse
router.post(
  "/:id/view", 
  verifyJWT,
  validateRequest(idParamSchema), 
  incrementViewCount
);

router.post(
  "/:id/click", 
  verifyJWT,
  validateRequest(idParamSchema), 
  incrementClickCount
);

router.get(
  "/:id",
  verifyJWT,
  requirePermission(Permission.READ_ADVERTISEMENT),
  validateRequest(idParamSchema),
  getAdvertisementById
);

router.put(
  "/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_ADVERTISEMENT),
  validateRequest({ ...idParamSchema, ...advertisementUpdateSchema }),
  updateAdvertisement
);

router.delete(
  "/:id",
  verifyJWT,
  requirePermission(Permission.DELETE_ADVERTISEMENT),
  validateRequest(idParamSchema),
  deleteAdvertisement
);

export default router;
