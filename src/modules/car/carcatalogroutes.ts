import express, { Router } from "express";
import {
  createCarCatalog,
  getAllCarCatalog,
  getCarCatalogById,
  updateCarCatalog,
  deleteCarCatalog,
  getActiveCarCatalog,
  seedCarCatalog,
  updateCarCatalogLateFees,
  getAllCarCategories,
  searchCarCatalog,
  getCatalogUsageStats,
  getCategoriesWithCounts,
} from "./carcatalogcontroller";
import { verifyJWT } from "../middleware/auth";
import { 
  requirePermission, 
  Permission, 
  requireAdmin 
} from "../middleware/rbac";
import {
  validateRequest,
  idParamSchema,
  carCatalogCreateSchema,
  carCatalogUpdateSchema,
  carCatalogFilterSchema,
  paginationQuerySchema,
} from "../utils/validation";

const router: Router = express.Router();

// Public routes (no authentication required)
router.get("/active", getActiveCarCatalog);
router.get("/categories", getAllCarCategories);
router.get("/:id", validateRequest(idParamSchema), getCarCatalogById);

// Admin-only routes
router.post(
  "/create",
  verifyJWT,
  requirePermission(Permission.CREATE_CAR),
  validateRequest(carCatalogCreateSchema),
  createCarCatalog
);
router.get(
  "/admin/all",
  verifyJWT,
  requirePermission(Permission.READ_CAR),
  validateRequest({ ...carCatalogFilterSchema, ...paginationQuerySchema }),
  getAllCarCatalog
);
router.put(
  "/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_CAR),
  validateRequest({ ...idParamSchema, ...carCatalogUpdateSchema }),
  updateCarCatalog
);
router.delete(
  "/:id",
  verifyJWT,
  requirePermission(Permission.DELETE_CAR),
  validateRequest(idParamSchema),
  deleteCarCatalog
);
router.post(
  "/seed", 
  verifyJWT, 
  requirePermission(Permission.SEED_DATA), 
  seedCarCatalog
);
router.post(
  "/update-late-fees",
  verifyJWT,
  requirePermission(Permission.UPDATE_CAR),
  updateCarCatalogLateFees
);

// Search car catalog with filters
router.get(
  "/admin/search",
  verifyJWT,
  requireAdmin,
  searchCarCatalog
);

// Get usage statistics for a specific catalog template
router.get(
  "/:id/usage-stats",
  verifyJWT,
  requireAdmin,
  validateRequest(idParamSchema),
  getCatalogUsageStats
);

// Get categories with template counts
router.get(
  "/categories/with-counts",
  verifyJWT,
  requireAdmin,
  getCategoriesWithCounts
);

export default router;
