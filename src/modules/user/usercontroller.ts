import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../../drizzle/db";
import { UserTable } from "./usermodel";
import { and, eq, like, or } from "drizzle-orm";
import { Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import {
  sendSuccess,
  sendItem,
  sendList,
  sendUpdated,
  sendDeleted,
  sendPaginated,
} from "../utils/responseHandler";
import { withDatabaseErrorHandling } from "../utils/dbErrorHandler";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Extend the Request interface to include 'user' property
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    role: string;
    // add other user properties if needed
  };
}

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate ID
  if (!id || !/^[0-9]+$/.test(id)) {
    throw ApiError.badRequest("Invalid user ID");
  }

  const user = await withDatabaseErrorHandling(async () => {
    const foundUser = await db
      .select()
      .from(UserTable)
      .where(eq(UserTable.id, Number(id)));

    if (!foundUser || foundUser.length === 0) {
      throw ApiError.notFound("User not found");
    }

    // Remove password from user object
    const { password, ...userWithoutPassword } = foundUser[0];
    return userWithoutPassword;
  }, "getUser");

  return sendItem(res, user, "User fetched successfully");
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { id: _id, password: _password, ...updateData } = req.body;

  // Validate ID
  if (!id || !/^[0-9]+$/.test(id)) {
    throw ApiError.badRequest("Invalid user ID");
  }

  // Check if user is trying to set isverified to true (only admins can do this)
  // const currentUser = (req as any).user;
  // if (updateData.isverified === true && currentUser.role !== "admin") {
  //   throw ApiError.forbidden("Only admins can verify user accounts");
  // }

  const user = await withDatabaseErrorHandling(async () => {
    const updatedUser = await db
      .update(UserTable)
      .set(updateData)
      .where(eq(UserTable.id, Number(id)))
      .returning();

    if (!updatedUser || updatedUser.length === 0) {
      throw ApiError.notFound("User not found");
    }

    // Remove password from user object
    const { password, ...userWithoutPassword } = updatedUser[0];
    return userWithoutPassword;
  }, "updateUser");

  return sendUpdated(res, user, "User updated successfully");
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate ID
  if (!id || !/^[0-9]+$/.test(id)) {
    throw ApiError.badRequest("Invalid user ID");
  }

  await withDatabaseErrorHandling(async () => {
    const deletedUser = await db
      .delete(UserTable)
      .where(eq(UserTable.id, Number(id)))
      .returning();

    if (!deletedUser || deletedUser.length === 0) {
      throw ApiError.notFound("User not found");
    }
  }, "deleteUser");

  return sendDeleted(res, "User deleted successfully");
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await withDatabaseErrorHandling(async () => {
    const allUsers = await db.select().from(UserTable);

    // Remove password from each user object
    return allUsers.map(({ password, ...user }) => user);
  }, "getAllUsers");

  return sendList(res, users, users.length, "All users fetched successfully");
});

export const searchUser = asyncHandler(async (req: Request, res: Response) => {
  const queryParams = req.query;

  // Extract pagination parameters
  const page = parseInt(queryParams.page as string) || 1;
  const limit = parseInt(queryParams.limit as string) || 10;
  const offset = (page - 1) * limit;

  // If no query parameters provided, return all users with pagination
  if (
    !queryParams ||
    Object.keys(queryParams).length === 0 ||
    (Object.keys(queryParams).length === 1 &&
      (queryParams.page || queryParams.limit))
  ) {
    const result = await withDatabaseErrorHandling(async () => {
      // Get total count
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(UserTable);
      const total = totalCount[0]?.count || 0;

      // Get paginated users
      const users = await db
        .select()
        .from(UserTable)
        .limit(limit)
        .offset(offset);

      return {
        users: users.map(({ password, ...user }) => user),
        total,
      };
    }, "searchUser");

    return sendPaginated(
      res,
      result.users,
      result.total,
      page,
      limit,
      "All users fetched successfully"
    );
  }

  const result = await withDatabaseErrorHandling(async () => {
    const conditions: any[] = [];

    // Build filter conditions based on provided query parameters
    Object.keys(queryParams).forEach((key) => {
      const value = queryParams[key] as string;

      if (value && key !== "page" && key !== "limit") {
        switch (key.toLowerCase()) {
          case "name":
            conditions.push(
              like(sql`lower(${UserTable.name})`, `%${value.toLowerCase()}%`)
            );
            break;
          case "email":
            conditions.push(
              like(sql`lower(${UserTable.email})`, `%${value.toLowerCase()}%`)
            );
            break;
          case "number":
          case "phone":
            const phoneNum = Number(value);
            if (!isNaN(phoneNum)) {
              conditions.push(eq(UserTable.number, phoneNum));
            }
            break;
          case "role":
            if (
              ["user", "admin", "vendor", "parkingincharge"].includes(value)
            ) {
              conditions.push(eq(UserTable.role, value as any));
            }
            break;
          case "city":
            conditions.push(
              like(sql`lower(${UserTable.city})`, `%${value.toLowerCase()}%`)
            );
            break;
          case "state":
            conditions.push(
              like(sql`lower(${UserTable.state})`, `%${value.toLowerCase()}%`)
            );
            break;
          case "country":
            conditions.push(
              like(sql`lower(${UserTable.country})`, `%${value.toLowerCase()}%`)
            );
            break;
          case "locality":
            conditions.push(
              like(
                sql`lower(${UserTable.locality})`,
                `%${value.toLowerCase()}%`
              )
            );
            break;
          case "pincode":
            const pincodeNum = Number(value);
            if (!isNaN(pincodeNum)) {
              conditions.push(eq(UserTable.pincode, pincodeNum));
            }
            break;
          case "aadharnumber":
          case "aadhar":
            conditions.push(
              like(
                sql`lower(${UserTable.aadharNumber})`,
                `%${value.toLowerCase()}%`
              )
            );
            break;
          case "dlnumber":
          case "dl":
            conditions.push(
              like(
                sql`lower(${UserTable.dlNumber})`,
                `%${value.toLowerCase()}%`
              )
            );
            break;
          case "passportnumber":
          case "passport":
            conditions.push(
              like(
                sql`lower(${UserTable.passportNumber})`,
                `%${value.toLowerCase()}%`
              )
            );
            break;
          case "isverified":
            const isVerified = value.toLowerCase() === "true";
            conditions.push(eq(UserTable.isverified, isVerified));
            break;
          default:
            // For any other parameter, try to match against name, email, or number
            conditions.push(
              or(
                like(sql`lower(${UserTable.name})`, `%${value.toLowerCase()}%`),
                like(
                  sql`lower(${UserTable.email})`,
                  `%${value.toLowerCase()}%`
                ),
                eq(UserTable.number, Number(value) || 0)
              )
            );
        }
      }
    });

    // If no valid conditions, return all users with pagination
    if (conditions.length === 0) {
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(UserTable);
      const total = totalCount[0]?.count || 0;

      const users = await db
        .select()
        .from(UserTable)
        .limit(limit)
        .offset(offset);

      return {
        users: users.map(({ password, ...user }) => user),
        total,
      };
    }

    // Get total count with filters
    const totalCountQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(UserTable)
      .where(and(...conditions));
    const total = totalCountQuery[0]?.count || 0;

    // Apply all conditions with AND logic and pagination
    const foundUsers = await db
      .select()
      .from(UserTable)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    // Remove password from each user object
    return {
      users: foundUsers.map(({ password, ...user }) => user),
      total,
    };
  }, "searchUser");

  return sendPaginated(
    res,
    result.users,
    result.total,
    page,
    limit,
    "Users found successfully"
  );
});

export const getUserbyrole = asyncHandler(
  async (req: Request, res: Response) => {
    const { role } = req.body;

    if (!role) {
      throw ApiError.badRequest("Role is required");
    }

    const users = await withDatabaseErrorHandling(async () => {
      const foundUsers = await db
        .select()
        .from(UserTable)
        .where(eq(UserTable.role, role));

      // Remove password from each user object
      return foundUsers.map(({ password, ...user }) => user);
    }, "getUserbyrole");

    return sendList(res, users, users.length, "Users fetched successfully");
  }
);

export const addParkingIncharge = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can add parking incharge");
    }

    const user = await withDatabaseErrorHandling(async () => {
      const newUser = await db
        .insert(UserTable)
        .values({ ...req.body, role: "parkingincharge" })
        .returning();

      // Remove password from user object
      const { password, ...userWithoutPassword } = newUser[0];
      return userWithoutPassword;
    }, "addParkingIncharge");

    return sendSuccess(res, user, "Parking incharge added successfully");
  }
);

export const getusersbyvendor = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "parkingincharge")
    ) {
      throw ApiError.forbidden(
        "You are not authorized to fetch users by vendor"
      );
    }

    const users = await withDatabaseErrorHandling(async () => {
      const foundUsers = await db
        .select()
        .from(UserTable)
        .where(eq(UserTable.role, "vendor"));

      // Remove password from each user object
      return foundUsers.map(({ password, ...user }) => user);
    }, "getusersbyvendor");

    return sendList(
      res,
      users,
      users.length,
      "Vendor users fetched successfully"
    );
  }
);

export const addvendor = asyncHandler(async (req: Request, res: Response) => {
  const user = await withDatabaseErrorHandling(async () => {
    const {
      password,
      role: _roleFromClient,
      ...rest
    } = req.body as {
      password?: string;
      role?: string;
      [key: string]: any;
    };

    // Check if a vendor with this number already exists
    if (rest.number) {
      const existingVendor = await db
        .select()
        .from(UserTable)
        .where(
          and(
            eq(UserTable.number, Number(rest.number)),
            eq(UserTable.role, "vendor" as any)
          )
        );

      if (existingVendor.length > 0) {
        throw ApiError.conflict(
          "Vendor with this phone number already exists"
        );
      }
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (password) {
      const saltRounds = 12;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    const newUser = await db
      .insert(UserTable)
      .values({
        ...rest,
        role: "vendor", // Force role to vendor for self-registration
        ...(hashedPassword ? { password: hashedPassword } : {}),
      })
      .returning();

    // Remove password from user object
    const { password: _pwd, ...userWithoutPassword } = newUser[0];
    return userWithoutPassword;
  }, "addvendor");

  return sendSuccess(res, user, "Vendor registered successfully");
});

export const getParkingInchargeByNumber = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden(
        "You are not authorized to fetch parking incharge by number"
      );
    }

    const { number } = req.body;

    if (!number) {
      throw ApiError.badRequest("Phone number is required");
    }

    const users = await withDatabaseErrorHandling(async () => {
      const foundUsers = await db
        .select()
        .from(UserTable)
        .where(
          and(
            eq(UserTable.number, number),
            eq(UserTable.role, "parkingincharge")
          )
        );

      // Remove password from each user object
      return foundUsers.map(({ password, ...user }) => user);
    }, "getParkingInchargeByNumber");

    return sendList(
      res,
      users,
      users.length,
      "Parking incharge fetched successfully"
    );
  }
);

export const assignParkingIncharge = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden(
        "You are not authorized to assign parking incharge"
      );
    }

    const { id, parkingid } = req.body;

    if (!id || !parkingid) {
      throw ApiError.badRequest("User ID and parking ID are required");
    }

    const user = await withDatabaseErrorHandling(async () => {
      const updatedUser = await db
        .update(UserTable)
        .set({ role: "parkingincharge", parkingid: parkingid })
        .where(eq(UserTable.id, id))
        .returning();

      if (!updatedUser || updatedUser.length === 0) {
        throw ApiError.notFound("User not found");
      }

      // Remove password from user object
      const { password, ...userWithoutPassword } = updatedUser[0];
      return userWithoutPassword;
    }, "assignParkingIncharge");

    return sendUpdated(res, user, "Parking incharge assigned successfully");
  }
);

export const getParkingInchargeByParkingId = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden(
        "You are not authorized to fetch parking incharge by parking id"
      );
    }

    const { parkingid } = req.params;

    if (!parkingid || !/^[0-9]+$/.test(parkingid)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    const users = await withDatabaseErrorHandling(async () => {
      const foundUsers = await db
        .select()
        .from(UserTable)
        .where(eq(UserTable.parkingid, Number(parkingid)));

      // Remove password from each user object
      return foundUsers.map(({ password, ...user }) => user);
    }, "getParkingInchargeByParkingId");

    return sendList(
      res,
      users,
      users.length,
      "Parking incharge fetched successfully"
    );
  }
);

// Update password function
export const updatePassword = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    // Validate that new password and confirm password match
    if (newPassword !== confirmPassword) {
      throw ApiError.badRequest(
        "New password and confirmation password do not match"
      );
    }

    // Get current user
    const currentUser = await db
      .select()
      .from(UserTable)
      .where(eq(UserTable.id, userId))
      .limit(1);

    if (!currentUser || currentUser.length === 0) {
      throw ApiError.notFound("User not found");
    }

    const user = currentUser[0];

    // Check if user has a password set
    if (!user.password) {
      throw ApiError.badRequest("User does not have a password set");
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw ApiError.unauthorized("Current password is incorrect");
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the password
    const updatedUser = await db
      .update(UserTable)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(UserTable.id, userId))
      .returning();

    if (!updatedUser || updatedUser.length === 0) {
      throw ApiError.internal("Failed to update password");
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser[0];

    return sendUpdated(
      res,
      userWithoutPassword,
      "Password updated successfully"
    );
  }
);
