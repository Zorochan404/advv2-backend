import express, { Router } from "express";
import {
  unifiedLogin,
  registerUser,
  registerStaff,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
} from "./authControllerV2";
import { verifyJWT } from "../middleware/auth";
import { requirePermission, Permission } from "../middleware/rbac";
import {
  validateRequest,
  loginSchema,
  adminRegisterSchema,
  adminLoginSchema,
} from "../utils/validation";

const router: Router = express.Router();

// New unified authentication endpoints
router.post("/login", unifiedLogin);
router.post("/register", registerUser);
router.post("/staff/register", verifyJWT, requirePermission(Permission.CREATE_USER), registerStaff);
router.post("/refresh", refreshToken);
router.post("/logout", verifyJWT, logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;





