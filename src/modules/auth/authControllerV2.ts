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

// Types for authentication
export interface AuthRequest {
  identifier: string; // Phone number or email
  password?: string;
  otp?: string;
  authMethod: "password" | "otp";
}

export interface RegisterRequest {
  number: string;
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  // Additional fields for staff registration
  parkingid?: number;
  locality?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  isverified?: boolean;
  avatar?: string;
  age?: number;
  aadharNumber?: string;
  aadharimg?: string;
  dlNumber?: string;
  dlimg?: string;
  passportNumber?: string;
  passportimg?: string;
  lat?: number;
  lng?: number;
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
const checkRateLimit = (key: string, maxAttempts: number, windowMs: number): boolean => {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  return true;
};

// Generate JWT tokens
const generateTokens = (user: any) => {
  const payload = {
    _id: user.id,
    number: user.number,
    role: user.role,
  };

  const accessToken = jwt.sign(
    payload,
    process.env.ACCESS_TOKEN_SECRET as string,
    { expiresIn: "1h" }
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.REFRESH_TOKEN_SECRET as string,
    { expiresIn: "30d" }
  );

  return { accessToken, refreshToken };
};

// Validate phone number format
const validatePhoneNumber = (number: string): boolean => {
  return /^[0-9]{10}$/.test(number);
};

// Validate email format
const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Unified login endpoint
export const unifiedLogin = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password, otp, authMethod }: AuthRequest = req.body;

  // Validate required fields
  if (!identifier || !authMethod) {
    throw ApiError.badRequest("Identifier and authMethod are required");
  }

  // Validate auth method
  if (!["password", "otp"].includes(authMethod)) {
    throw ApiError.badRequest("authMethod must be 'password' or 'otp'");
  }

  // Validate credentials based on auth method
  if (authMethod === "password" && !password) {
    throw ApiError.badRequest("Password is required for password authentication");
  }

  if (authMethod === "otp" && !otp) {
    throw ApiError.badRequest("OTP is required for OTP authentication");
  }

  // Rate limiting
  const rateLimitKey = `login:${req.ip}:${identifier}`;
  if (!checkRateLimit(rateLimitKey, 5, 5 * 60 * 1000)) { // 5 attempts per 5 minutes
    throw new ApiError(429, "Too many login attempts. Please try again later.");
  }

  // Validate identifier format
  const isPhoneNumber = validatePhoneNumber(identifier);
  const isEmail = validateEmail(identifier);

  if (!isPhoneNumber && !isEmail) {
    throw ApiError.badRequest("Invalid identifier format. Must be a valid phone number or email.");
  }

  const result = await withDatabaseErrorHandling(async () => {
    // Find user by identifier
    const whereCondition = isPhoneNumber 
      ? eq(UserTable.number, parseInt(identifier))
      : eq(UserTable.email, identifier);

    const existingUsers = await db
      .select()
      .from(UserTable)
      .where(whereCondition);

    if (existingUsers.length === 0) {
      // User doesn't exist
      if (authMethod === "otp" && isPhoneNumber) {
        // Auto-register new user with OTP (existing behavior for backward compatibility)
        const newUser = await db
          .insert(UserTable)
          .values({
            number: parseInt(identifier),
            role: "user",
            password: otp, // Store OTP as password for new users
            isverified: false,
          })
          .returning();

        const tokens = generateTokens(newUser[0]);
        const { password: _password, ...userWithoutPassword } = newUser[0];

        return {
          user: userWithoutPassword,
          tokens,
          isNewUser: true,
        };
      } else {
        throw ApiError.unauthorized("Invalid credentials");
      }
    }

    // User exists, authenticate
    const user = existingUsers[0];

    if (authMethod === "password") {
      // Password-based authentication
      if (!user.password) {
        throw ApiError.unauthorized("User does not have a password set");
      }

      // Check if password is hashed
      if (user.password.startsWith("$2b$")) {
        // Hashed password - use bcrypt
        const isPasswordValid = await bcrypt.compare(password!, user.password);
        if (!isPasswordValid) {
          throw ApiError.unauthorized("Invalid credentials");
        }
      } else {
        // Plain text password - direct comparison (for backward compatibility)
        if (user.password !== password) {
          throw ApiError.unauthorized("Invalid credentials");
        }
      }
    } else {
      // OTP-based authentication
      if (user.role === "admin" || user.role === "parkingincharge") {
        throw ApiError.forbidden("Admin and PIC users must use password-based login");
      }

      if (!user.password) {
        throw ApiError.unauthorized("User does not have OTP set");
      }

      // For OTP login, check if password matches OTP
      if (user.password !== otp) {
        throw ApiError.unauthorized("Invalid credentials");
      }
    }

    // Generate tokens
    const tokens = generateTokens(user);
    const { password: _password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
      isNewUser: false,
    };
  }, "unifiedLogin");

  const message = result.isNewUser
    ? "User created and logged in successfully"
    : "Login successful";

  return sendSuccess(res, result, message);
});

// User registration endpoint
export const registerUser = asyncHandler(async (req: Request, res: Response) => {
// Validate required fields
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
  }: RegisterRequest = req.body;

  if (!number) {
    throw ApiError.badRequest("Phone number is required");
  }

  // Validate phone number format
  if (!validatePhoneNumber(number)) {
    throw ApiError.badRequest("Invalid phone number format. Must be 10 digits");
  }

  // Validate email if provided
  if (email && !validateEmail(email)) {
    throw ApiError.badRequest("Invalid email format");
  }

  // Rate limiting
  const rateLimitKey = `register:${req.ip}:${number}`;
  if (!checkRateLimit(rateLimitKey, 3, 60 * 60 * 1000)) { // 3 attempts per hour
    throw new ApiError(429, "Too many registration attempts. Please try again later.");
  }

  const result = await withDatabaseErrorHandling(async () => {
    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(UserTable)
      .where(eq(UserTable.number, parseInt(number)));

    if (existingUsers.length > 0) {
      throw ApiError.conflict("User with this phone number already exists");
    }

    // Create new user
     const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password!, saltRounds);

    // Create new staff user
    const newUser = await db
      .insert(UserTable)
      .values({
        number: parseInt(number),
        password: hashedPassword,
        role: role as any,
        name: name || null,
        email: email || null,
        parkingid: parkingid || null,
        locality: locality || null,
        city: city || null,
        state: state || null,
        country: country || null,
        pincode: pincode ? parseInt(pincode) : null,
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

    const tokens = generateTokens(newUser[0]);
    const { password: _password, ...userWithoutPassword } = newUser[0];

    return {
      user: userWithoutPassword,
      tokens,
    };

  }, "registerUser");

  return sendCreated(res, result, "User registered successfully");
});

// Staff registration endpoint (admin only)
export const registerStaff = asyncHandler(async (req: Request, res: Response) => {
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
  }: RegisterRequest = req.body;

  // Validate required fields
  if (!number || !password || !role) {
    throw ApiError.badRequest("Number, password, and role are required");
  }

  // Validate phone number format
  if (!validatePhoneNumber(number)) {
    throw ApiError.badRequest("Invalid phone number format. Must be 10 digits");
  }

  // Validate email if provided
  if (email && !validateEmail(email)) {
    throw ApiError.badRequest("Invalid email format");
  }

  // Validate role
  const validRoles = ["admin", "vendor", "parkingincharge"];
  if (!validRoles.includes(role)) {
    throw ApiError.badRequest(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
  }

  const result = await withDatabaseErrorHandling(async () => {
    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(UserTable)
      .where(and(eq(UserTable.number, parseInt(number)), eq(UserTable.role, role as any)));

    if (existingUsers.length > 0) {
      throw ApiError.conflict("User with this number and role already exists");
    }

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new staff user
    const newUser = await db
      .insert(UserTable)
      .values({
        number: parseInt(number),
        password: hashedPassword,
        role: role as any,
        name: name || null,
        email: email || null,
        parkingid: parkingid || null,
        locality: locality || null,
        city: city || null,
        state: state || null,
        country: country || null,
        pincode: pincode ? parseInt(pincode) : null,
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

    const tokens = generateTokens(newUser[0]);
    const { password: _password, ...userWithoutPassword } = newUser[0];

    return {
      user: userWithoutPassword,
      tokens,
    };
  }, "registerStaff");

  return sendCreated(res, result, "Staff user created successfully");
});

// Token refresh endpoint
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw ApiError.badRequest("Refresh token is required");
  }

  const result = await withDatabaseErrorHandling(async () => {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET as string
      ) as any;

      // Find user
      const user = await db
        .select()
        .from(UserTable)
        .where(eq(UserTable.id, decoded._id))
        .limit(1)
        .then((rows) => rows[0]);

      if (!user) {
        throw ApiError.unauthorized("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = generateTokens(user);
      const { password: _password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        tokens,
      };
    } catch (error) {
      throw ApiError.unauthorized("Invalid refresh token");
    }
  }, "refreshToken");

  return sendSuccess(res, result, "Token refreshed successfully");
});

// Logout endpoint
export const logout = asyncHandler(async (req: Request, res: Response) => {
  // In a production system, you would:
  // 1. Add the token to a blacklist
  // 2. Remove the refresh token from the database
  // 3. Log the logout event
  
  return sendSuccess(res, {}, "Logged out successfully");
});

// Password reset request endpoint
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.body;

  if (!identifier) {
    throw ApiError.badRequest("Identifier is required");
  }

  // Rate limiting
  const rateLimitKey = `forgot-password:${req.ip}:${identifier}`;
  if (!checkRateLimit(rateLimitKey, 3, 60 * 60 * 1000)) { // 3 attempts per hour
    throw new ApiError(429, "Too many password reset attempts. Please try again later.");
  }

  const result = await withDatabaseErrorHandling(async () => {
    // Find user by identifier
    const isPhoneNumber = validatePhoneNumber(identifier);
    const whereCondition = isPhoneNumber 
      ? eq(UserTable.number, parseInt(identifier))
      : eq(UserTable.email, identifier);

    const user = await db
      .select()
      .from(UserTable)
      .where(whereCondition)
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) {
      // Don't reveal if user exists or not
      return { message: "If the account exists, a password reset link has been sent." };
    }

    // In a production system, you would:
    // 1. Generate a secure reset token
    // 2. Send an email/SMS with the reset link
    // 3. Store the reset token with expiration

    return { message: "If the account exists, a password reset link has been sent." };
  }, "forgotPassword");

  return sendSuccess(res, result, "Password reset request processed");
});

// Password reset confirmation endpoint
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw ApiError.badRequest("Token and new password are required");
  }

  // In a production system, you would:
  // 1. Verify the reset token
  // 2. Check if it's expired
  // 3. Hash the new password
  // 4. Update the user's password
  // 5. Invalidate the reset token

  return sendSuccess(res, {}, "Password reset successfully");
});
