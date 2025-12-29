import { Router } from 'express';
import { verifyJWT } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { validateRequest } from '../utils/validation';
import { z } from 'zod';
import {
  getAllVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorCars,
  getVendorStats
} from './adminvendorcontroller';

const router: Router = Router();

// Validation schemas
const vendorQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0)
});

const vendorParamsSchema = z.object({
  id: z.coerce.number().positive()
});

const createVendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  number: z.coerce.number().positive("Valid phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  age: z.coerce.number().min(18, "Age must be at least 18").optional(),
  aadharNumber: z.string().optional(),
  aadharimg: z.string().url("Valid URL is required").optional(),
  dlNumber: z.string().optional(),
  dlimg: z.string().url("Valid URL is required").optional(),
  passportNumber: z.string().optional(),
  passportimg: z.string().url("Valid URL is required").optional(),
  locality: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.coerce.number().positive("Valid pincode is required").optional(),
  isverified: z.boolean().optional().default(false),
  role: z.literal('vendor').optional().default('vendor')
});

const updateVendorSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Valid email is required").optional(),
  number: z.coerce.number().positive("Valid phone number is required").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  age: z.coerce.number().min(18, "Age must be at least 18").optional(),
  aadharNumber: z.string().optional(),
  aadharimg: z.string().url("Valid URL is required").optional(),
  dlNumber: z.string().optional(),
  dlimg: z.string().url("Valid URL is required").optional(),
  passportNumber: z.string().optional(),
  passportimg: z.string().url("Valid URL is required").optional(),
  locality: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.coerce.number().positive("Valid pincode is required").optional(),
  isverified: z.boolean().optional(),
  role: z.literal('vendor').optional()
});

// Apply authentication and admin middleware to all routes
router.use(verifyJWT);
router.use(requireAdmin);

// GET /api/v1/admin/vendors - Get all vendors
router.get(
  '/',
  validateRequest(vendorQuerySchema),
  getAllVendors
);

// GET /api/v1/admin/vendors/stats - Get vendor statistics
router.get(
  '/stats',
  getVendorStats
);

// GET /api/v1/admin/vendors/:id - Get vendor by ID
router.get(
  '/:id',
  validateRequest(vendorParamsSchema),
  getVendorById
);

// POST /api/v1/admin/vendors - Create new vendor
router.post(
  '/',
  validateRequest(createVendorSchema),
  createVendor
);

// PUT /api/v1/admin/vendors/:id - Update vendor
router.put(
  '/:id',
  validateRequest({ ...vendorParamsSchema, ...updateVendorSchema }),
  updateVendor
);

// DELETE /api/v1/admin/vendors/:id - Delete vendor
router.delete(
  '/:id',
  validateRequest(vendorParamsSchema),
  deleteVendor
);

// GET /api/v1/admin/vendors/:id/cars - Get all cars added by a specific vendor
router.get(
  '/:id/cars',
  validateRequest(vendorParamsSchema),
  getVendorCars
);

export default router;

