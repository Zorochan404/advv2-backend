import { Request, Response } from "express";
import { UserTable } from "../user/usermodel";
import { db } from "../../drizzle/db";
import { and, eq, or } from "drizzle-orm";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendCreated } from "../utils/responseHandler";
import { withDatabaseErrorHandling } from "../utils/dbErrorHandler";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";

export const loginuser = asyncHandler(async (req: Request, res: Response) => {
  // Add deprecation warning header
  res.set('X-Deprecated-Endpoint', 'true');
  res.set('X-Deprecation-Message', 'This endpoint is deprecated. Use /api/v1/auth/v2/login with authMethod: "otp" instead.');
  
  const { number, otp, password } = req.body;

  // Validate required fields
  if (!number) {
    throw ApiError.badRequest("Phone number is required");
  }

  // Validate phone number format
  if (!/^[0-9]{10}$/.test(number)) {
    throw ApiError.badRequest("Invalid phone number format. Must be 10 digits");
  }

  // Check if user is trying to use password-based login or OTP-based login
  const isPasswordLogin = password && !otp;
  const isOtpLogin = otp && !password;

  if (!isPasswordLogin && !isOtpLogin) {
    throw ApiError.badRequest("Either password or OTP is required");
  }

  const result = await withDatabaseErrorHandling(async () => {
    const existingUsers = await db
      .select()
      .from(UserTable)
      .where(eq(UserTable.number, number));

    if (existingUsers.length === 0) {
      // User doesn't exist, create new user (only for OTP-based login)
      if (isOtpLogin) {
        const newUser = await db
          .insert(UserTable)
          .values({
            number: number,
            role: "user",
            password: otp, // Store OTP as password for new users
          })
          .returning();

        // Generate access token for new user
        const accessToken = jwt.sign(
          {
            _id: newUser[0].id,
            number: newUser[0].number,
            role: newUser[0].role,
          },
          process.env.ACCESS_TOKEN_SECRET as string,
          {
            expiresIn: "1d",
          }
        );

        // Exclude password from user object before sending response
        const { password: _password, ...userWithoutPassword } = newUser[0];

        return {
          user: userWithoutPassword,
          accessToken,
          isNewUser: true,
        };
      } else {
        throw ApiError.unauthorized("User not found");
      }
    }

    // User exists, check authentication method
    const user = existingUsers[0];

    if (isPasswordLogin) {
      // Password-based login (for admin, PIC, vendor, user with hashed passwords)
      if (!user.password) {
        throw ApiError.unauthorized("User does not have a password set");
      }

      // Check if password is hashed (starts with $2b$)
      if (user.password.startsWith("$2b$")) {
        // Hashed password - use bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          throw ApiError.unauthorized("Invalid password");
        }
      } else {
        // Plain text password - direct comparison
        if (user.password !== password) {
          throw ApiError.unauthorized("Invalid password");
        }
      }
    } else {
      // OTP-based login (for users and vendors)
      if (user.role === "admin" || user.role === "parkingincharge") {
        throw ApiError.forbidden(
          "Admin and PIC users must use password-based login"
        );
      }

      // Check if user has a password/OTP
      if (!user.password) {
        throw ApiError.unauthorized("User does not have OTP set");
      }

      // For OTP login, check if password matches OTP
      if (user.password !== otp) {
        throw ApiError.unauthorized("Invalid OTP");
      }
    }

    // Generate access token
    const accessToken = jwt.sign(
      {
        _id: user.id,
        number: user.number,
        role: user.role,
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      {
        expiresIn: "1d",
      }
    );

    // Exclude password from user object before sending response
    const { password: _password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      isNewUser: false,
    };
  }, "loginuser");

  const message = result.isNewUser
    ? "User created and logged in successfully"
    : "User login successful";

  return sendSuccess(res, result, message);
});

export const registerAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    // Add deprecation warning header
    res.set('X-Deprecated-Endpoint', 'true');
    res.set('X-Deprecation-Message', 'This endpoint is deprecated. Use /api/v1/auth/v2/staff/register instead.');
    
    const {
      number,
      password,
      role,
      name,
      email,
      parkingid,
      locality,
      city,
      state,
      country,
      pincode,
      isverified,
      avatar,
      age,
      aadharNumber,
      aadharimg,
      dlNumber,
      dlimg,
      passportNumber,
      passportimg,
      lat,
      lng,
    } = req.body;

    // Validate required fields
    if (!number || !password || !role) {
      throw ApiError.badRequest("Number, password, and role are required");
    }

    // Validate phone number format
    if (!/^[0-9]{10}$/.test(number)) {
      throw ApiError.badRequest(
        "Invalid phone number format. Must be 10 digits"
      );
    }

    // Validate role
    const validRoles = ["admin", "user", "vendor", "parkingincharge"];
    if (!validRoles.includes(role)) {
      throw ApiError.badRequest(
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    const user = await withDatabaseErrorHandling(async () => {
      const existingUsers = await db
        .select()
        .from(UserTable)
        .where(and(eq(UserTable.number, number), eq(UserTable.role, role)));

      if (existingUsers.length > 0) {
        throw ApiError.conflict(
          "User with this number and role already exists"
        );
      }

      // Hash the password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const newUser = await db
        .insert(UserTable)
        .values({
          number: number,
          password: hashedPassword,
          role: role,
          name: name || null,
          email: email || null,
          parkingid: parkingid || null,
          locality: locality || null,
          city: city || null,
          state: state || null,
          country: country || null,
          pincode: pincode || null,
          isverified: isverified || false,
          avatar: avatar || null,
          age: age || null,
          aadharNumber: aadharNumber || null,
          aadharimg: aadharimg || null,
          dlNumber: dlNumber || null,
          dlimg: dlimg || null,
          passportNumber: passportNumber || null,
          passportimg: passportimg || null,
          lat: lat || null,
          lng: lng || null,
        })
        .returning();

      // Generate access token for new admin user
      const accessToken = jwt.sign(
        {
          _id: newUser[0].id,
          number: newUser[0].number,
          role: newUser[0].role,
        },
        process.env.ACCESS_TOKEN_SECRET as string,
        {
          expiresIn: "1d",
        }
      );

      // Exclude password from user object before sending response
      const { password: _password, ...userWithoutPassword } = newUser[0];
      return {
        user: userWithoutPassword,
        accessToken,
      };
    }, "registerAdmin");

    return sendSuccess(res, user, "Admin user created successfully");
  }
);

export const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
  // Add deprecation warning header
  res.set('X-Deprecated-Endpoint', 'true');
  res.set('X-Deprecation-Message', 'This endpoint is deprecated. Use /api/v1/auth/v2/login with authMethod: "password" instead.');
  
  const { number, password } = req.body;

  // Validate required fields
  if (!number || !password) {
    throw ApiError.badRequest("Number and password are required");
  }

  // Validate phone number format
  if (!/^[0-9]{10}$/.test(number)) {
    throw ApiError.badRequest("Invalid phone number format. Must be 10 digits");
  }

  const result = await withDatabaseErrorHandling(async () => {
    const existingUsers = await db
      .select()
      .from(UserTable)
      .where(eq(UserTable.number, number));

    if (existingUsers.length === 0) {
      throw ApiError.unauthorized("Invalid phone number");
    }

    const user = existingUsers[0];

    // Check if user has a password
    if (!user.password) {
      throw ApiError.unauthorized("Please provide a password");
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw ApiError.unauthorized("Invalid password");
    }

    // Generate JWT token
    if (!process.env.ACCESS_TOKEN_SECRET) {
      throw ApiError.internal(
        "Server misconfiguration: missing ACCESS_TOKEN_SECRET"
      );
    }

    const accessToken = jwt.sign(
      {
        _id: user.id,
        number: user.number,
        role: user.role,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "1d",
      }
    );

    // Exclude password from user object before sending response
    const { password: _password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
    };
  }, "loginAdmin");

  return sendSuccess(res, result, "Admin login successful");
});

// Migration function to hash existing plain text passwords
export const migratePasswords = asyncHandler(
  async (req: Request, res: Response) => {
    // This should only be run by admins
    const currentUser = (req as any).user;
    if (!currentUser || currentUser.role !== "admin") {
      throw ApiError.forbidden("Only admins can run password migration");
    }

    const result = await withDatabaseErrorHandling(async () => {
      // Get all users with plain text passwords (not starting with $2b$)
      const usersWithPlainPasswords = await db
        .select()
        .from(UserTable)
        .where(
          sql`${UserTable.password} NOT LIKE '$2b$%' AND ${UserTable.password} IS NOT NULL`
        );

      let migratedCount = 0;
      const saltRounds = 12;

      for (const user of usersWithPlainPasswords) {
        if (user.password && !user.password.startsWith("$2b$")) {
          // Hash the plain text password
          const hashedPassword = await bcrypt.hash(user.password, saltRounds);

          // Update the user with hashed password
          await db
            .update(UserTable)
            .set({ password: hashedPassword })
            .where(eq(UserTable.id, user.id));

          migratedCount++;
        }
      }

      return {
        totalUsers: usersWithPlainPasswords.length,
        migratedCount,
        message: `Successfully migrated ${migratedCount} passwords to hashed format`,
      };
    }, "migratePasswords");

    return sendSuccess(res, result, "Password migration completed");
  }
);
