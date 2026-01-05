import express, { Router } from "express";
import {
    createCarRequest,
    getMyCarRequests,
    getAllCarRequests,
    assignParking,
    approveCarRequest,
    denyCarRequest,
    getAssignedRequests
} from "./carrequest.controller";
import {
    verifyJWT,
    requireVendor,
    requireAdmin,
    requirePIC
} from "../middleware/auth";

const router: Router = express.Router();

// Apply global auth middleware
router.use(verifyJWT);

// Vendor Routes
router.post("/", verifyJWT, requireVendor, createCarRequest);
router.get("/my", verifyJWT, requireVendor, getMyCarRequests);

// Admin Routes
router.get("/", verifyJWT, requireAdmin, getAllCarRequests);
router.put("/:id/assign-parking", verifyJWT, requireAdmin, assignParking);

// Parking Incharge Routes
router.get("/parking/getrequests", verifyJWT, requirePIC, getAssignedRequests);
router.put("/:id/approve", verifyJWT, requirePIC, approveCarRequest);
router.put("/:id/deny", verifyJWT, requirePIC, denyCarRequest);

export default router;
