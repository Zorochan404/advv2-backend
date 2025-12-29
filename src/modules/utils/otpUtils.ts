import { ApiError } from "./apiError";

/**
 * Generate a random 4-digit OTP
 */
export const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Validate OTP format (4 digits)
 */
export const validateOTP = (otp: string): boolean => {
  return /^\d{4}$/.test(otp);
};

/**
 * Check if OTP is expired
 */
export const isOTPExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};

/**
 * Calculate OTP expiration time (15 minutes from now by default)
 */
export const getOTPExpirationTime = (minutes: number = 15): Date => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

/**
 * Calculate OTP expiration based on pickup time
 * If pickup is within 2 hours, OTP expires 30 minutes before pickup
 * Otherwise, OTP expires in 15 minutes
 */
export const getOTPExpirationForPickup = (pickupDate: Date): Date => {
  const now = new Date();
  const timeToPickup = pickupDate.getTime() - now.getTime();
  const hoursToPickup = timeToPickup / (1000 * 60 * 60);

  if (hoursToPickup <= 2) {
    // If pickup is within 2 hours, OTP expires 30 minutes before pickup
    return new Date(pickupDate.getTime() - 30 * 60 * 1000);
  } else {
    // Otherwise, OTP expires in 15 minutes
    return getOTPExpirationTime(15);
  }
};

/**
 * Check if OTP should be regenerated due to pickup time change
 */
export const shouldRegenerateOTP = (
  currentOTPExpiresAt: Date | null,
  pickupDate: Date
): boolean => {
  if (!currentOTPExpiresAt) return true;

  const expectedExpiration = getOTPExpirationForPickup(pickupDate);
  const timeDifference = Math.abs(
    expectedExpiration.getTime() - currentOTPExpiresAt.getTime()
  );

  // Regenerate if expiration time differs by more than 5 minutes
  return timeDifference > 5 * 60 * 1000;
};

/**
 * Verify OTP with proper error handling
 */
export const verifyOTP = (
  providedOTP: string,
  storedOTP: string | null,
  expiresAt: Date | null,
  isVerified: boolean
): void => {
  // Check if OTP exists
  if (!storedOTP) {
    throw ApiError.badRequest("No OTP found for this booking");
  }

  // Check if OTP is already verified
  if (isVerified) {
    throw ApiError.badRequest("OTP has already been verified");
  }

  // Check if OTP is expired
  if (expiresAt && isOTPExpired(expiresAt)) {
    throw ApiError.badRequest("OTP has expired. Please request a new one");
  }

  // Validate OTP format
  if (!validateOTP(providedOTP)) {
    throw ApiError.badRequest(
      "Invalid OTP format. Please enter a 4-digit code"
    );
  }

  // Check if OTP matches
  if (providedOTP !== storedOTP) {
    throw ApiError.badRequest("Invalid OTP. Please check and try again");
  }
};
