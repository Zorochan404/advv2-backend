import express, { Router } from "express";
import {
  addreview,
  getavgratingbycars,
  getreviewsbycars,
  getreviews,
  updatereview,
  deletereview,
} from "./reviewcontroller";
import { verifyJWT } from "../middleware/auth";
import { 
  requirePermission, 
  requireResourceAccess, 
  Permission 
} from "../middleware/rbac";
import {
  validateRequest,
  idParamSchema,
  carIdParamSchema,
  reviewIdParamSchema,
  reviewCreateSchema,
  reviewUpdateSchema,
  reviewQuerySchema,
} from "../utils/validation";

const router: Router = express.Router();

// Public routes (no authentication required)
router.get("/getreviews", validateRequest(reviewQuerySchema), getreviews);
router.get(
  "/getreviewsbycars/:carid",
  validateRequest({ ...carIdParamSchema, ...reviewQuerySchema }),
  getreviewsbycars
);
router.get(
  "/avg-rating/:carid",
  validateRequest(carIdParamSchema),
  getavgratingbycars
);

// User-only routes (for creating reviews)
router.post(
  "/addreview/:carid",
  verifyJWT,
  requirePermission(Permission.CREATE_REVIEW),
  validateRequest({ ...carIdParamSchema, ...reviewCreateSchema }),
  addreview
);

// Owner or Admin routes (for updating/deleting reviews)
router.put(
  "/updatereview/:reviewid",
  verifyJWT,
  requirePermission(Permission.UPDATE_REVIEW),
  requireResourceAccess({ userIdParam: "userId", checkOwnership: true }),
  validateRequest({ ...reviewIdParamSchema, ...reviewUpdateSchema }),
  updatereview
);
router.delete(
  "/deletereview/:reviewid",
  verifyJWT,
  requirePermission(Permission.DELETE_REVIEW),
  requireResourceAccess({ userIdParam: "userId", checkOwnership: true }),
  validateRequest(reviewIdParamSchema),
  deletereview
);

export default router;
