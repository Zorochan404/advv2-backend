import express, { Router } from "express";
import {
  getParking,
  getParkingByFilter,
  getNearByParking,
  getParkingById,
  createParking,
  updateParking,
  deleteParking,
  getParkingByIDadmin,
  submitParkingApproval,
  getParkingApprovalRequests,
  updateParkingApprovalStatus,
  getUserParkingApprovalRequests,
} from "./parkingcontroller";
import { verifyJWT } from "../middleware/auth";
import { 
  requirePermission, 
  requireResourceAccess, 
  Permission, 
  requireAdmin 
} from "../middleware/rbac";
import {
  validateRequest,
  idParamSchema,
  parkingCreateSchema,
  parkingUpdateSchema,
  parkingFilterSchema,
  parkingLocationSchema,
  paginationQuerySchema,
  parkingApprovalCreateSchema,
  parkingApprovalUpdateSchema,
  parkingApprovalFilterSchema,
} from "../utils/validation";

const router: Router = express.Router();

// Public routes (no authentication required)
router.get("/get", validateRequest(parkingFilterSchema), getParking);
router.get("/search", validateRequest(parkingFilterSchema), getParkingByFilter);
router.get("/getbyid/:id", validateRequest(idParamSchema), getParkingById);
router.get("/nearby", validateRequest(parkingLocationSchema), getNearByParking);
router.post(
  "/nearby",
  validateRequest(parkingLocationSchema),
  getNearByParking
);

// Admin-only routes (for parking management)
router.post(
  "/add",
  verifyJWT,
  requirePermission(Permission.CREATE_PARKING),
  validateRequest(parkingCreateSchema),
  createParking
);
router.get(
  "/getbyidadmin/:id",
  verifyJWT,
  requirePermission(Permission.READ_PARKING),
  validateRequest(idParamSchema),
  getParkingByIDadmin
);
router.put(
  "/update/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_PARKING),
  validateRequest({ ...idParamSchema, ...parkingUpdateSchema }),
  updateParking
);
router.delete(
  "/delete/:id",
  verifyJWT,
  requirePermission(Permission.DELETE_PARKING),
  validateRequest(idParamSchema),
  deleteParking
);

// New routes for parking approval flow

// User submits parking approval request
router.post(
  "/submit-approval",
  verifyJWT,
  requirePermission(Permission.CREATE_PARKING),
  validateRequest(parkingApprovalCreateSchema),
  submitParkingApproval
);

// User gets their parking approval requests
router.get(
  "/my-approval-requests", 
  verifyJWT, 
  requirePermission(Permission.READ_PARKING),
  getUserParkingApprovalRequests
);

// Admin gets all parking approval requests
router.get(
  "/approval-requests",
  verifyJWT,
  requirePermission(Permission.READ_PARKING),
  validateRequest(parkingApprovalFilterSchema),
  getParkingApprovalRequests
);

// Admin approves/rejects parking request
router.put(
  "/approval-requests/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_PARKING),
  validateRequest({ ...idParamSchema, ...parkingApprovalUpdateSchema }),
  updateParkingApprovalStatus
);

export default router;
