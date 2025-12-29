import { Request, Response } from "express";
import { db } from "../../drizzle/db";
import { topupTable, bookingTopupTable } from "./topupmodel";
import { bookingsTable } from "./bookingmodel";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { eq, and, desc } from "drizzle-orm";
import {
  sendSuccess,
  sendCreated,
  sendUpdated,
  sendDeleted,
  sendItem,
  sendList,
} from "../utils/responseHandler";
import { withDatabaseErrorHandling } from "../utils/dbErrorHandler";

// Extend the Request interface to include 'user' property
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    role?: string;
  };
}

// Create topup (Admin only)
export const createTopup = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can create topups");
    }

    const { name, description, duration, price, category } = req.body;

    if (!name || !duration || !price) {
      throw ApiError.badRequest("Name, duration, and price are required");
    }

    const topup = await withDatabaseErrorHandling(async () => {
      const newTopup = await db
        .insert(topupTable)
        .values({
          name,
          description,
          duration: parseInt(duration),
          price: parseFloat(price),
          category: category || "extension",
          createdBy: req.user.id,
        })
        .returning();

      return newTopup[0];
    }, "createTopup");

    return sendCreated(res, topup, "Topup created successfully");
  }
);

// Get all active topups
export const getActiveTopups = asyncHandler(
  async (req: Request, res: Response) => {
    const topups = await withDatabaseErrorHandling(async () => {
      return await db
        .select()
        .from(topupTable)
        .where(eq(topupTable.isActive, true))
        .orderBy(desc(topupTable.createdAt));
    }, "getActiveTopups");

    return sendList(
      res,
      topups,
      topups.length,
      "Active topups fetched successfully"
    );
  }
);

// Apply topup to booking
export const applyTopupToBooking = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId, topupId, paymentReferenceId } = req.body;

    if (!bookingId || !topupId || !paymentReferenceId) {
      throw ApiError.badRequest(
        "Booking ID, topup ID, and payment reference ID are required"
      );
    }

    const result = await withDatabaseErrorHandling(async () => {
      // Get booking details
      const booking = await db.query.bookingsTable.findFirst({
        where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
      });

      if (!booking) {
        throw ApiError.notFound("Booking not found");
      }

      if (booking.userId !== req.user.id) {
        throw ApiError.forbidden(
          "You can only apply topups to your own bookings"
        );
      }

      // Get topup details
      const topup = await db
        .select()
        .from(topupTable)
        .where(eq(topupTable.id, topupId))
        .limit(1);

      if (!topup || topup.length === 0) {
        throw ApiError.notFound("Topup not found");
      }

      if (!topup[0].isActive) {
        throw ApiError.badRequest("This topup is not active");
      }

      // Calculate new end date
      const originalEndDate = new Date(booking.endDate);
      const extensionTime = topup[0].duration; // in hours
      const newEndDate = new Date(
        originalEndDate.getTime() + extensionTime * 60 * 60 * 1000
      );

      // Create booking-topup relationship
      const bookingTopup = await db
        .insert(bookingTopupTable)
        .values({
          bookingId: bookingId,
          topupId: topupId,
          appliedAt: new Date(),
          originalEndDate: originalEndDate,
          newEndDate: newEndDate,
          amount: topup[0].price,
          paymentStatus: "paid",
          paymentReferenceId: paymentReferenceId,
        })
        .returning();

      // Update booking with new end date and extension details
      const updatedBooking = await db
        .update(bookingsTable)
        .set({
          endDate: newEndDate,
          extensionPrice: topup[0].price,
          extensionTill: newEndDate,
          extensionTime: extensionTime,
        })
        .where(eq(bookingsTable.id, bookingId))
        .returning();

      return {
        bookingTopup: bookingTopup[0],
        updatedBooking: updatedBooking[0],
        topup: topup[0],
      };
    }, "applyTopupToBooking");

    return sendSuccess(res, result, "Topup applied successfully");
  }
);

// Get topups for a specific booking
export const getBookingTopups = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.params;

    if (!bookingId || !/^[0-9]+$/.test(bookingId)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    const topups = await withDatabaseErrorHandling(async () => {
      return await db.query.bookingTopupTable.findMany({
        where: (bookingTopupTable, { eq }) =>
          eq(bookingTopupTable.bookingId, parseInt(bookingId)),
        with: {
          topup: true,
        },
      });
    }, "getBookingTopups");

    return sendList(
      res,
      topups,
      topups.length,
      "Booking topups fetched successfully"
    );
  }
);

// Get all topups (Admin only)
export const getAllTopups = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can view all topups");
    }

    const topups = await withDatabaseErrorHandling(async () => {
      return await db
        .select()
        .from(topupTable)
        .orderBy(desc(topupTable.createdAt));
    }, "getAllTopups");

    return sendList(
      res,
      topups,
      topups.length,
      "All topups fetched successfully"
    );
  }
);

// Update topup (Admin only)
export const updateTopup = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can update topups");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid topup ID");
    }

    const topup = await withDatabaseErrorHandling(async () => {
      const updatedTopup = await db
        .update(topupTable)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(topupTable.id, parseInt(id)))
        .returning();

      if (!updatedTopup || updatedTopup.length === 0) {
        throw ApiError.notFound("Topup not found");
      }

      return updatedTopup[0];
    }, "updateTopup");

    return sendUpdated(res, topup, "Topup updated successfully");
  }
);

// Delete topup (Admin only)
export const deleteTopup = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can delete topups");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid topup ID");
    }

    await withDatabaseErrorHandling(async () => {
      const deletedTopup = await db
        .delete(topupTable)
        .where(eq(topupTable.id, parseInt(id)))
        .returning();

      if (!deletedTopup || deletedTopup.length === 0) {
        throw ApiError.notFound("Topup not found");
      }
    }, "deleteTopup");

    return sendDeleted(res, "Topup deleted successfully");
  }
);
