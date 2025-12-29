import { Request, Response } from "express";
import { db } from "../../drizzle/db";
import { paymentsTable } from "../payment/paymentmodel";
import { bookingsTable as bookings } from "../booking/bookingmodel";
import { carModel as car, carCatalogTable } from "../car/carmodel";
import { UserTable as users } from "../user/usermodel";
import { parkingTable as parkings } from "../parking/parkingmodel";
import { eq, and, or, like, gte, lte, desc, count, sum, sql } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiResponse";

// ========================================
// PAYMENT MANAGEMENT
// ========================================

// Get all payments with filtering and pagination
export const getAllPayments = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    method,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    customerId,
    bookingId,
    gateway,
    page = 1,
    limit = 20,
  } = req.query as {
    status?: string;
    method?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: string;
    maxAmount?: string;
    customerId?: string;
    bookingId?: string;
    gateway?: string;
    page?: string;
    limit?: string;
  };

  try {
    const offset = (Number(page) - 1) * Number(limit);
    const whereConditions = [];

    // Apply filters
    if (status) {
      whereConditions.push(eq(paymentsTable.status, status as any));
    }

    if (method) {
      whereConditions.push(eq(paymentsTable.method, method as any));
    }

    if (startDate) {
      whereConditions.push(gte(paymentsTable.createdAt, new Date(startDate)));
    }

    if (endDate) {
      whereConditions.push(lte(paymentsTable.createdAt, new Date(endDate)));
    }

    if (minAmount) {
      whereConditions.push(gte(paymentsTable.amount, Number(minAmount)));
    }

    if (maxAmount) {
      whereConditions.push(lte(paymentsTable.amount, Number(maxAmount)));
    }

    if (customerId) {
      whereConditions.push(eq(paymentsTable.userId, Number(customerId)));
    }

    if (bookingId) {
      whereConditions.push(eq(paymentsTable.bookingId, Number(bookingId)));
    }

    if (gateway) {
      whereConditions.push(like(paymentsTable.gatewayTransactionId, `%${gateway}%`));
    }

    // Get payments with related data
    const paymentsResult = await db
      .select({
        // Payment details
        id: paymentsTable.id,
        paymentId: paymentsTable.paymentId,
        referenceId: paymentsTable.referenceId,
        type: paymentsTable.type,
        status: paymentsTable.status,
        method: paymentsTable.method,
        amount: paymentsTable.amount,
        currency: paymentsTable.currency,
        fees: paymentsTable.fees,
        netAmount: paymentsTable.netAmount,
        bookingId: paymentsTable.bookingId,
        userId: paymentsTable.userId,
        gatewayTransactionId: paymentsTable.gatewayTransactionId,
        gatewayResponse: paymentsTable.gatewayResponse,
        refundAmount: paymentsTable.refundAmount,
        refundReason: paymentsTable.refundReason,
        refundedAt: paymentsTable.refundedAt,
        metadata: paymentsTable.metadata,
        createdAt: paymentsTable.createdAt,
        updatedAt: paymentsTable.updatedAt,
        
        // Customer details
        customerName: users.name,
        customerEmail: users.email,
        customerPhone: users.number,
        customerAvatar: users.avatar,
        
        // Car details (if booking exists)
        carName: car.name,
        carNumber: car.number,
        
        // Booking details
        bookingStartDate: bookings.startDate,
        bookingEndDate: bookings.endDate,
        bookingTotalPrice: bookings.totalPrice,
      })
      .from(paymentsTable)
      .leftJoin(users, eq(paymentsTable.userId, users.id))
      .leftJoin(bookings, eq(paymentsTable.bookingId, bookings.id))
      .leftJoin(car, eq(bookings.carId, car.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(paymentsTable)
      .leftJoin(users, eq(paymentsTable.userId, users.id))
      .leftJoin(bookings, eq(paymentsTable.bookingId, bookings.id))
      .leftJoin(car, eq(bookings.carId, car.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const total = totalResult[0]?.count || 0;

    // Transform the results
    const transformedPayments = paymentsResult.map((payment) => {
      // Calculate duration in days
      let duration = 0;
      if (payment.bookingStartDate && payment.bookingEndDate) {
        const start = new Date(payment.bookingStartDate);
        const end = new Date(payment.bookingEndDate);
        duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Parse metadata
      let parsedMetadata = {};
      try {
        parsedMetadata = payment.metadata ? JSON.parse(payment.metadata) : {};
      } catch (e) {
        parsedMetadata = {};
      }

      return {
        id: payment.id,
        transactionId: payment.paymentId,
        bookingId: payment.bookingId,
        amount: Number(payment.amount),
        refundAmount: Number(payment.refundAmount || 0),
        status: payment.status,
        method: payment.method,
        gateway: payment.method, // Using method as gateway for now
        gatewayTransactionId: payment.gatewayTransactionId,
        gatewayResponse: payment.gatewayResponse,
        refundDate: payment.refundedAt,
        refundReason: payment.refundReason,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        
        customerName: payment.customerName,
        customerEmail: payment.customerEmail,
        customerPhone: payment.customerPhone,
        customerAvatar: payment.customerAvatar,
        
        carName: payment.carName,
        pickupLocation: "Mumbai Airport", // Default for now
        duration: duration,
        
        currency: payment.currency,
        fees: Number(payment.fees || 0),
        netAmount: Number(payment.netAmount),
        description: "Car rental payment",
        metadata: parsedMetadata,
      };
    });

    return res.status(200).json(
      new ApiResponse(200, {
        data: transformedPayments,
        total,
        page: Number(page),
        limit: Number(limit),
      }, 'Payments retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching payments:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch payments')
    );
  }
});

// Get single payment by ID
export const getPaymentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const paymentResult = await db
      .select({
        // Payment details
        id: paymentsTable.id,
        paymentId: paymentsTable.paymentId,
        referenceId: paymentsTable.referenceId,
        type: paymentsTable.type,
        status: paymentsTable.status,
        method: paymentsTable.method,
        amount: paymentsTable.amount,
        currency: paymentsTable.currency,
        fees: paymentsTable.fees,
        netAmount: paymentsTable.netAmount,
        bookingId: paymentsTable.bookingId,
        userId: paymentsTable.userId,
        gatewayTransactionId: paymentsTable.gatewayTransactionId,
        gatewayResponse: paymentsTable.gatewayResponse,
        refundAmount: paymentsTable.refundAmount,
        refundReason: paymentsTable.refundReason,
        refundedAt: paymentsTable.refundedAt,
        metadata: paymentsTable.metadata,
        createdAt: paymentsTable.createdAt,
        updatedAt: paymentsTable.updatedAt,
        
        // Customer details
        customerName: users.name,
        customerEmail: users.email,
        customerPhone: users.number,
        customerAvatar: users.avatar,
        
        // Car details
        carName: car.name,
        carNumber: car.number,
        
        // Booking details
        bookingStartDate: bookings.startDate,
        bookingEndDate: bookings.endDate,
        bookingTotalPrice: bookings.totalPrice,
      })
      .from(paymentsTable)
      .leftJoin(users, eq(paymentsTable.userId, users.id))
      .leftJoin(bookings, eq(paymentsTable.bookingId, bookings.id))
      .leftJoin(car, eq(bookings.carId, car.id))
      .where(eq(paymentsTable.id, Number(id)))
      .limit(1);

    if (paymentResult.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Payment not found')
      );
    }

    const payment = paymentResult[0];

    // Calculate duration
    let duration = 0;
    if (payment.bookingStartDate && payment.bookingEndDate) {
      const start = new Date(payment.bookingStartDate);
      const end = new Date(payment.bookingEndDate);
      duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Parse metadata
    let parsedMetadata = {};
    try {
      parsedMetadata = payment.metadata ? JSON.parse(payment.metadata) : {};
    } catch (e) {
      parsedMetadata = {};
    }

    const transformedPayment = {
      id: payment.id,
      transactionId: payment.paymentId,
      bookingId: payment.bookingId,
      amount: Number(payment.amount),
      refundAmount: Number(payment.refundAmount || 0),
      status: payment.status,
      method: payment.method,
      gateway: payment.method,
      gatewayTransactionId: payment.gatewayTransactionId,
      gatewayResponse: payment.gatewayResponse,
      refundDate: payment.refundedAt,
      refundReason: payment.refundReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      
      customerName: payment.customerName,
      customerEmail: payment.customerEmail,
      customerPhone: payment.customerPhone,
      customerAvatar: payment.customerAvatar,
      
      carName: payment.carName,
      pickupLocation: "Mumbai Airport",
      duration: duration,
      
      currency: payment.currency,
      fees: Number(payment.fees || 0),
      netAmount: Number(payment.netAmount),
      description: "Car rental payment",
      metadata: parsedMetadata,
    };

    return res.status(200).json(
      new ApiResponse(200, transformedPayment, 'Payment retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching payment:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch payment')
    );
  }
});

// Get payment statistics
export const getPaymentStats = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get basic payment statistics
    const statsResult = await db
      .select({
        totalPayments: count(),
        totalRevenue: sum(paymentsTable.amount),
        completedPayments: sql<number>`COUNT(CASE WHEN ${paymentsTable.status} = 'completed' THEN 1 END)`,
        pendingPayments: sql<number>`COUNT(CASE WHEN ${paymentsTable.status} = 'pending' THEN 1 END)`,
        failedPayments: sql<number>`COUNT(CASE WHEN ${paymentsTable.status} = 'failed' THEN 1 END)`,
        refundedPayments: sql<number>`COUNT(CASE WHEN ${paymentsTable.status} = 'refunded' THEN 1 END)`,
        averagePayment: sql<number>`AVG(${paymentsTable.amount})`,
      })
      .from(paymentsTable);

    const stats = statsResult[0];

    // Get revenue by method
    const methodStats = await db
      .select({
        method: paymentsTable.method,
        revenue: sum(paymentsTable.amount),
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, 'completed'))
      .groupBy(paymentsTable.method);

    const revenueByMethod = methodStats.reduce((acc, item) => {
      if (item.method) {
        acc[item.method] = Number(item.revenue || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    // Get revenue by status
    const statusStats = await db
      .select({
        status: paymentsTable.status,
        revenue: sum(paymentsTable.amount),
      })
      .from(paymentsTable)
      .groupBy(paymentsTable.status);

    const revenueByStatus = statusStats.reduce((acc, item) => {
      if (item.status) {
        acc[item.status] = Number(item.revenue || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    // Get daily revenue for last 7 days
    const dailyRevenue = await db
      .select({
        date: sql<string>`DATE(${paymentsTable.createdAt})`,
        revenue: sum(paymentsTable.amount),
        count: count(),
      })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.status, 'completed'),
          gte(paymentsTable.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(sql`DATE(${paymentsTable.createdAt})`)
      .orderBy(sql`DATE(${paymentsTable.createdAt})`);

    // Get monthly revenue for last 12 months
    const monthlyRevenue = await db
      .select({
        month: sql<string>`TO_CHAR(${paymentsTable.createdAt}, 'YYYY-MM')`,
        revenue: sum(paymentsTable.amount),
        count: count(),
      })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.status, 'completed'),
          gte(paymentsTable.createdAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(sql`TO_CHAR(${paymentsTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${paymentsTable.createdAt}, 'YYYY-MM')`);

    const response = {
      totalPayments: stats.totalPayments || 0,
      totalRevenue: Number(stats.totalRevenue || 0),
      completedPayments: stats.completedPayments || 0,
      pendingPayments: stats.pendingPayments || 0,
      failedPayments: stats.failedPayments || 0,
      refundedPayments: stats.refundedPayments || 0,
      averagePayment: Number(stats.averagePayment || 0),
      revenueByMethod,
      revenueByStatus,
      dailyRevenue: dailyRevenue.map(item => ({
        date: item.date,
        revenue: Number(item.revenue || 0),
        count: item.count,
      })),
      monthlyRevenue: monthlyRevenue.map(item => ({
        month: item.month,
        revenue: Number(item.revenue || 0),
        count: item.count,
      })),
    };

    return res.status(200).json(
      new ApiResponse(200, response, 'Payment statistics retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch payment statistics')
    );
  }
});

// Refund payment
export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { refundAmount, reason } = req.body as {
    refundAmount: number;
    reason: string;
  };

  try {
    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Valid refund amount is required')
      );
    }

    if (!reason) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Refund reason is required')
      );
    }

    // Get the payment first
    const paymentResult = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, Number(id)))
      .limit(1);

    if (paymentResult.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Payment not found')
      );
    }

    const payment = paymentResult[0];

    // Check if payment can be refunded
    if (payment.status !== 'completed') {
      return res.status(400).json(
        new ApiResponse(400, null, 'Only completed payments can be refunded')
      );
    }

    if (refundAmount > payment.amount) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Refund amount cannot exceed payment amount')
      );
    }

    // Update payment with refund information
    const updatedPayment = await db
      .update(paymentsTable)
      .set({
        refundAmount: refundAmount,
        refundReason: reason,
        refundedAt: new Date(),
        status: refundAmount >= payment.amount ? 'refunded' : 'completed',
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, Number(id)))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, {
        refundAmount: Number(updatedPayment[0].refundAmount),
        refundDate: updatedPayment[0].refundedAt,
        refundReason: updatedPayment[0].refundReason,
        status: updatedPayment[0].status,
      }, 'Payment refunded successfully')
    );
  } catch (error) {
    console.error('Error refunding payment:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to refund payment')
    );
  }
});
