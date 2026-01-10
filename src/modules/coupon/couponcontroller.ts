import { Request, Response } from "express";
import { db } from "../../drizzle/db";
import { couponTable } from "./couponmodel";
import { asyncHandler } from "../utils/asyncHandler";
import { eq, and, lt, gt, sql, desc, gte, lte } from "drizzle-orm";
import { ApiError } from "../utils/apiError";
import {
  sendSuccess,
  sendCreated,
  sendUpdated,
  sendDeleted,
  sendItem,
  sendList,
} from "../utils/responseHandler";
import { bookingsTable } from "../booking/bookingmodel";

// Add couponId field to bookingsTable type for TypeScript
declare module "../booking/bookingmodel" {
  interface BookingsTable {
    couponId?: number;
  }
}

// Extend the Request interface to include 'user' property
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    role?: string;
    // add other user properties if needed
  };
}

// Create a new coupon (admin only)
export const createCoupon = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    // Check if user is admin
    if (req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can create coupons");
    }

    const {
      code,
      name,
      description,
      discountAmount,
      discountType,
      minBookingAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      usageLimit,
      perUserLimit,
    } = req.body;

    // Validate required fields
    if (!code || !name || !discountAmount || !discountType || !startDate || !endDate) {
      throw ApiError.badRequest(
        "Code, name, discount amount, discount type, start date, and end date are required"
      );
    }

    // Validate dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw ApiError.badRequest("Invalid date format");
    }

    if (startDateObj >= endDateObj) {
      throw ApiError.badRequest("End date must be after start date");
    }

    // Check if coupon code already exists
    const existingCoupon = await db
      .select()
      .from(couponTable)
      .where(eq(couponTable.code, code));

    if (existingCoupon.length > 0) {
      throw ApiError.conflict("Coupon code already exists");
    }

    // Create new coupon
    const newCoupon = await db
      .insert(couponTable)
      .values({
        code,
        name,
        description,
        discountAmount,
        discountType,
        minBookingAmount: minBookingAmount || 0,
        maxDiscountAmount,
        startDate: startDateObj,
        endDate: endDateObj,
        usageLimit,
        perUserLimit: perUserLimit || 1,
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return sendCreated(res, newCoupon[0], "Coupon created successfully");
  }
);

// Get all coupons (admin only)
export const getAllCoupons = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    // Check if user is admin
    if (req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can view all coupons");
    }

    const coupons = await db.select().from(couponTable).orderBy(desc(couponTable.createdAt));

    return sendList(res, coupons, coupons.length, "Coupons retrieved successfully");
  }
);

// Get active coupons (for users)
export const getActiveCoupons = asyncHandler(
  async (req: Request, res: Response) => {
    const currentDate = new Date();

    const coupons = await db.query.couponTable.findMany({
      where: (couponTable, { and, gt, lt, eq }) =>
        and(
          eq(couponTable.isActive, true),
          eq(couponTable.status, "active"),
          lte(couponTable.startDate, currentDate),
          gte(couponTable.endDate, currentDate),
          sql`(${couponTable.usageLimit} = 0 OR ${couponTable.usageCount} < ${couponTable.usageLimit})`
        ),
      orderBy: (couponTable, { desc }) => [desc(couponTable.createdAt)],
    });

    return sendList(res, coupons, coupons.length, "Active coupons retrieved successfully");
  }
);

// Get coupon by ID
export const getCouponById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const coupon = await db.query.couponTable.findFirst({
      where: (couponTable, { eq }) => eq(couponTable.id, Number(id)),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!coupon) {
      throw ApiError.notFound("Coupon not found");
    }

    return sendItem(res, coupon, "Coupon retrieved successfully");
  }
);

// Update coupon (admin only)
export const updateCoupon = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    // Check if user is admin
    if (req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can update coupons");
    }

    const { id } = req.params;
    const {
      code,
      name,
      description,
      discountAmount,
      discountType,
      minBookingAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      status,
      usageLimit,
      perUserLimit,
      isActive,
    } = req.body;

    // Check if coupon exists
    const existingCoupon = await db
      .select()
      .from(couponTable)
      .where(eq(couponTable.id, parseInt(id)));

    if (existingCoupon.length === 0) {
      throw ApiError.notFound("Coupon not found");
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
    if (discountType !== undefined) updateData.discountType = discountType;
    if (minBookingAmount !== undefined) updateData.minBookingAmount = minBookingAmount;
    if (maxDiscountAmount !== undefined) updateData.maxDiscountAmount = maxDiscountAmount;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (status !== undefined) updateData.status = status;
    if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
    if (perUserLimit !== undefined) updateData.perUserLimit = perUserLimit;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update coupon
    const updatedCoupon = await db
      .update(couponTable)
      .set(updateData)
      .where(eq(couponTable.id, parseInt(id)))
      .returning();

    return sendUpdated(res, updatedCoupon[0], "Coupon updated successfully");
  }
);

// Delete coupon (admin only)
export const deleteCoupon = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    // Check if user is admin
    if (req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can delete coupons");
    }

    const { id } = req.params;

    // Check if coupon exists
    const existingCoupon = await db
      .select()
      .from(couponTable)
      .where(eq(couponTable.id, parseInt(id)));

    if (existingCoupon.length === 0) {
      throw ApiError.notFound("Coupon not found");
    }

    // Delete coupon
    await db.delete(couponTable).where(eq(couponTable.id, parseInt(id)));

    return sendDeleted(res, "Coupon deleted successfully");
  }
);

// Validate coupon for a booking
export const validateCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, bookingAmount, userId } = req.body;

    if (!code || !bookingAmount) {
      throw ApiError.badRequest("Coupon code and booking amount are required");
    }

    const currentDate = new Date();

    // Find the coupon
    const coupon = await db.query.couponTable.findFirst({
      where: (couponTable, { and, gt, lt, eq }) =>
        and(
          eq(couponTable.code, code),
          eq(couponTable.isActive, true),
          eq(couponTable.status, "active"),
          lt(couponTable.startDate, currentDate),
          gt(couponTable.endDate, currentDate),
          sql`(${couponTable.usageLimit} IS NULL OR ${couponTable.usageCount} < ${couponTable.usageLimit})`
        ),
    });

    if (!coupon) {
      throw ApiError.notFound("Coupon not found or expired");
    }

    // Check minimum booking amount
    if (coupon.minBookingAmount !== null && parseFloat(bookingAmount) < parseFloat(coupon.minBookingAmount.toString())) {
      throw ApiError.badRequest(
        `Minimum booking amount for this coupon is ${coupon.minBookingAmount}`
      );
    }

    // Check if user has already used this coupon (if userId is provided)
    if (userId && coupon.perUserLimit) {
      const userBookingsWithCoupon = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.userId, parseInt(userId)),
            eq(bookingsTable.couponId, coupon.id)
          )
        );

      if (userBookingsWithCoupon.length >= coupon.perUserLimit) {
        throw ApiError.badRequest(
          `You have already used this coupon ${coupon.perUserLimit} time(s)`
        );
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (parseFloat(bookingAmount) * parseFloat(coupon.discountAmount.toString())) / 100;

      // Apply max discount if applicable
      if (coupon.maxDiscountAmount && discountAmount > parseFloat(coupon.maxDiscountAmount.toString())) {
        discountAmount = parseFloat(coupon.maxDiscountAmount.toString());
      }
    } else {
      // Fixed discount
      discountAmount = parseFloat(coupon.discountAmount.toString());
    }

    // Return coupon details with calculated discount
    return sendSuccess(res, {
      coupon,
      discountAmount,
      finalAmount: parseFloat(bookingAmount) - discountAmount,
    }, "Coupon validated successfully");
  }
);
