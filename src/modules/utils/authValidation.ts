import { z } from "zod";

// Unified login schema
export const unifiedLoginSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
  password: z.string().optional(),
  otp: z.string().optional(),
  authMethod: z.enum(["password", "otp"]),
}).refine((data) => {
  if (data.authMethod === "password" && !data.password) {
    return false;
  }
  if (data.authMethod === "otp" && !data.otp) {
    return false;
  }
  return true;
}, {
  message: "Password is required for password auth, OTP is required for OTP auth",
});

// User registration schema
export const userRegisterSchema = z.object({
  number: z.string()
    .min(10, "Phone number must be 10 digits")
    .max(10, "Phone number must be 10 digits")
    .regex(/^[0-9]{10}$/, "Phone number must contain only digits"),
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email format").optional(),
});

// Staff registration schema
export const staffRegisterSchema = z.object({
  number: z.string()
    .min(10, "Phone number must be 10 digits")
    .max(10, "Phone number must be 10 digits")
    .regex(/^[0-9]{10}$/, "Phone number must contain only digits"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters"),
  role: z.enum(["admin", "vendor", "parkingincharge"]),
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email format").optional(),
  parkingid: z.number().optional(),
  locality: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  isverified: z.boolean().optional(),
  avatar: z.string().optional(),
  age: z.number().min(1).max(120).optional(),
  aadharNumber: z.string().optional(),
  aadharimg: z.string().optional(),
  dlNumber: z.string().optional(),
  dlimg: z.string().optional(),
  passportNumber: z.string().optional(),
  passportimg: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// Token refresh schema
export const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters"),
});

// Logout schema (no body required, but keeping for consistency)
export const logoutSchema = z.object({});
