import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";
import { UserTable } from "../user/usermodel";
import { Request, Response, NextFunction } from "express";
import { db } from "../../drizzle/db";
import { eq } from "drizzle-orm";

export const verifyJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token =
        req.cookies?.accessToken ||
        req.headers["authorization"]?.replace("Bearer ", "");

      if (!token) {
        throw new ApiError(401, "Unauthorized request");
      }

      if (!process.env.ACCESS_TOKEN_SECRET) {
        throw new ApiError(
          500,
          "Server misconfiguration: missing ACCESS_TOKEN_SECRET"
        );
      }

      let decodedToken: any;
      try {
        decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } catch (err) {
        throw new ApiError(401, "Invalid or expired access token");
      }

      if (
        !decodedToken ||
        typeof decodedToken !== "object" ||
        !("_id" in decodedToken)
      ) {
        throw new ApiError(401, "Invalid access token payload");
      }

      const user = await db
        .select()
        .from(UserTable)
        .where(eq(UserTable.id, (decodedToken as any)._id))
        // exclude password and refreshToken
        .limit(1)
        .then((rows) => rows[0]);

      if (!user) {
        throw new ApiError(401, "Invalid Access Token");
      }

      // Attach user to request in a type-safe way
      (req as any).user = user;
      next();
    } catch (error: any) {
      throw new ApiError(401, error?.message || "Invalid access token");
    }
  }
);

// Role-based middleware functions
export const requireAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || user.role !== "admin") {
        throw new ApiError(403, "Admin access required");
      }

      next();
    } catch (error: any) {
      throw new ApiError(403, error?.message || "Admin access required");
    }
  }
);

export const requireVendor = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || user.role !== "vendor") {
        throw new ApiError(403, "Vendor access required");
      }

      next();
    } catch (error: any) {
      throw new ApiError(403, error?.message || "Vendor access required");
    }
  }
);

export const requirePIC = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || user.role !== "parkingincharge") {
        throw new ApiError(403, "Parking In Charge access required");
      }

      next();
    } catch (error: any) {
      throw new ApiError(
        403,
        error?.message || "Parking In Charge access required"
      );
    }
  }
);

export const requireUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || user.role !== "user") {
        throw new ApiError(403, "User access required");
      }

      next();
    } catch (error: any) {
      throw new ApiError(403, error?.message || "User access required");
    }
  }
);

// Multi-role middleware
export const requireRole = (allowedRoles: string[]) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;

        if (!user || !allowedRoles.includes(user.role)) {
          throw new ApiError(
            403,
            `Access denied. Required roles: ${allowedRoles.join(", ")}`
          );
        }

        next();
      } catch (error: any) {
        throw new ApiError(403, error?.message || "Access denied");
      }
    }
  );
};

// Owner or Admin middleware (for users to access their own data or admin to access any)
export const requireOwnerOrAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const resourceUserId = parseInt(req.params.userId || req.params.id);

      if (!user) {
        throw new ApiError(401, "Authentication required");
      }

      // Admin can access any resource
      if (user.role === "admin") {
        return next();
      }

      // Users can only access their own resources
      if (user.id !== resourceUserId) {
        throw new ApiError(403, "You can only access your own resources");
      }

      next();
    } catch (error: any) {
      throw new ApiError(403, error?.message || "Access denied");
    }
  }
);

// Vendor or Admin middleware
export const requireVendorOrAdmin = requireRole(["vendor", "admin"]);

// PIC or Admin middleware
export const requirePICOrAdmin = requireRole(["parkingincharge", "admin"]);
