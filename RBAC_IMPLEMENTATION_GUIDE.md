`# RBAC Implementation Guide

## 🔥 Critical Security Fixes Required

### **IMMEDIATE ACTION NEEDED:**

1. **Fix the most critical vulnerability:**
   ```typescript
   // URGENT: This route allows ANYONE to update ANY user!
   router.put("/updateuser/:id", updateUser); // NO AUTH AT ALL!
   ```

2. **Replace all current auth imports with new RBAC:**
   ```typescript
   // OLD (messy):
   import { verifyJWT, requireAdmin, requireVendorOrAdmin, requireOwnerOrAdmin } from "../middleware/auth";
   
   // NEW (clean):
   import { verifyJWT } from "../middleware/auth";
   import { requirePermission, requireResourceAccess, Permission, requireAdmin, requireUser } from "../middleware/rbac";
   ```

## **Route-by-Route Implementation**

### **1. User Routes (CRITICAL FIXES)**

```typescript
// BEFORE (VULNERABLE):
router.put("/updateuser/:id", updateUser); // NO SECURITY!
router.get("/getuser/:id", getUser); // PUBLIC!
router.get("/getallusers", getAllUsers); // PUBLIC!

// AFTER (SECURE):
router.put(
  "/updateuser/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_USER),
  requireResourceAccess({ userIdParam: "id", checkOwnership: true }),
  updateUser
);
router.get(
  "/getuser/:id", 
  verifyJWT,
  requirePermission(Permission.READ_USER),
  requireResourceAccess({ userIdParam: "id", checkOwnership: true }),
  getUser
);
router.get(
  "/getallusers", 
  verifyJWT,
  requireAdmin,
  getAllUsers
);
```

### **2. Car Routes**

```typescript
// Public car discovery (keep as is)
router.get("/nearestavailablecars", getNearestAvailableCars);
router.get("/search", searchbynameornumber);

// Protected car management
router.post(
  "/add",
  verifyJWT,
  requirePermission(Permission.CREATE_CAR),
  createCar
);

router.put(
  "/:id",
  verifyJWT,
  requirePermission(Permission.UPDATE_CAR),
  requireResourceAccess({ checkOwnership: true }), // Check if user owns this car
  updateCar
);

router.delete(
  "/delete/:id",
  verifyJWT,
  requirePermission(Permission.DELETE_CAR),
  requireResourceAccess({ checkOwnership: true }),
  deleteCar
);

// Admin-only routes
router.get(
  "/getcar",
  verifyJWT,
  requireAdmin,
  getCar
);
```

### **3. Booking Routes**

```typescript
// User booking operations
router.post(
  "/",
  verifyJWT,
  requirePermission(Permission.CREATE_BOOKING),
  createBooking
);

router.get(
  "/:id",
  verifyJWT,
  requirePermission(Permission.READ_BOOKING),
  requireResourceAccess({ userIdParam: "userId", checkOwnership: true }),
  getbookingbyid
);

// PIC operations
router.post(
  "/confirm-pickup",
  verifyJWT,
  requirePermission(Permission.CONFIRM_PICKUP),
  confirmCarPickup
);

router.post(
  "/confirm-return",
  verifyJWT,
  requirePermission(Permission.CONFIRM_RETURN),
  confirmCarReturn
);

// Admin analytics
router.get(
  "/earnings/overview",
  verifyJWT,
  requirePermission(Permission.VIEW_ANALYTICS),
  getEarningsOverview
);
```

### **4. Advertisement Routes**

```typescript
// Public routes (with auth for tracking to prevent abuse)
router.get("/active", getActiveAdvertisements);

router.post(
  "/:id/view",
  verifyJWT, // ADD AUTH to prevent bot abuse
  incrementViewCount
);

router.post(
  "/:id/click", 
  verifyJWT, // ADD AUTH to prevent bot abuse
  incrementClickCount
);

// Admin-only routes
router.post(
  "/create",
  verifyJWT,
  requirePermission(Permission.CREATE_ADVERTISEMENT),
  createAdvertisement
);
```

### **5. Review Routes**

```typescript
// Public read access (keep as is)
router.get("/getreviews", getreviews);
router.get("/avg-rating/:carid", getavgratingbycars);

// User operations
router.post(
  "/addreview/:carid",
  verifyJWT,
  requirePermission(Permission.CREATE_REVIEW),
  addreview
);

router.put(
  "/updatereview/:reviewid",
  verifyJWT,
  requirePermission(Permission.UPDATE_REVIEW),
  requireResourceAccess({ userIdParam: "userId", checkOwnership: true }),
  updatereview
);
```

## **Migration Strategy**

### **Phase 1: Critical Security Fixes (URGENT)**
1. Fix `/updateuser/:id` route immediately
2. Add authentication to public user routes
3. Add authentication to advertisement tracking

### **Phase 2: Implement New RBAC**
1. Deploy new RBAC middleware
2. Update one module at a time (start with users)
3. Test thoroughly

### **Phase 3: Clean Up**
1. Remove old middleware files
2. Update all imports
3. Add comprehensive tests

## **Testing the New System**

```typescript
// Example usage in controllers
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const targetUserId = parseInt(req.params.id);
  
  // The RBAC middleware already checked permissions and ownership
  // So we can safely proceed with the update
  
  const updatedUser = await updateUserLogic(targetUserId, req.body);
  res.json(updatedUser);
});
```

## **Benefits of New RBAC System**

1. **Clear Permission Model**: Each operation has a specific permission
2. **Resource Ownership**: Proper ownership checks built-in
3. **Scalable**: Easy to add new roles and permissions
4. **Consistent**: Same pattern across all routes
5. **Secure by Default**: Explicit permissions required
6. **Maintainable**: Central permission management

## **Security Best Practices**

1. **Principle of Least Privilege**: Each role has minimal required permissions
2. **Defense in Depth**: Multiple layers of authorization
3. **Resource Isolation**: Users can only access their own resources
4. **Audit Trail**: All permission checks are logged
5. **Fail Secure**: Default to deny access

## **Next Steps**

1. **URGENT**: Apply critical security fixes immediately
2. Implement new RBAC middleware
3. Update routes systematically
4. Add comprehensive tests
5. Monitor and audit access patterns





