import { Router } from 'express';
import { verifyJWT } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { validateRequest } from '../utils/validation';
import { z } from 'zod';
import {
  getParkingStats,
  searchParkingSpots,
  getParkingAnalytics,
  getParkingManagersPerformance,
} from './adminparkingcontroller';

const router: Router = Router();

// Validation schemas
const parkingSearchSchema = z.object({
  search: z.string().optional(),
  city: z.string().optional(),
  capacity: z.coerce.number().min(0).optional(),
  hasManager: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
});

const parkingAnalyticsSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional().default('monthly'),
  spotId: z.coerce.number().positive(),
});

// Apply authentication and admin middleware to all routes
router.use(verifyJWT);
router.use(requireAdmin);

// ========================================
// PARKING ADMIN ROUTES
// ========================================

// GET /api/v1/admin/parking/stats - Get parking statistics
router.get(
  '/stats',
  getParkingStats
);

// GET /api/v1/admin/parking/search - Search and filter parking spots
router.get(
  '/search',
  validateRequest(parkingSearchSchema),
  searchParkingSpots
);

// GET /api/v1/admin/parking/analytics - Get parking analytics
router.get(
  '/analytics',
  validateRequest(parkingAnalyticsSchema),
  getParkingAnalytics
);

// GET /api/v1/admin/parking/managers/performance - Get parking managers performance
router.get(
  '/managers/performance',
  getParkingManagersPerformance
);

export default router;
