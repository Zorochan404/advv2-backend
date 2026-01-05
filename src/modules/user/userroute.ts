import express, { Router } from "express";
import {
  getUser,
  updateUser,
  deleteUser,
  getAllUsers,
  searchUser,
  getUserbyrole,
  addParkingIncharge,
  getusersbyvendor,
  addvendor,
  getParkingInchargeByNumber,
  assignParkingIncharge,
  getParkingInchargeByParkingId,
  updatePassword,
} from "./usercontroller";
import { verifyJWT } from "../middleware/auth";
import {
  requirePermission,
  requireResourceAccess,
  Permission,
  requireAdmin,
  requireUser
} from "../middleware/rbac";
import {
  validateRequest,
  idParamSchema,
  carIdParamSchema,
  reviewIdParamSchema,
  parkingIdParamSchema,
  userCreateSchema,
  userUpdateSchema,
  userSearchSchema,
  userRoleSchema,
  parkingInchargeAssignSchema,
  parkingInchargeByNumberSchema,
  paginationQuerySchema,
  passwordUpdateSchema,
} from "../utils/validation";

const router: Router = express.Router();

// Protected routes (require authentication)
router.get(
  "/getuser/:id",
  verifyJWT,
  requireResourceAccess({ userIdParam: "id", checkOwnership: false }),
  validateRequest(idParamSchema),
  getUser
);
router.get(
  "/getallusers",
  verifyJWT,
  requirePermission(Permission.READ_USER),
  validateRequest(paginationQuerySchema),
  getAllUsers
);
router.get(
  "/search",
  verifyJWT,
  requirePermission(Permission.READ_USER),
  validateRequest(userSearchSchema),
  searchUser
);
router.post(
  "/getuserbyrole",
  verifyJWT,
  requirePermission(Permission.READ_USER),
  validateRequest(userRoleSchema),
  getUserbyrole
);

// Admin-only routes (for user management)
router.post(
  "/addparkingincharge",
  verifyJWT,
  requirePermission(Permission.CREATE_USER),
  validateRequest(userCreateSchema),
  addParkingIncharge
);
router.get(
  "/getusersbyvendor",
  verifyJWT,
  requirePermission(Permission.READ_USER),
  validateRequest(paginationQuerySchema),
  getusersbyvendor
);
router.post(
  "/addvendor",
  validateRequest(userCreateSchema),
  addvendor
);
router.post(
  "/getparkinginchargebynumber",
  verifyJWT,
  requirePermission(Permission.READ_USER),
  validateRequest(parkingInchargeByNumberSchema),
  getParkingInchargeByNumber
);
router.post(
  "/assignparkingincharge",
  verifyJWT,
  requirePermission(Permission.UPDATE_USER),
  validateRequest(parkingInchargeAssignSchema),
  assignParkingIncharge
);
router.get(
  "/getparkinginchargebyparkingid/:parkingid",
  verifyJWT,
  requirePermission(Permission.READ_USER),
  validateRequest(parkingIdParamSchema),
  getParkingInchargeByParkingId
);

// Owner or Admin routes (for updating/deleting users)
router.put(
  "/updateuser/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_USER),
  requireResourceAccess({ userIdParam: "id", checkOwnership: true }),
  validateRequest({ ...idParamSchema, ...userUpdateSchema }),
  updateUser
);
router.delete(
  "/deleteuser/:id",
  verifyJWT,
  requirePermission(Permission.DELETE_USER),
  requireResourceAccess({ userIdParam: "id", checkOwnership: true }),
  validateRequest(idParamSchema),
  deleteUser
);

// Password update route (for all authenticated users)
router.put(
  "/update-password",
  verifyJWT,
  requirePermission(Permission.UPDATE_USER),
  validateRequest(passwordUpdateSchema),
  updatePassword
);

export default router;
