import { Request, Response } from "express";
import { eq, and, desc, sum, count } from "drizzle-orm";
import { db } from "../../drizzle/db";
import { paymentsTable, paymentSummaryTable } from "./paymentmodel";
import { bookingsTable } from "../booking/bookingmodel";
import { UserTable } from "../user/usermodel";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { sendSuccess, sendCreated, sendUpdated } from "../utils/responseHandler";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    [key: string]: any;
  };
}

// Generate unique payment ID
const generatePaymentId = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY_${timestamp}_${random}`;
};

// Create a new payment record
export const createPayment = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      type,
      amount,
      method = "razorpay",
      currency = "INR",
      bookingId,
      topupId,
      referenceId,
      metadata,
      notes,
    } = req.body;

    if (!type || !amount || amount <= 0) {
      throw ApiError.badRequest("Payment type and amount are required");
    }

    // Validate booking exists if provided
    if (bookingId) {
      const booking = await db.query.bookingsTable.findFirst({
        where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
      });

      if (!booking) {
        throw ApiError.notFound("Booking not found");
      }

      // Ensure user can only create payments for their own bookings
      if (booking.userId !== Number(req.user.id)) {
        throw ApiError.forbidden("You can only create payments for your own bookings");
      }
    }

    const paymentId = generatePaymentId();
    const fees = 0; // Calculate based on payment method and amount
    const netAmount = amount - fees;

    const newPayment = await db
      .insert(paymentsTable)
      .values({
        paymentId,
        referenceId,
        type,
        method,
        amount,
        currency,
        fees,
        netAmount,
        userId: Number(req.user.id),
        bookingId,
        topupId,
        metadata,
        notes,
        status: "pending",
        initiatedAt: new Date(),
      })
      .returning();

    // Update payment summary
    await updatePaymentSummary(Number(req.user.id), bookingId);

    return sendCreated(
      res,
      newPayment[0],
      "Payment created successfully"
    );
  }
);

// Update payment status (typically called by payment gateway webhook)
export const updatePaymentStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { paymentId, status, gatewayTransactionId, gatewayResponse, failureReason } = req.body;

    if (!paymentId || !status) {
      throw ApiError.badRequest("Payment ID and status are required");
    }

    const payment = await db.query.paymentsTable.findFirst({
      where: (paymentsTable, { eq }) => eq(paymentsTable.paymentId, paymentId),
    });

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    const updateData: any = {
      status,
      gatewayTransactionId,
      gatewayResponse,
      updatedAt: new Date(),
    };

    // Set appropriate timestamp based on status
    switch (status) {
      case "processing":
        updateData.processedAt = new Date();
        break;
      case "completed":
        updateData.completedAt = new Date();
        break;
      case "failed":
        updateData.failedAt = new Date();
        updateData.failureReason = failureReason;
        updateData.retryCount = (payment.retryCount || 0) + 1;
        break;
    }

    const updatedPayment = await db
      .update(paymentsTable)
      .set(updateData)
      .where(eq(paymentsTable.paymentId, paymentId))
      .returning();

    // Update payment summary
    await updatePaymentSummary(payment.userId, payment.bookingId || undefined);

    return sendUpdated(
      res,
      updatedPayment[0],
      "Payment status updated successfully"
    );
  }
);

// Get payment by ID
export const getPaymentById = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { paymentId } = req.params;

    const payment = await db.query.paymentsTable.findFirst({
      where: (paymentsTable, { eq }) => eq(paymentsTable.paymentId, paymentId),
      with: {
        user: true,
        booking: {
          with: {
            car: true,
          },
        },
        topup: true,
      },
    });

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    // Ensure user can only view their own payments
    if (payment.userId !== Number(req.user.id)) {
      throw ApiError.forbidden("You can only view your own payments");
    }

    return sendSuccess(res, payment, "Payment retrieved successfully");
  }
);

// Get payments by booking ID
export const getPaymentsByBooking = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.params;

    // Verify booking exists and user has access
    const booking = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, parseInt(bookingId)),
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    if (booking.userId !== Number(req.user.id)) {
      throw ApiError.forbidden("You can only view payments for your own bookings");
    }

    const payments = await db.query.paymentsTable.findMany({
      where: (paymentsTable, { eq }) => eq(paymentsTable.bookingId, parseInt(bookingId)),
      orderBy: [desc(paymentsTable.createdAt)],
    });

    return sendSuccess(res, payments, "Payments retrieved successfully");
  }
);

// Get user's payment history
export const getUserPayments = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page = 1, limit = 10, type, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = eq(paymentsTable.userId, Number(req.user.id));

    // Add filters if provided
    if (type) {
      whereConditions = and(whereConditions, eq(paymentsTable.type, type as any))!;
    }
    if (status) {
      whereConditions = and(whereConditions, eq(paymentsTable.status, status as any))!;
    }

    const payments = await db.query.paymentsTable.findMany({
      where: whereConditions,
      with: {
        booking: {
          with: {
            car: true,
          },
        },
        topup: true,
      },
      orderBy: [desc(paymentsTable.createdAt)],
      limit: Number(limit),
      offset,
    });

    // Get total count for pagination
    const totalCount = await db
      .select({ count: count() })
      .from(paymentsTable)
      .where(whereConditions);

    return sendSuccess(
      res,
      {
        payments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / Number(limit)),
        },
      },
      "User payments retrieved successfully"
    );
  }
);

// Get payment summary for user
export const getPaymentSummary = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.query;

    let whereConditions = eq(paymentsTable.userId, Number(req.user.id));

    if (bookingId) {
      whereConditions = and(whereConditions, eq(paymentsTable.bookingId, Number(bookingId)))!;
    }

    const summary = await db
      .select({
        totalPaid: sum(paymentsTable.amount),
        totalRefunded: sum(paymentsTable.refundAmount),
        totalPayments: count(paymentsTable.id),
        successfulPayments: count(paymentsTable.id),
      })
      .from(paymentsTable)
      .where(and(whereConditions, eq(paymentsTable.status, "completed")));

    const failedPayments = await db
      .select({
        count: count(paymentsTable.id),
      })
      .from(paymentsTable)
      .where(and(whereConditions, eq(paymentsTable.status, "failed")));

    const result = {
      totalPaid: Number(summary[0].totalPaid) || 0,
      totalRefunded: Number(summary[0].totalRefunded) || 0,
      netAmount: (Number(summary[0].totalPaid) || 0) - (Number(summary[0].totalRefunded) || 0),
      totalPayments: summary[0].totalPayments,
      successfulPayments: summary[0].successfulPayments,
      failedPayments: failedPayments[0].count,
    };

    return sendSuccess(res, result, "Payment summary retrieved successfully");
  }
);

// Process refund
export const processRefund = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { paymentId, refundAmount, refundReason } = req.body;

    if (!paymentId || !refundAmount || refundAmount <= 0) {
      throw ApiError.badRequest("Payment ID and refund amount are required");
    }

    const payment = await db.query.paymentsTable.findFirst({
      where: (paymentsTable, { eq }) => eq(paymentsTable.paymentId, paymentId),
    });

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    if (payment.userId !== Number(req.user.id)) {
      throw ApiError.forbidden("You can only process refunds for your own payments");
    }

    if (payment.status !== "completed") {
      throw ApiError.badRequest("Only completed payments can be refunded");
    }

    if (refundAmount > payment.amount) {
      throw ApiError.badRequest("Refund amount cannot exceed original payment amount");
    }

    const refundReferenceId = generatePaymentId();

    const updatedPayment = await db
      .update(paymentsTable)
      .set({
        refundAmount,
        refundReason,
        refundedAt: new Date(),
        refundReferenceId,
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.paymentId, paymentId))
      .returning();

    // Update payment summary
    await updatePaymentSummary(payment.userId, payment.bookingId || undefined);

    return sendUpdated(
      res,
      updatedPayment[0],
      "Refund processed successfully"
    );
  }
);

// Helper function to update payment summary
const updatePaymentSummary = async (userId: number, bookingId?: number) => {
  try {
    const whereConditions = bookingId 
      ? and(eq(paymentsTable.userId, userId), eq(paymentsTable.bookingId, bookingId))
      : eq(paymentsTable.userId, userId);

    const summary = await db
      .select({
        totalPaid: sum(paymentsTable.amount),
        totalRefunded: sum(paymentsTable.refundAmount),
        totalPayments: count(paymentsTable.id),
        successfulPayments: count(paymentsTable.id),
        lastPaymentAt: paymentsTable.completedAt,
        lastPaymentAmount: paymentsTable.amount,
        lastPaymentStatus: paymentsTable.status,
      })
      .from(paymentsTable)
      .where(and(whereConditions, eq(paymentsTable.status, "completed")))
      .orderBy(desc(paymentsTable.completedAt))
      .limit(1);

    const failedCount = await db
      .select({
        count: count(paymentsTable.id),
      })
      .from(paymentsTable)
      .where(and(whereConditions, eq(paymentsTable.status, "failed")));

    const summaryData = {
      userId,
      bookingId,
      totalPaid: Number(summary[0]?.totalPaid) || 0,
      totalRefunded: Number(summary[0]?.totalRefunded) || 0,
      netAmount: (Number(summary[0]?.totalPaid) || 0) - (Number(summary[0]?.totalRefunded) || 0),
      totalPayments: summary[0]?.totalPayments || 0,
      successfulPayments: summary[0]?.successfulPayments || 0,
      failedPayments: failedCount[0]?.count || 0,
      lastPaymentAt: summary[0]?.lastPaymentAt,
      lastPaymentAmount: Number(summary[0]?.lastPaymentAmount) || 0,
      lastPaymentStatus: summary[0]?.lastPaymentStatus,
      updatedAt: new Date(),
    };

    // Upsert payment summary
    await db
      .insert(paymentSummaryTable)
      .values(summaryData)
      .onConflictDoUpdate({
        target: [paymentSummaryTable.userId, paymentSummaryTable.bookingId],
        set: summaryData,
      });
  } catch (error) {
    console.error("Error updating payment summary:", error);
  }
};
