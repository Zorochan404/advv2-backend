import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../../drizzle/db";
import { couponTable, couponStatusEnum } from "./couponmodel";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/responseHandler";

/**
 * Clear all coupons from the database
 * @route DELETE /api/v1/coupons/clear
 * @access Private (Admin only)
 */
export const clearCoupons = asyncHandler(
  async (
    req: Request & { user?: { id: number; role?: string } },
    res: Response
  ) => {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      throw new ApiError(403, "Only admins can clear coupons");
    }

    // Clear all coupons
    await db.delete(couponTable);

    return sendSuccess(res, {}, "All coupons cleared successfully", 200);
  }
);

/**
 * Seed coupons with dummy data
 * @route POST /api/v1/coupons/seed
 * @access Private (Admin only)
 */
export const seedCoupons = asyncHandler(
  async (
    req: Request & { user?: { id: number; role?: string } },
    res: Response
  ) => {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      throw new ApiError(403, "Only admins can seed coupons");
    }

    // Clear existing coupons first
    await db.delete(couponTable);
    console.log("Cleared existing coupons");

    // Check if coupons already exist
    const existingCoupons = await db.select().from(couponTable);
    const couponCount = existingCoupons.length;

    if (couponCount > 0) {
      return sendSuccess(
        res,
        {
          existingCount: couponCount,
        },
        "Coupons already exist in the database",
        200
      );
    }

    // Sample coupon data
    const coupons = [
      {
        code: "WELCOME10",
        name: "Welcome Discount",
        description: "10% off on your first booking",
        discountAmount: "10", // For percentage type
        discountType: "percentage",
        minBookingAmount: "1000",
        maxDiscountAmount: "500",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        status: couponStatusEnum.enumValues[0],
        usageLimit: 100,
        perUserLimit: 1,
        isActive: true,
        createdBy: req.user.id,
      },
      {
        code: "SUMMER25",
        name: "Summer Special",
        description: "25% off on summer bookings",
        discountAmount: "25", // For percentage type
        discountType: "percentage",
        minBookingAmount: "2000",
        maxDiscountAmount: "1000",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: couponStatusEnum.enumValues[0],
        usageLimit: 50,
        perUserLimit: 1,
        isActive: true,
        createdBy: req.user.id,
      },
      {
        code: "FLAT500",
        name: "Flat Discount",
        description: "Flat ₹500 off on bookings above ₹2500",
        discountAmount: "500", // For fixed type
        discountType: "fixed",
        minBookingAmount: "2500",
        maxDiscountAmount: "500",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        status: couponStatusEnum.enumValues[0],
        usageLimit: 200,
        perUserLimit: 2,
        isActive: true,
        createdBy: req.user.id,
      },
      {
        code: "WEEKEND15",
        name: "Weekend Offer",
        description: "15% off on weekend bookings",
        discountAmount: "15", // For percentage type
        discountType: "percentage",
        minBookingAmount: "1500",
        maxDiscountAmount: "750",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: couponStatusEnum.enumValues[0],
        usageLimit: 75,
        perUserLimit: 3,
        isActive: true,
        createdBy: req.user.id,
      },
      {
        code: "LONGTRIP",
        name: "Long Trip Discount",
        description: "20% off on bookings for 5+ days",
        discountAmount: "20", // For percentage type
        discountType: "percentage",
        minBookingAmount: "5000",
        maxDiscountAmount: "2000",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
        status: couponStatusEnum.enumValues[0],
        usageLimit: 30,
        perUserLimit: 1,
        isActive: true,
        createdBy: req.user.id,
      },
    ];

    // Insert coupons into the database
    const insertedCoupons = await db
      .insert(couponTable)
      .values(coupons)
      .returning();

    return sendSuccess(
      res,
      {
        coupons: insertedCoupons,
        count: insertedCoupons.length,
      },
      "Coupons seeded successfully",
      201
    );
  }
);
