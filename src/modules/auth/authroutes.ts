import express, { Router } from "express";
import {
  loginuser,
  registerAdmin,
  loginAdmin,
  migratePasswords,
} from "./authcontroller";
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
import {
  unifiedLoginSchema,
  userRegisterSchema,
  staffRegisterSchema,
  tokenRefreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  logoutSchema,
} from "../utils/authValidation";

const router: Router = express.Router();

// ========================================
// NEW UNIFIED AUTHENTICATION ENDPOINTS
// ========================================

// Unified login endpoint (recommended)
router.post("/v2/login", validateRequest(unifiedLoginSchema), unifiedLogin);

// User registration (public)
router.post("/v2/register", validateRequest(userRegisterSchema), registerUser);

// Staff registration (admin only)
router.post(
  "/v2/staff/register", 
  verifyJWT, 
  requirePermission(Permission.CREATE_USER), 
  validateRequest(staffRegisterSchema), 
  registerStaff
);

// Token management
router.post("/v2/refresh", validateRequest(tokenRefreshSchema), refreshToken);
router.post("/v2/logout", verifyJWT, validateRequest(logoutSchema), logout);

// Password reset
router.post("/v2/forgot-password", validateRequest(forgotPasswordSchema), forgotPassword);
router.post("/v2/reset-password", validateRequest(resetPasswordSchema), resetPassword);

// ========================================
// LEGACY ENDPOINTS (DEPRECATED - MAINTAINED FOR BACKWARD COMPATIBILITY)
// ========================================

// Legacy user login (deprecated - use /v2/login with authMethod: "otp")
router.post("/login", validateRequest(loginSchema), loginuser);

// Legacy admin registration (deprecated - use /v2/staff/register)
router.post(
  "/registerAdmin",
  validateRequest(adminRegisterSchema),
  registerAdmin
);

// Legacy admin login (deprecated - use /v2/login with authMethod: "password")
router.post("/loginAdmin", validateRequest(adminLoginSchema), loginAdmin);

// Admin-only routes
router.post("/migrate-passwords", verifyJWT, requirePermission(Permission.MIGRATE_DATA), migratePasswords);

export default router;
