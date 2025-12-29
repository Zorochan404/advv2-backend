import express, { Router } from "express";
import {
  testCarConnection,
  getCar,
  getNearestCars,
  getNearestAvailableCars,
  getNearestPopularCars,
  getCarById,
  getCarByParkingId,
  searchbynameornumber,
  filterCars,
  createCar,
  updateCar,
  deleteCar,
} from "./carcontroller";
import { seedInsuranceAmounts } from "./seedInsurance";
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
  carCreateSchema,
  carUpdateSchema,
  carSearchSchema,
  carFilterSchema,
  carLocationSchema,
  carLocationFilterSchema,
  paginationQuerySchema,
} from "../utils/validation";

const router: Router = express.Router();

// Public routes (specific routes first)
router.get("/test", testCarConnection);
router.get("/nearestcars", validateRequest(carLocationSchema), getNearestCars);
router.post("/nearestcars", validateRequest(carLocationSchema), getNearestCars);
router.get(
  "/nearestavailablecars",
  validateRequest(carLocationFilterSchema),
  getNearestAvailableCars
);
router.post(
  "/nearestavailablecars",
  validateRequest(carLocationFilterSchema),
  getNearestAvailableCars
);
router.get(
  "/nearestpopularcars",
  validateRequest(carLocationSchema),
  getNearestPopularCars
);
router.post(
  "/nearestpopularcars",
  validateRequest(carLocationSchema),
  getNearestPopularCars
);
router.get("/search", validateRequest(carSearchSchema), searchbynameornumber);
router.post("/search", validateRequest(carSearchSchema), searchbynameornumber);
router.get("/filter", validateRequest(carFilterSchema), filterCars);

// Protected routes (specific routes first)
router.get(
  "/getcar",
  verifyJWT,
  requirePermission(Permission.READ_CAR),
  validateRequest(paginationQuerySchema),
  getCar
);
router.post(
  "/seed-insurance",
  verifyJWT,
  requirePermission(Permission.SEED_DATA),
  seedInsuranceAmounts
);
router.post(
  "/add",
  verifyJWT,
  requirePermission(Permission.CREATE_CAR),
  validateRequest(carCreateSchema),
  createCar
);

// Parameterized routes (after specific routes)
router.get("/getcar/:id", validateRequest(idParamSchema), getCarById);
router.get(
  "/carbyparking/:id",
  validateRequest({ ...idParamSchema, ...paginationQuerySchema }),
  getCarByParkingId
);
router.put(
  "/:id", 
  verifyJWT, 
  requirePermission(Permission.UPDATE_CAR),
  requireResourceAccess({ checkOwnership: true }),
  validateRequest({ ...idParamSchema, ...carUpdateSchema }),
  updateCar
);
router.delete(
  "/delete/:id",
  verifyJWT,
  requirePermission(Permission.DELETE_CAR),
  requireResourceAccess({ checkOwnership: true }),
  validateRequest(idParamSchema),
  deleteCar
);

export default router;
