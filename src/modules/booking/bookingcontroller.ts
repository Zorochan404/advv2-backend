import { Request, Response } from "express";
import { db } from "../../drizzle/db";
import { bookingsTable } from "./bookingmodel";
import { asyncHandler } from "../utils/asyncHandler";
import { eq, between, and, gte, lte, sql, inArray, desc, isNotNull } from "drizzle-orm";
import { carModel } from "../car/carmodel";
import { parkingTable } from "../parking/parkingmodel";
import { couponTable, couponStatusEnum } from "../coupon/couponmodel";
import { paymentsTable } from "../payment/paymentmodel";
import { ApiError } from "../utils/apiError";
import {
  sendSuccess,
  sendCreated,
  sendUpdated,
  sendDeleted,
  sendItem,
  sendList,
  sendPaginated,
} from "../utils/responseHandler";
import {
  generateOTP,
  getOTPExpirationTime,
  getOTPExpirationForPickup,
  shouldRegenerateOTP,
  verifyOTP,
} from "../utils/otpUtils";
import { UserTable } from "../user/usermodel";
import { topupTable, bookingTopupTable } from "./topupmodel";

// Extend the Request interface to include 'user' property
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    // add other user properties if needed
  };
}

// Helper function to clean up tools data
const cleanToolsData = (tools: any): any[] => {
  if (!tools || !Array.isArray(tools)) {
    return [];
  }

  // If tools is already in the correct format (array of objects), return as is
  if (tools.length > 0 && typeof tools[0] === "object" && tools[0] !== null) {
    return tools;
  }

  // If tools is in the old format (array of strings like "[object Object]"), return empty array
  if (
    tools.length > 0 &&
    typeof tools[0] === "string" &&
    tools[0].includes("[object Object]")
  ) {
    return [];
  }

  return tools;
};

export const createBooking = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      carId,
      startDate,
      endDate,
      deliveryCharges = 0,
      couponCode,
    } = req.body;

    // Validate required fields
    if (!carId || !startDate || !endDate) {
      throw ApiError.badRequest(
        "Car ID, start date, and end date are required"
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

    // Get car details
    const carprice = await db
      .select()
      .from(carModel)
      .where(eq(carModel.id, carId));

    if (!carprice || carprice.length === 0) {
      throw ApiError.notFound("Car not found");
    }

    // Check if user is verified
    if ((req.user as any).isverified === false) {
      throw ApiError.forbidden(
        "Please login and verify your account to continue"
      );
    }

    // Check for overlapping bookings for the same car
    const overlappingBookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { eq, and, lte, gte }) =>
        and(
          eq(bookingsTable.carId, carId),
          lte(bookingsTable.startDate, endDateObj),
          gte(bookingsTable.endDate, startDateObj),
          // Only check active bookings (not cancelled)
          sql`${bookingsTable.status} NOT IN ('cancelled')`
        ),
    });

    if (overlappingBookings.length > 0) {
      throw ApiError.conflict("Car is already booked for the selected dates");
    }

    // Calculate base pricing
    const days = Math.ceil(
      (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );
    const basePrice =
      (carprice[0]?.discountprice || carprice[0]?.price || 0) * days;

    // Get insurance amount from car details
    const insuranceAmount = carprice[0]?.insuranceAmount || 0;

    // Initialize discount variables
    let discountAmount = 0;
    let appliedCouponId = null;

    // Apply coupon if provided
    if (couponCode) {
      // Find the coupon
      const coupons = await db
        .select()
        .from(couponTable)
        .where(
          and(
            eq(couponTable.code, couponCode),
            eq(couponTable.status, "active"),
            eq(couponTable.isActive, true),
            lte(couponTable.startDate, new Date()),
            gte(couponTable.endDate, new Date())
          )
        );

      if (!coupons || coupons.length === 0) {
        throw ApiError.badRequest("Invalid or expired coupon code");
      }

      const coupon = coupons[0];

      // Check if coupon has usage limit and if it's reached
      if (
        coupon.usageLimit !== null &&
        coupon.usageCount >= coupon.usageLimit
      ) {
        throw ApiError.badRequest("Coupon usage limit reached");
      }

      // Check if user has already used this coupon up to the per-user limit
      if (coupon.perUserLimit) {
        const userCouponUsage = await db
          .select({ count: sql`count(*)` })
          .from(bookingsTable)
          .where(
            and(
              eq(bookingsTable.userId, req.user.id),
              eq(bookingsTable.couponId, coupon.id)
            )
          );

        const usageCount = parseInt(
          userCouponUsage[0]?.count?.toString() || "0"
        );
        if (usageCount >= coupon.perUserLimit) {
          throw ApiError.badRequest(
            `You have already used this coupon ${coupon.perUserLimit} time(s)`
          );
        }
      }

      // Check minimum booking amount
      if (
        coupon.minBookingAmount &&
        basePrice < parseFloat(coupon.minBookingAmount.toString())
      ) {
        throw ApiError.badRequest(
          `Minimum booking amount for this coupon is ${coupon.minBookingAmount}`
        );
      }

      // Calculate discount
      if (coupon.discountType === "percentage") {
        discountAmount =
          (basePrice * parseFloat(coupon.discountAmount.toString())) / 100;

        // Apply max discount cap if applicable
        if (
          coupon.maxDiscountAmount &&
          discountAmount > parseFloat(coupon.maxDiscountAmount.toString())
        ) {
          discountAmount = parseFloat(coupon.maxDiscountAmount.toString());
        }
      } else {
        // Fixed discount
        discountAmount = parseFloat(coupon.discountAmount.toString());

        // Ensure discount doesn't exceed the base price
        if (discountAmount > basePrice) {
          discountAmount = basePrice;
        }
      }

      appliedCouponId = coupon.id;
    }

    // Calculate final pricing
    const totalBeforeDiscount =
      basePrice + Number(insuranceAmount) + Number(deliveryCharges);
    const totalPrice = totalBeforeDiscount - discountAmount;
    const advancePercentage = 0.3; // 30% advance payment (configurable by admin)
    const advanceAmount = totalPrice * advancePercentage;
    const remainingAmount = totalPrice - advanceAmount;

    // Get car details to get parking ID
    const carDetails = await db
      .select({
        parkingId: carModel.parkingid,
      })
      .from(carModel)
      .where(eq(carModel.id, carId));

    if (!carDetails || carDetails.length === 0) {
      throw ApiError.notFound("Car not found");
    }

    const parkingId = carDetails[0].parkingId;

    // Insert booking
    const newBooking = await db
      .insert(bookingsTable)
      .values({
        carId,
        userId: Number(req.user.id),
        pickupParkingId: parkingId,
        dropoffParkingId: parkingId,
        startDate: startDateObj,
        endDate: endDateObj,
        basePrice,
        advanceAmount,
        remainingAmount,
        totalPrice,
        status: "pending",
        confirmationStatus: "pending",
        deliveryCharges,
        // Add coupon and insurance fields
        couponId: appliedCouponId,
        discountAmount,
        insuranceAmount: Number(insuranceAmount),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return sendCreated(res, newBooking[0], "Booking created successfully");
  }
);

export const getBookingByDateRange = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.body;

    // Validate input
    if (!startDate || !endDate) {
      throw ApiError.badRequest("Start date and end date are required");
    }

    // Convert string dates to Date objects
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw ApiError.badRequest("Invalid date format");
    }

    const bookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { and, lte, gte }) =>
        and(
          lte(bookingsTable.startDate, endDateObj),
          gte(bookingsTable.endDate, startDateObj)
        ),
      with: {
        car: true,
        pickupParking: true,
        dropoffParking: true,
        user: {
          columns: {
            id: true,
            name: true,
            avatar: true,
            age: true,
            number: true,
            email: true,
            aadharNumber: true,
            aadharimg: true,
            dlNumber: true,
            dlimg: true,
            passportNumber: true,
            passportimg: true,
            lat: true,
            lng: true,
            locality: true,
            city: true,
            state: true,
            country: true,
            pincode: true,
            role: true,
            isverified: true,
            parkingid: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return sendList(
      res,
      bookings,
      bookings.length,
      "Bookings fetched successfully"
    );
  }
);

export const getBookingByDateRangeByCarId = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate, carId } = req.body;

    // Validate input
    if (!startDate || !endDate || !carId) {
      throw ApiError.badRequest(
        "Start date, end date, and car ID are required"
      );
    }

    // Convert string dates to Date objects
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw ApiError.badRequest("Invalid date format");
    }

    const bookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { and, lte, gte, eq }) =>
        and(
          eq(bookingsTable.carId, carId),
          lte(bookingsTable.startDate, endDateObj),
          gte(bookingsTable.endDate, startDateObj)
        ),
      with: {
        car: true,
        pickupParking: true,
        dropoffParking: true,
        user: {
          columns: {
            id: true,
            name: true,
            avatar: true,
            age: true,
            number: true,
            email: true,
            aadharNumber: true,
            aadharimg: true,
            dlNumber: true,
            dlimg: true,
            passportNumber: true,
            passportimg: true,
            lat: true,
            lng: true,
            locality: true,
            city: true,
            state: true,
            country: true,
            pincode: true,
            role: true,
            isverified: true,
            parkingid: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return sendList(
      res,
      bookings,
      bookings.length,
      "Bookings fetched successfully"
    );
  }
);

export const updatebooking = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    // Validate ID
    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    // Validate date formats if provided
    if (updateData.startDate) {
      const startDate = new Date(updateData.startDate);
      if (isNaN(startDate.getTime())) {
        throw ApiError.badRequest("Invalid startDate format");
      }
      updateData.startDate = startDate;
    }

    if (updateData.endDate) {
      const endDate = new Date(updateData.endDate);
      if (isNaN(endDate.getTime())) {
        throw ApiError.badRequest("Invalid endDate format");
      }
      updateData.endDate = endDate;
    }

    if (updateData.extensionTill) {
      const extensionTill = new Date(updateData.extensionTill);
      if (isNaN(extensionTill.getTime())) {
        throw ApiError.badRequest("Invalid extensionTill format");
      }
      updateData.extensionTill = extensionTill;
    }

    const booking = await db
      .update(bookingsTable)
      .set(updateData)
      .where(eq(bookingsTable.id, parseInt(id)))
      .returning();

    if (!booking || booking.length === 0) {
      throw ApiError.notFound("Booking not found");
    }

    return sendUpdated(res, booking[0], "Booking updated successfully");
  }
);

export const deletebooking = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Validate ID
    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

     // Get booking details before deletion to update car status
    const bookingToDelete = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, parseInt(id)),
    });

    if (!bookingToDelete) {
      throw ApiError.notFound("Booking not found");
    }

    // Delete the booking
    const booking = await db
      .delete(bookingsTable)
      .where(eq(bookingsTable.id, parseInt(id)))
      .returning();

    if (!booking || booking.length === 0) {
      throw ApiError.notFound("Booking not found");
    }

    // Make car available again if it was booked
    if (bookingToDelete.carId) {
      await db
        .update(carModel)
        .set({ 
          status: "available",
        })
        .where(eq(carModel.id, bookingToDelete.carId));
    }

    return sendDeleted(res, "Booking deleted successfully. Car is now available for new bookings.");
  }
);

export const getbookingbyid = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Validate ID
    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    const booking = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, parseInt(id)),
      with: {
        car: true,
        pickupParking: true,
        dropoffParking: true,
        user: true,
      },
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    // Get coupon details if couponId exists
    let couponDetails = null;
    if (booking.couponId) {
      const couponResult = await db
        .select()
        .from(couponTable)
        .where(eq(couponTable.id, booking.couponId));

      if (couponResult && couponResult.length > 0) {
        couponDetails = couponResult[0];
      }
    }

    // Clean up tools data
    const cleanedBooking = {
      ...booking,
      tools: cleanToolsData(booking.tools),
      couponDetails,
      // Add billing breakdown
      billingBreakdown: {
        basePrice: booking.basePrice,
        insuranceAmount: booking.insuranceAmount || 0,
        deliveryCharges: booking.deliveryCharges || 0,
        discountAmount: booking.discountAmount || 0,
        totalBeforeDiscount:
          Number(booking.basePrice) +
          Number(booking.insuranceAmount || 0) +
          Number(booking.deliveryCharges || 0),
        totalPrice: booking.totalPrice,
        advanceAmount: booking.advanceAmount,
        remainingAmount: booking.remainingAmount,
      },
    };

    return sendItem(res, cleanedBooking, "Booking fetched successfully");
  }
);

export const getbookingbyuserid = asyncHandler(
  async (req: Request, res: Response) => {
    const { userid } = req.params;

    // Validate user ID
    if (!userid || !/^[0-9]+$/.test(userid)) {
      throw ApiError.badRequest("Invalid user ID");
    }

    const bookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.userId, parseInt(userid)),
      with: {
        car: true,
        pickupParking: true,
        dropoffParking: true,
        user: true,
      },
    });

    // Clean up tools data for all bookings
    const cleanedBookings = bookings.map((booking) => ({
      ...booking,
      tools: cleanToolsData(booking.tools),
    }));

    return sendList(
      res,
      cleanedBookings,
      cleanedBookings.length,
      "Bookings fetched successfully"
    );
  }
);

export const getbookingbycarid = asyncHandler(
  async (req: Request, res: Response) => {
    const { carid } = req.params;

    // Validate car ID
    if (!carid || !/^[0-9]+$/.test(carid)) {
      throw ApiError.badRequest("Invalid car ID");
    }

    const bookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.carId, parseInt(carid)),
      with: {
        car: true,
        pickupParking: true,
        dropoffParking: true,
        user: true,
      },
    });

    // Clean up tools data for all bookings
    const cleanedBookings = bookings.map((booking) => ({
      ...booking,
      tools: cleanToolsData(booking.tools),
    }));

    return sendList(
      res,
      cleanedBookings,
      cleanedBookings.length,
      "Bookings fetched successfully"
    );
  }
);

export const getbookingbypickupParkingId = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Validate parking ID
    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    const bookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.pickupParkingId, parseInt(id)),
      with: {
        car: true,
        pickupParking: true,
        dropoffParking: true,
        user: true,
      },
    });

    return sendList(
      res,
      bookings,
      bookings.length,
      "Bookings fetched successfully"
    );
  }
);

export const getbookingbydropoffParkingId = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Validate parking ID
    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    const bookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.dropoffParkingId, parseInt(id)),
      with: {
        car: true,
        pickupParking: true,
        dropoffParking: true,
        user: true,
      },
    });

    return sendList(
      res,
      bookings,
      bookings.length,
      "Bookings fetched successfully"
    );
  }
);

// New booking flow functions
export const confirmAdvancePayment = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId, paymentReferenceId } = req.body;

    if (!bookingId || !paymentReferenceId) {
      throw ApiError.badRequest(
        "Booking ID and payment reference ID are required"
      );
    }

    const booking = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    if (booking.userId !== req.user.id) {
      throw ApiError.forbidden(
        "You can only confirm payments for your own bookings"
      );
    }

    if (booking.advancePaymentId !== null) {
      throw ApiError.conflict("Advance payment already confirmed");
    }

    // Generate OTP for user identification at pickup location
    const otpCode = generateOTP();
    const otpExpiresAt = getOTPExpirationForPickup(
      booking.pickupDate || booking.startDate
    );

    // Create payment record
    const advancePayment = await db
      .insert(paymentsTable)
      .values({
        paymentId: `adv_${Date.now()}_${bookingId}`,
        referenceId: paymentReferenceId,
        type: "advance",
        status: "completed",
        method: "razorpay",
        amount: booking.advanceAmount,
        netAmount: booking.advanceAmount,
        userId: booking.userId,
        bookingId: bookingId,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Update booking status
    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        advancePaymentId: advancePayment[0].id,
        status: "advance_paid",
        otpCode: otpCode,
        otpExpiresAt: otpExpiresAt,
        otpVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    return sendUpdated(
      res,
      {
        ...updatedBooking[0],
        advancePaymentStatus: "paid",
        otpCode: otpCode,
        otpExpiresAt: otpExpiresAt,
      },
      "Advance payment confirmed successfully"
    );
  }
);

export const getPICDashboard = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const picId = req.user.id;
    const picParkingId = (req.user as any).parkingid;

    if (!picParkingId) {
      throw ApiError.badRequest("PIC must be assigned to a parking lot");
    }

    // Get PIC's assigned parking lot details
    const parkingLot = await db
      .select()
      .from(parkingTable)
      .where(eq(parkingTable.id, picParkingId))
      .limit(1);

    // Get all cars in PIC's parking lot
    const cars = await db.query.carModel.findMany({
      where: (carModel, { eq }) => eq(carModel.parkingid, picParkingId),
      with: {
        vendor: true,
        parking: true,
        catalog: true,
      },
    });

    // Get all bookings for cars in PIC's parking lot
    const rawBookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { inArray }) =>
        cars.length > 0
          ? inArray(
              bookingsTable.carId,
              cars.map((car) => car.id)
            )
          : undefined,
      with: {
        car: true,
        user: true,
        pickupParking: true,
        dropoffParking: true,
      },
    });

    // Clean up tools data for all bookings
    const bookings = rawBookings.map((booking) => ({
      ...booking,
      tools: cleanToolsData(booking.tools),
    }));

    // Get pending OTP verifications (bookings that need PIC verification)
    const pendingOTPVerifications = bookings.filter(
      (booking) =>
        booking.status === "advance_paid" &&
        !booking.otpVerified &&
        booking.otpCode
    );

    // Get active bookings (confirmed and ongoing)
    const activeBookings = bookings.filter(
      (booking) =>
        booking.status && ["confirmed", "active"].includes(booking.status)
    );

    // Get completed bookings
    const completedBookings = bookings.filter(
      (booking) => booking.status === "completed"
    );

    // Get cancelled bookings
    const cancelledBookings = bookings.filter(
      (booking) => booking.status === "cancelled"
    );

    // Get statistics
    const stats = {
      totalCars: cars.length,
      availableCars: cars.filter((car) => car.status === "available").length,
      bookedCars: cars.filter((car) => car.status === "booked").length,
      maintenanceCars: cars.filter((car) => car.status === "maintenance")
        .length,
      totalBookings: bookings.length,
      pendingVerifications: pendingOTPVerifications.length,
      activeBookings: activeBookings.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
    };

    return sendSuccess(
      res,
      {
        parkingLot: parkingLot[0] || null,
        cars,
        bookings,
        pendingOTPVerifications,
        activeBookings,
        completedBookings,
        cancelledBookings,
        stats,
      },
      "PIC dashboard data retrieved successfully"
    );
  }
);

export const verifyBookingOTP = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId, otp } = req.body;
    const picId = req.user.id;

    // Validate required fields
    if (!bookingId || !otp) {
      throw ApiError.badRequest("Booking ID and OTP are required");
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
      with: {
        car: true,
        user: true,
        pickupParking: true,
        dropoffParking: true,
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const bookingData = result;

    // Check if user is PIC (Parking In Charge)
    if ((req.user as any).role !== "parkingincharge") {
      throw ApiError.forbidden("Only Parking In Charge can verify OTP");
    }

    // Get car details to find the parking lot
    const car = await db.query.carModel.findFirst({
      where: (carModel, { eq }) => eq(carModel.id, bookingData.carId),
      with: {
        vendor: true,
        parking: true,
        catalog: true,
      },
    });

    if (!car) {
      throw ApiError.notFound("Car not found");
    }

    const carData = car;

    // Check if PIC belongs to the parking lot where the car is located
    if (carData.parkingid !== (req.user as any).parkingid) {
      throw ApiError.forbidden(
        "You can only verify OTP for cars in your assigned parking lot"
      );
    }

    // Verify OTP
    verifyOTP(
      otp,
      bookingData.otpCode,
      bookingData.otpExpiresAt,
      bookingData.otpVerified || false
    );

    // Update booking with OTP verification
    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        otpVerified: true,
        otpVerifiedAt: new Date(),
        otpVerifiedBy: picId,
        status: "confirmed", // Change status to confirmed after OTP verification
        // Don't automatically set confirmationStatus to "approved" - this should be a separate step
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    return sendUpdated(
      res,
      updatedBooking[0],
      "OTP verified successfully. User can now collect the car."
    );
  }
);

export const resendBookingOTP = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.body;

    // Validate required fields
    if (!bookingId) {
      throw ApiError.badRequest("Booking ID is required");
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
      with: {
        car: true,
        user: true,
        pickupParking: true,
        dropoffParking: true,
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const bookingData = result;

    // Check if user owns this booking
    if (bookingData.userId !== Number(req.user.id)) {
      throw ApiError.forbidden("You can only resend OTP for your own bookings");
    }

    // Check if booking is in correct status
    if (bookingData.status !== "advance_paid") {
      throw ApiError.badRequest(
        "OTP can only be resent for bookings with advance payment completed"
      );
    }

    // Generate new OTP
    const newOTP = generateOTP();
    const newExpirationTime = getOTPExpirationTime();

    // Update booking with new OTP
    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        otpCode: newOTP,
        otpExpiresAt: newExpirationTime,
        otpVerified: false,
        otpVerifiedAt: null,
        otpVerifiedBy: null,
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    return sendUpdated(
      res,
      updatedBooking[0],
      "New OTP generated successfully"
    );
  }
);

export const getBookingOTP = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.params;

    // Validate booking ID
    if (!bookingId || !/^[0-9]+$/.test(bookingId)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.id, parseInt(bookingId)),
      with: {
        car: true,
        user: true,
        pickupParking: true,
        dropoffParking: true,
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const bookingData = result;

    // Check if user owns this booking
    if (bookingData.userId !== Number(req.user.id)) {
      throw ApiError.forbidden("You can only view OTP for your own bookings");
    }

    // Check if booking is in correct status
    if (bookingData.status !== "advance_paid") {
      throw ApiError.badRequest(
        "OTP is only available for bookings with advance payment completed"
      );
    }

    // Check if OTP is already verified
    if (bookingData.otpVerified) {
      throw ApiError.badRequest("OTP has already been verified");
    }

    // Check if OTP is expired
    if (bookingData.otpExpiresAt && bookingData.otpExpiresAt < new Date()) {
      throw ApiError.badRequest("OTP has expired. Please request a new one");
    }

    return sendItem(
      res,
      {
        bookingId: bookingData.id,
        otp: bookingData.otpCode,
        expiresAt: bookingData.otpExpiresAt,
        isVerified: bookingData.otpVerified,
      },
      "OTP retrieved successfully"
    );
  }
);

export const rescheduleBooking = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.params;
    const { newPickupDate, newStartDate, newEndDate } = req.body;

    // Validate required fields
    if (!newPickupDate) {
      throw ApiError.badRequest("New pickup date is required");
    }

    // Validate pickup date
    const newPickupDateObj = new Date(newPickupDate);
    if (isNaN(newPickupDateObj.getTime())) {
      throw ApiError.badRequest("Invalid pickup date format");
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.id, parseInt(bookingId)),
      with: {
        car: true,
        user: true,
        pickupParking: true,
        dropoffParking: true,
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const bookingData = result;

    // Check if user owns this booking
    if (bookingData.userId !== req.user.id) {
      throw ApiError.forbidden("You can only reschedule your own bookings");
    }

    // Check if booking can be rescheduled
    if (
      bookingData.status === "completed" ||
      bookingData.status === "cancelled"
    ) {
      throw ApiError.badRequest(
        "Cannot reschedule completed or cancelled bookings"
      );
    }

    // Check reschedule limit
    if (
      (bookingData.rescheduleCount || 0) >=
      (bookingData.maxRescheduleCount || 3)
    ) {
      throw ApiError.badRequest(
        `Maximum reschedule limit (${
          bookingData.maxRescheduleCount || 3
        }) reached`
      );
    }

    // Check if new pickup date is in the future
    if (newPickupDateObj <= new Date()) {
      throw ApiError.badRequest("Pickup date must be in the future");
    }

    // Check for car availability on new dates
    const newStartDateObj = newStartDate
      ? new Date(newStartDate)
      : bookingData.startDate;
    const newEndDateObj = newEndDate
      ? new Date(newEndDate)
      : bookingData.endDate;

    if (newStartDateObj >= newEndDateObj) {
      throw ApiError.badRequest("End date must be after start date");
    }

    // Check for overlapping bookings
    const overlappingBookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { eq, and, lte, gte, ne }) =>
        and(
          eq(bookingsTable.carId, bookingData.carId),
          ne(bookingsTable.id, parseInt(bookingId)), // Exclude current booking
          lte(bookingsTable.startDate, newEndDateObj),
          gte(bookingsTable.endDate, newStartDateObj),
          sql`${bookingsTable.status} NOT IN ('cancelled')`
        ),
    });

    if (overlappingBookings.length > 0) {
      throw ApiError.conflict("Car is already booked for the selected dates");
    }

    // Store original pickup date if this is the first reschedule
    const originalPickupDate =
      bookingData.originalPickupDate || bookingData.pickupDate;

    // Check if OTP needs to be regenerated
    const shouldRegenerate = shouldRegenerateOTP(
      bookingData.otpExpiresAt,
      newPickupDateObj
    );

    // Prepare update data
    const updateData: any = {
      pickupDate: newPickupDateObj,
      originalPickupDate: originalPickupDate,
      rescheduleCount: (bookingData.rescheduleCount || 0) + 1,
      updatedAt: new Date(),
    };

    // Update dates if provided
    if (newStartDate) {
      updateData.startDate = newStartDateObj;
    }
    if (newEndDate) {
      updateData.endDate = newEndDateObj;
    }

    // Regenerate OTP if needed
    if (shouldRegenerate) {
      updateData.otpCode = generateOTP();
      updateData.otpExpiresAt = getOTPExpirationForPickup(newPickupDateObj);
      updateData.otpVerified = false;
      updateData.otpVerifiedAt = null;
      updateData.otpVerifiedBy = null;
    }

    // Update booking
    const updatedBooking = await db
      .update(bookingsTable)
      .set(updateData)
      .where(eq(bookingsTable.id, parseInt(bookingId)))
      .returning();

    const message = shouldRegenerate
      ? "Booking rescheduled successfully. New OTP has been generated."
      : "Booking rescheduled successfully.";

    return sendUpdated(res, updatedBooking[0], message);
  }
);

export const getPICByEntity = asyncHandler(
  async (req: Request, res: Response) => {
    const { carId, bookingId, parkingId } = req.query;

    // Validate that at least one parameter is provided
    if (!carId && !bookingId && !parkingId) {
      throw ApiError.badRequest(
        "Please provide either carId, bookingId, or parkingId"
      );
    }

    let targetParkingId: number | null = null;

    // Determine parking ID based on input
    if (parkingId) {
      // Direct parking ID provided
      targetParkingId = Number(parkingId);
    } else if (carId) {
      // Get parking ID from car
      const car = await db.query.carModel.findFirst({
        where: (carModel, { eq }) => eq(carModel.id, Number(carId)),
        with: {
          vendor: true,
          parking: true,
          catalog: true,
        },
      });

      if (!car) {
        throw ApiError.notFound("Car not found");
      }
      targetParkingId = car.parkingid;
    } else if (bookingId) {
      // Get parking ID from booking's car
      const booking = await db.query.bookingsTable.findFirst({
        where: (bookingsTable, { eq }) =>
          eq(bookingsTable.id, Number(bookingId)),
        with: {
          car: true,
          pickupParking: true,
          dropoffParking: true,
        },
      });

      if (!booking) {
        throw ApiError.notFound("Booking not found");
      }

      const car = await db.query.carModel.findFirst({
        where: (carModel, { eq }) => eq(carModel.id, booking.carId),
        with: {
          vendor: true,
          parking: true,
          catalog: true,
        },
      });

      if (!car) {
        throw ApiError.notFound("Car not found for this booking");
      }
      targetParkingId = car.parkingid;
    }

    if (!targetParkingId) {
      throw ApiError.notFound("Could not determine parking lot");
    }

    // Get PIC assigned to this parking lot
    const pic = await db
      .select({
        id: UserTable.id,
        name: UserTable.name,
        email: UserTable.email,
        number: UserTable.number,
        role: UserTable.role,
        parkingid: UserTable.parkingid,
        isverified: UserTable.isverified,
        createdAt: UserTable.createdAt,
      })
      .from(UserTable)
      .where(
        and(
          eq(UserTable.role, "parkingincharge"),
          eq(UserTable.parkingid, targetParkingId)
        )
      )
      .limit(1);

    if (!pic || pic.length === 0) {
      throw ApiError.notFound(
        "No Parking In Charge assigned to this parking lot"
      );
    }

    // Get parking lot details
    const parkingLot = await db
      .select()
      .from(parkingTable)
      .where(eq(parkingTable.id, targetParkingId))
      .limit(1);

    return sendItem(
      res,
      {
        pic: pic[0],
        parkingLot: parkingLot[0] || null,
        source: {
          carId: carId || null,
          bookingId: bookingId || null,
          parkingId: parkingId || null,
        },
      },
      "PIC information retrieved successfully"
    );
  }
);

export const getPICConfirmationRequests = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const picId = req.user.id;
    const picParkingId = (req.user as any).parkingid;

    if (!picParkingId) {
      throw ApiError.badRequest("PIC must be assigned to a parking lot");
    }

    // Get all cars in PIC's parking lot
    const cars = await db.query.carModel.findMany({
      where: (carModel, { eq }) => eq(carModel.parkingid, picParkingId),
      with: {
        vendor: true,
        parking: true,
        catalog: true,
      },
    });

    if (cars.length === 0) {
      return sendSuccess(
        res,
        {
          confirmationRequests: [],
          stats: {
            totalRequests: 0,
            pendingApproval: 0,
            approved: 0,
            rejected: 0,
          },
        },
        "Confirmation requests retrieved successfully"
      );
    }

    // Get all bookings for cars in PIC's parking lot that have confirmation requests
    const rawBookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { and, inArray, eq }) =>
        and(
          inArray(
            bookingsTable.carId,
            cars.map((car) => car.id)
          ),
          eq(bookingsTable.confirmationStatus, "pending_approval")
        ),
      with: {
        car: {
          with: {
            vendor: true,
            parking: true,
            catalog: true,
          },
        },
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            number: true,
            role: true,
            isverified: true,
          },
        },
        pickupParking: true,
        dropoffParking: true,
      },
      orderBy: (bookingsTable, { desc }) => [
        desc(bookingsTable.userConfirmedAt),
      ],
    });

    // Clean up tools data for all bookings
    const bookings = rawBookings.map((booking) => ({
      ...booking,
      tools: cleanToolsData(booking.tools),
    }));

    // Get statistics
    const stats = {
      totalRequests: bookings.length,
      pendingApproval: bookings.filter(
        (booking) => booking.confirmationStatus === "pending_approval"
      ).length,
      approved: bookings.filter(
        (booking) => booking.confirmationStatus === "approved"
      ).length,
      rejected: bookings.filter(
        (booking) => booking.confirmationStatus === "rejected"
      ).length,
    };

    return sendSuccess(
      res,
      {
        confirmationRequests: bookings,
        stats,
      },
      "Confirmation requests retrieved successfully"
    );
  }
);

export const submitConfirmationRequest = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId, carConditionImages, toolImages, tools } = req.body;

    // Get booking details
    const booking = await db.query.bookingsTable.findFirst({
      where: eq(bookingsTable.id, bookingId),
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    // Check if user owns this booking
    if (booking.userId !== Number(req.user.id)) {
      throw ApiError.forbidden(
        "You can only submit confirmation requests for your own bookings"
      );
    }

    // Check if advance payment is completed
    if (booking.advancePaymentId === null) {
      throw ApiError.badRequest(
        "Advance payment must be completed before submitting confirmation request"
      );
    }

    // Update booking with confirmation data
    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        carConditionImages: carConditionImages || [],
        toolImages: toolImages || [],
        tools: tools || [],
        userConfirmed: true,
        userConfirmedAt: new Date(),
        confirmationStatus: "pending_approval",
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    return sendSuccess(
      res,
      updatedBooking[0],
      "Confirmation request submitted successfully"
    );
  }
);

export const picApproveConfirmation = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId, approved, comments } = req.body;

    // Get booking details
    const booking = await db.query.bookingsTable.findFirst({
      where: eq(bookingsTable.id, bookingId),
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    // Check if PIC belongs to the parking lot where the car is located
    if (booking.pickupParkingId !== (req.user as any).parkingid) {
      throw ApiError.forbidden(
        "You can only approve confirmations for cars in your assigned parking lot"
      );
    }

    // Update booking with PIC approval
    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        picApproved: approved,
        picApprovedAt: new Date(),
        picApprovedBy: Number(req.user.id),
        picComments: comments || null,
        confirmationStatus: approved ? "approved" : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    return sendSuccess(
      res,
      updatedBooking[0],
      `Confirmation ${approved ? "approved" : "rejected"} successfully`
    );
  }
);

export const confirmFinalPayment = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId, paymentReferenceId } = req.body;

    // Get booking details
    const booking = await db.query.bookingsTable.findFirst({
      where: eq(bookingsTable.id, bookingId),
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    // Check if user owns this booking
    if (booking.userId !== Number(req.user.id)) {
      throw ApiError.forbidden(
        "You can only confirm payments for your own bookings"
      );
    }

    if (booking.finalPaymentId !== null) {
      throw ApiError.conflict("Final payment already confirmed");
    }

    // Create payment record
    const finalPayment = await db
      .insert(paymentsTable)
      .values({
        paymentId: `fin_${Date.now()}_${bookingId}`,
        referenceId: paymentReferenceId,
        type: "final",
        status: "completed",
        method: "razorpay",
        amount: booking.remainingAmount,
        netAmount: booking.remainingAmount,
        userId: booking.userId,
        bookingId: bookingId,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        finalPaymentId: finalPayment[0].id,
        status: "confirmed",
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    return sendUpdated(
      res,
      {
        ...updatedBooking[0],
        finalPaymentStatus: "paid",
      },
      "Final payment confirmed successfully"
    );
  }
);

export const resubmitConfirmationRequest = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      bookingId,
      carConditionImages,
      tools,
      toolImages,
      resubmissionReason,
    } = req.body;

    if (!bookingId) {
      throw ApiError.badRequest("Booking ID is required");
    }

    if (!carConditionImages || !Array.isArray(carConditionImages)) {
      throw ApiError.badRequest("Car condition images are required");
    }

    const booking = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    if (booking.userId !== req.user.id) {
      throw ApiError.forbidden(
        "You can only resubmit confirmation requests for your own bookings"
      );
    }

    // Check if booking was previously rejected
    if (booking.confirmationStatus !== "rejected") {
      throw ApiError.badRequest(
        "Only rejected confirmation requests can be resubmitted"
      );
    }

    // Check if advance payment is completed
    if (booking.advancePaymentId === null) {
      throw ApiError.badRequest(
        "Advance payment must be completed before resubmitting confirmation request"
      );
    }

    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        carConditionImages: carConditionImages,
        tools: tools || [],
        toolImages: toolImages || [],
        userConfirmed: true,
        userConfirmedAt: new Date(),
        confirmationStatus: "pending_approval",
        picApproved: false, // Reset PIC approval
        picApprovedAt: null, // Reset PIC approval timestamp
        picApprovedBy: null, // Reset PIC approver
        picComments: resubmissionReason || null, // Store resubmission reason
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    return sendUpdated(
      res,
      updatedBooking[0],
      "Confirmation request resubmitted successfully"
    );
  }
);

export const getUserRejectedConfirmations = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;

    const result = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { and, eq }) =>
        and(
          eq(bookingsTable.userId, userId),
          eq(bookingsTable.confirmationStatus, "rejected")
        ),
      with: {
        car: {
          with: {
            vendor: true,
            parking: true,
            catalog: true,
          },
        },
        pickupParking: true,
        dropoffParking: true,
      },
      orderBy: (bookingsTable, { desc }) => [desc(bookingsTable.picApprovedAt)],
    });

    // Clean up tools data for all bookings
    const cleanedBookings = result.map((booking) => ({
      ...booking,
      tools: cleanToolsData(booking.tools),
    }));

    return sendSuccess(
      res,
      {
        rejectedConfirmations: cleanedBookings,
        totalRejected: cleanedBookings.length,
      },
      "Rejected confirmation requests retrieved successfully"
    );
  }
);

export const getBookingStatus = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.params;

    if (!bookingId || !/^[0-9]+$/.test(bookingId)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.id, parseInt(bookingId)),
      with: {
        car: {
          with: {
            vendor: true,
            parking: true,
            catalog: true,
          },
        },
        pickupParking: true,
        dropoffParking: true,
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            number: true,
          },
        },
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const booking = result;

    if (booking.userId !== req.user.id) {
      throw ApiError.forbidden("You can only view your own booking status");
    }

    // Clean up tools data
    const cleanedBooking = {
      ...booking,
      tools: cleanToolsData(booking.tools),
    };

    // Calculate booking progress and status
    const statusInfo = calculateBookingStatus(cleanedBooking);

    return sendSuccess(
      res,
      {
        booking: cleanedBooking,
        statusInfo,
      },
      "Booking status retrieved successfully"
    );
  }
);

// Helper function to calculate comprehensive booking status
const calculateBookingStatus = (booking: any) => {
  const statusInfo = {
    // Overall booking status
    overallStatus: booking.status,
    confirmationStatus: booking.confirmationStatus,

    // Payment status
    advancePaymentStatus: booking.advancePaymentId !== null ? "paid" : "pending",
    finalPaymentStatus: booking.finalPaymentId !== null ? "paid" : "pending",

    // Progress tracking
    progress: {
      advancePayment: false,
      otpVerification: false,
      userConfirmation: false,
      picApproval: false,
      finalPayment: false,
      carPickup: false,
      carReturn: false,
    },

    // Next steps
    nextSteps: [] as string[],
    currentStep: "",
    isCompleted: false,
    canProceed: false,

    // Status messages (now always includes all steps)
    statusMessages: [] as string[],
  };

  // 1. Advance payment - always show
  if (booking.advancePaymentId !== null) {
    statusInfo.progress.advancePayment = true;
    statusInfo.statusMessages.push("✅ Advance payment completed");
  } else {
    statusInfo.nextSteps.push("Complete advance payment to proceed");
    statusInfo.statusMessages.push("⏳ Advance payment pending");
  }

  // 2. OTP verification - always show
  if (booking.otpVerified) {
    statusInfo.progress.otpVerification = true;
    statusInfo.statusMessages.push("✅ OTP verified");
  } else {
    statusInfo.statusMessages.push("⏳ OTP verification pending");
    if (booking.otpCode && booking.advancePaymentId !== null) {
      statusInfo.nextSteps.push("Verify OTP at pickup location");
    }
  }

  // 3. User confirmation - always show
  if (booking.userConfirmed) {
    statusInfo.progress.userConfirmation = true;
    statusInfo.statusMessages.push("✅ User confirmation submitted");
  } else {
    statusInfo.statusMessages.push("⏳ User confirmation pending");
    if (booking.otpVerified && booking.advancePaymentId !== null) {
      statusInfo.nextSteps.push("Submit car condition confirmation");
    }
  }

  // 4. PIC approval - always show
  if (booking.userConfirmed && booking.confirmationStatus === "approved") {
    statusInfo.progress.picApproval = true;
    statusInfo.statusMessages.push("✅ PIC approval completed");
  } else if (
    booking.userConfirmed &&
    booking.confirmationStatus === "rejected"
  ) {
    statusInfo.nextSteps.push("Resubmit confirmation request");
    statusInfo.statusMessages.push("❌ Confirmation rejected by PIC");
  } else if (
    booking.userConfirmed &&
    booking.confirmationStatus === "pending_approval"
  ) {
    statusInfo.nextSteps.push("Wait for PIC approval");
    statusInfo.statusMessages.push("⏳ PIC approval pending");
  } else {
    // User hasn't confirmed yet, so PIC approval is not applicable yet
    statusInfo.statusMessages.push("⏳ PIC approval pending");
  }

  // 5. Final payment - always show
  if (booking.finalPaymentId !== null) {
    statusInfo.progress.finalPayment = true;
    statusInfo.statusMessages.push("✅ Final payment completed");
  } else {
    statusInfo.statusMessages.push("⏳ Final payment pending");
    if (booking.userConfirmed && booking.confirmationStatus === "approved") {
      statusInfo.nextSteps.push("Complete final payment");
    }
  }

  // 6. Car pickup - always show
  if (booking.actualPickupDate) {
    statusInfo.progress.carPickup = true;
    statusInfo.statusMessages.push("✅ Car pickup completed");
  } else {
    statusInfo.statusMessages.push("⏳ Car pickup pending");
    if (booking.otpVerified && booking.finalPaymentId !== null) {
      statusInfo.nextSteps.push("Wait for PIC to confirm car pickup");
    }
  }

  // 7. Car return - always show
  if (booking.actualDropoffDate) {
    statusInfo.progress.carReturn = true;
    statusInfo.statusMessages.push("✅ Car returned complete");
  } else {
    statusInfo.statusMessages.push("⏳ Car return pending");
    if (booking.actualPickupDate) {
      statusInfo.nextSteps.push("Wait for PIC to confirm car return");
    }
  }

  // Determine current step and completion status
  if (!statusInfo.progress.advancePayment) {
    statusInfo.currentStep = "Advance Payment";
    statusInfo.canProceed = true;
  } else if (!booking.otpCode) {
    statusInfo.currentStep = "OTP Generation";
    statusInfo.canProceed = false;
  } else if (!statusInfo.progress.otpVerification) {
    statusInfo.currentStep = "OTP Verification";
    statusInfo.canProceed = true;
  } else if (!statusInfo.progress.userConfirmation) {
    statusInfo.currentStep = "User Confirmation";
    statusInfo.canProceed = true;
  } else if (!statusInfo.progress.picApproval) {
    statusInfo.currentStep = "PIC Approval";
    statusInfo.canProceed = false;
  } else if (!statusInfo.progress.finalPayment) {
    statusInfo.currentStep = "Final Payment";
    statusInfo.canProceed = true;
  } else if (!statusInfo.progress.carPickup) {
    statusInfo.currentStep = "Car Pickup (PIC Confirmation)";
    statusInfo.canProceed = false;
  } else if (!statusInfo.progress.carReturn) {
    statusInfo.currentStep = "Car Return (PIC Confirmation)";
    statusInfo.canProceed = false;
  } else {
    statusInfo.currentStep = "Completed";
    statusInfo.isCompleted = true;
  }

  // Add specific messages based on status (these are additional contextual messages)
  if (booking.confirmationStatus === "rejected" && booking.picComments) {
    statusInfo.statusMessages.push(`📝 PIC Comments: ${booking.picComments}`);
  }

  if (booking.otpCode && !booking.otpVerified) {
    statusInfo.statusMessages.push(
      "🔐 OTP code generated and ready for verification"
    );
  } else if (booking.advancePaymentId !== null && !booking.otpCode) {
    statusInfo.statusMessages.push("⏳ OTP generation pending");
  }

  return statusInfo;
};

export const getUserBookingsWithStatus = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;

    const result = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { eq }) => eq(bookingsTable.userId, userId),
      with: {
        car: {
          with: {
            vendor: true,
            parking: true,
            catalog: true,
          },
        },
        pickupParking: true,
        dropoffParking: true,
      },
      orderBy: (bookingsTable, { desc }) => [desc(bookingsTable.createdAt)],
    });

    // Clean up tools data and add status summaries
    const bookingsWithStatus = result.map((booking) => {
      const cleanedBooking = {
        ...booking,
        tools: cleanToolsData(booking.tools),
        statusSummary: calculateBookingStatus(booking),
        billingBreakdown: {
          basePrice: booking.basePrice,
          insuranceAmount: booking.insuranceAmount || 0,
          deliveryCharges: booking.deliveryCharges || 0,
          discountAmount: booking.discountAmount || 0,
          totalBeforeDiscount:
            Number(booking.basePrice) +
            Number(booking.insuranceAmount || 0) +
            Number(booking.deliveryCharges || 0),
          totalPrice: booking.totalPrice,
          advanceAmount: booking.advanceAmount,
          remainingAmount: booking.remainingAmount,
        },
      };
      return cleanedBooking;
    });

    // Group bookings by status
    const groupedBookings = {
      active: bookingsWithStatus.filter(
        (b) =>
          b.status &&
          ["pending", "advance_paid", "confirmed", "active"].includes(
            b.status
          ) &&
          !b.statusSummary.isCompleted
      ),
      completed: bookingsWithStatus.filter(
        (b) => b.status === "completed" || b.statusSummary.isCompleted
      ),
      cancelled: bookingsWithStatus.filter((b) => b.status === "cancelled"),
    };

    return sendSuccess(
      res,
      {
        allBookings: bookingsWithStatus,
        groupedBookings,
        summary: {
          total: bookingsWithStatus.length,
          active: groupedBookings.active.length,
          completed: groupedBookings.completed.length,
          cancelled: groupedBookings.cancelled.length,
        },
      },
      "User bookings with status retrieved successfully"
    );
  }
);

export const confirmCarPickup = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.body;
    const picId = req.user.id;

    if (!bookingId) {
      throw ApiError.badRequest("Booking ID is required");
    }

    const booking = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
      with: {
        car: {
          with: {
            parking: true,
          },
        },
      },
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    // Check if user is PIC (Parking In Charge)
    if ((req.user as any).role !== "parkingincharge") {
      throw ApiError.forbidden("Only Parking In Charge can confirm car pickup");
    }

    // Check if PIC belongs to the parking lot where the car is located
    if (booking.pickupParkingId !== (req.user as any).parkingid) {
      throw ApiError.forbidden(
        "You can only confirm pickup for cars in your assigned parking lot"
      );
    }

    // Check if all prerequisites are met
    if (booking.advancePaymentId === null) {
      throw ApiError.badRequest("Advance payment must be completed");
    }

    if (booking.finalPaymentId === null) {
      throw ApiError.badRequest("Final payment must be completed");
    }

    if (!booking.otpVerified) {
      throw ApiError.badRequest("OTP must be verified before car pickup");
    }

    if (booking.confirmationStatus !== "approved") {
      throw ApiError.badRequest("Confirmation must be approved by PIC");
    }

    if (booking.actualPickupDate) {
      throw ApiError.conflict("Car has already been picked up");
    }

    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        actualPickupDate: new Date(),
        status: "active", // Change status to active when car is picked up
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    // Keep car status as "booked" and unavailable during active rental
    await db
      .update(carModel)
      .set({ 
        status: "booked",
      })
      .where(eq(carModel.id, booking.carId));

    return sendUpdated(
      res,
      updatedBooking[0],
      "Car pickup confirmed successfully. The car has been taken from the parking lot."
    );
  }
);

// Get booking timeline status (replaces late fee calculation)
export const getBookingTimelineStatus = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.params;

    if (!bookingId || !/^[0-9]+$/.test(bookingId)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.id, parseInt(bookingId)),
      with: {
        car: {
          with: {
            catalog: true,
          },
        },
        advancePayment: true,
        finalPayment: true,
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const booking = result;

    if (booking.userId !== req.user.id) {
      throw ApiError.forbidden(
        "You can only view status for your own bookings"
      );
    }

    const now = new Date();
    const endDate = new Date(booking.extensionTill || booking.endDate);
    const isOverdue = now > endDate;
    const hasTopup = booking.extensionTill !== null;

    // Calculate overdue hours for display purposes only
    const overdueHours = isOverdue ? Math.ceil(
      (now.getTime() - endDate.getTime()) / (1000 * 60 * 60)
    ) : 0;

    // Determine booking status
    let bookingStatus = "ontime";
    if (hasTopup && isOverdue) {
      bookingStatus = "topup/late";
    } else if (hasTopup && !isOverdue) {
      bookingStatus = "topup/ontime";
    } else if (!hasTopup && isOverdue) {
      bookingStatus = "late";
    }

    return sendSuccess(
      res,
      {
        bookingId: booking.id,
        bookingStatus,
        isOverdue,
        hasTopup,
        overdueHours,
        currentEndDate: booking.extensionTill || booking.endDate,
        originalEndDate: booking.endDate,
        extensionTill: booking.extensionTill,
        carName: "Unknown Car", // Car name not available in this query
        canUseTopup: true, // Users can always use topup if needed
        topupPrice: booking.extensionPrice || 0,
      },
      "Booking timeline status retrieved successfully"
    );
  }
);

// Function removed - users should use topup instead of late fees

// Confirm car return (PIC confirms car has been returned to parking lot)
export const confirmCarReturn = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId, returnCondition, returnImages, comments } = req.body;

    if (!bookingId) {
      throw ApiError.badRequest("Booking ID is required");
    }

    const booking = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
      with: {
        car: {
          with: {
            parking: true,
            catalog: true,
          },
        },
      },
    });

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    // Check if user is PIC (Parking In Charge)
    if ((req.user as any).role !== "parkingincharge") {
      throw ApiError.forbidden("Only Parking In Charge can confirm car return");
    }

    // Check if PIC belongs to the parking lot where the car is located
    if (booking.pickupParkingId !== (req.user as any).parkingid) {
      throw ApiError.forbidden(
        "You can only confirm return for cars in your assigned parking lot"
      );
    }

    // Check if all prerequisites are met
    if (booking.status !== "active") {
      throw ApiError.badRequest("Booking must be active to confirm return");
    }

    if (!booking.actualPickupDate) {
      throw ApiError.badRequest(
        "Car must be picked up before it can be returned"
      );
    }

    if (booking.actualDropoffDate) {
      throw ApiError.conflict("Car has already been returned");
    }

    const now = new Date();
    const endDate = new Date(booking.extensionTill || booking.endDate);
    const isOverdue = now > endDate;

    // No late fee check needed - users can use topup if needed

    const updatedBooking = await db
      .update(bookingsTable)
      .set({
        actualDropoffDate: now,
        status: "completed",
        returnCondition: returnCondition || "good",
        returnImages: returnImages || [],
        returnComments: comments || null,
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    // Make car available again after return
    await db
      .update(carModel)
      .set({ 
        status: "available",
      })
      .where(eq(carModel.id, booking.carId));

    const message = "Car return confirmed successfully. Car is now available for new bookings.";

    return sendUpdated(res, updatedBooking[0], message);
  }
);

// Get earnings overview (Admin only)
export const getEarningsOverview = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    if ((req.user as any).role !== "admin") {
      throw ApiError.forbidden("Only admins can view earnings overview");
    }

    // Use validated dates from request object (transformed by validation middleware)
    const startDate = (req as any).startDate;
    const endDate = (req as any).endDate;

    const start =
      startDate || new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate || new Date();

    const result = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { and, gte, lte, eq }) =>
        and(
          eq(bookingsTable.status, "completed"),
          gte(bookingsTable.createdAt, start),
          lte(bookingsTable.createdAt, end)
        ),
      with: {
        car: {
          with: {
            catalog: true,
          },
        },
      },
    });

    let totalEarnings = 0;
    let totalAdvancePayments = 0;
    let totalFinalPayments = 0;
    let totalExtensionPayments = 0;
    let totalLateFees = 0;
    let totalDeliveryCharges = 0;

    result.forEach((booking) => {
      totalAdvancePayments += booking.advanceAmount || 0;
      totalFinalPayments += booking.remainingAmount || 0;
      totalExtensionPayments += booking.extensionPrice || 0;
      // Late fees removed
      totalDeliveryCharges += booking.deliveryCharges || 0;
    });

    totalEarnings =
      totalAdvancePayments +
      totalFinalPayments +
      totalExtensionPayments +
      totalLateFees +
      totalDeliveryCharges;

    return sendSuccess(
      res,
      {
        period: {
          startDate: start,
          endDate: end,
        },
        summary: {
          totalBookings: result.length,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalAdvancePayments: Math.round(totalAdvancePayments * 100) / 100,
          totalFinalPayments: Math.round(totalFinalPayments * 100) / 100,
          totalExtensionPayments:
            Math.round(totalExtensionPayments * 100) / 100,
          // Late fees removed
          totalDeliveryCharges: Math.round(totalDeliveryCharges * 100) / 100,
        },
        breakdown: result.map((booking) => ({
          bookingId: booking.id,
          carName: "Unknown Car",
          totalAmount:
            Math.round(
              (booking.advanceAmount || 0) +
                (booking.remainingAmount || 0) +
                (booking.extensionPrice || 0) +
                // Late fees removed
                (booking.deliveryCharges || 0) * 100
            ) / 100,
          advanceAmount: booking.advanceAmount || 0,
          finalAmount: booking.remainingAmount || 0,
          extensionAmount: booking.extensionPrice || 0,
          // Late fees removed
          deliveryCharges: booking.deliveryCharges || 0,
          completedAt: booking.actualDropoffDate,
        })),
      },
      "Earnings overview retrieved successfully"
    );
  }
);

// Check if booking is overdue (replaces late fee calculation)
export const checkBookingOverdue = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId } = req.params;

    if (!bookingId || !/^[0-9]+$/.test(bookingId)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.id, parseInt(bookingId)),
      with: {
        car: {
          with: {
            catalog: true,
          },
        },
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const booking = result;

    if (booking.userId !== req.user.id) {
      throw ApiError.forbidden("You can only check your own bookings");
    }

    const now = new Date();
    const endDate = new Date(booking.extensionTill || booking.endDate);
    const isOverdue = now > endDate;
    const hasTopup = booking.extensionTill !== null;

    // Calculate overdue hours for display purposes only
    const overdueHours = isOverdue ? Math.ceil(
      (now.getTime() - endDate.getTime()) / (1000 * 60 * 60)
    ) : 0;

    // Determine booking status
    let bookingStatus = "ontime";
    if (hasTopup && isOverdue) {
      bookingStatus = "topup/late";
    } else if (hasTopup && !isOverdue) {
      bookingStatus = "topup/ontime";
    } else if (!hasTopup && isOverdue) {
      bookingStatus = "late";
    }

    return sendSuccess(
      res,
      {
        bookingId: booking.id,
        bookingStatus,
        isOverdue,
        hasTopup,
        overdueHours,
        currentEndDate: booking.extensionTill || booking.endDate,
        originalEndDate: booking.endDate,
        extensionTill: booking.extensionTill,
        extensionTime: booking.extensionTime,
        extensionPrice: booking.extensionPrice,
        canUseTopup: true, // Users can always use topup if needed
        carName: "Unknown Car", // Car name not available in this query
      },
      "Booking overdue status checked successfully"
    );
  }
);

// Apply topup to extend booking
export const applyTopupToBooking = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { bookingId, topupId, paymentReferenceId } = req.body;

    if (!bookingId || !topupId || !paymentReferenceId) {
      throw ApiError.badRequest(
        "Booking ID, topup ID, and payment reference ID are required"
      );
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) => eq(bookingsTable.id, bookingId),
      with: {
        car: true,
        user: true,
        pickupParking: true,
        dropoffParking: true,
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const booking = result;

    if (booking.userId !== req.user.id) {
      throw ApiError.forbidden(
        "You can only apply topups to your own bookings"
      );
    }

    // Check if booking is active
    if (booking.status !== "active") {
      throw ApiError.badRequest(
        "Topups can only be applied to active bookings"
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
    const currentEndDate = booking.extensionTill || new Date(booking.endDate);
    const extensionTime = topup[0].duration; // in hours
    const newEndDate = new Date(
      currentEndDate.getTime() + extensionTime * 60 * 60 * 1000
    );

    // Create booking-topup relationship
    const bookingTopup = await db
      .insert(bookingTopupTable)
      .values({
        bookingId: bookingId,
        topupId: topupId,
        appliedAt: new Date(),
        originalEndDate: currentEndDate,
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
        extensionPrice: (booking.extensionPrice || 0) + topup[0].price,
        extensionTill: newEndDate,
        extensionTime: (booking.extensionTime || 0) + extensionTime,
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    return sendSuccess(
      res,
      {
        bookingTopup: bookingTopup[0],
        updatedBooking: updatedBooking[0],
        topup: topup[0],
        newEndDate: newEndDate,
        extensionTime: extensionTime,
      },
      "Topup applied successfully. Booking extended."
    );
  }
);

// Get cars coming for pickup at PIC's parking lot (PIC only)
export const getPickupCars = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    try {
      if (!req.user || req.user.role !== "parkingincharge") {
        throw ApiError.forbidden("Parking In Charge access required");
      }

      const { startDate, endDate, limit = 20, page = 1 } = req.query;

      // Parse and validate query parameters
      const limitNum = Math.min(parseInt(limit as string) || 20, 50);
      const pageNum = Math.max(parseInt(page as string) || 1, 1);
      const offset = (pageNum - 1) * limitNum;

      // Build where conditions for pickup cars
      const conditions: any[] = [
        isNotNull(bookingsTable.advancePaymentId), // After advance payment
        eq(bookingsTable.status, "advance_paid"), // Status should be advance_paid
        // Note: We'll need to get the PIC's parking lot ID from their profile or a separate table
        // For now, we'll show all pickup cars and let the frontend filter by parking lot
      ];

      // Add date filtering if provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw ApiError.badRequest("Invalid date format");
        }

        if (start >= end) {
          throw ApiError.badRequest("End date must be after start date");
        }

        // Filter by pickup date range - handle null pickupDate gracefully
        const pickupDateCondition = bookingsTable.pickupDate
          ? and(
              gte(bookingsTable.pickupDate, start),
              lte(bookingsTable.pickupDate, end)
            )
          : and(
              gte(bookingsTable.startDate, start),
              lte(bookingsTable.startDate, end)
            );

        if (pickupDateCondition) {
          conditions.push(pickupDateCondition);
        }
      }

      // Get total count
      const totalPickups = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(and(...conditions.filter(Boolean)));

      const total = totalPickups[0]?.count || 0;

      // Get pickup cars with pagination
      const pickupCars = await db
        .select({
          id: bookingsTable.id,
          carId: bookingsTable.carId,
          userId: bookingsTable.userId,
          startDate: bookingsTable.startDate,
          endDate: bookingsTable.endDate,
          pickupDate: bookingsTable.pickupDate,
          actualPickupDate: bookingsTable.actualPickupDate,
          basePrice: bookingsTable.basePrice,
          advanceAmount: bookingsTable.advanceAmount,
          remainingAmount: bookingsTable.remainingAmount,
          totalPrice: bookingsTable.totalPrice,
          status: bookingsTable.status,
          advancePaymentId: bookingsTable.advancePaymentId,
          otpCode: bookingsTable.otpCode,
          otpVerified: bookingsTable.otpVerified,
          userConfirmed: bookingsTable.userConfirmed,
          picApproved: bookingsTable.picApproved,
          pickupParkingId: bookingsTable.pickupParkingId,
          dropoffParkingId: bookingsTable.dropoffParkingId,
          createdAt: bookingsTable.createdAt,
          updatedAt: bookingsTable.updatedAt,
        })
        .from(bookingsTable)
        .where(and(...conditions.filter(Boolean)))
        .limit(limitNum)
        .offset(offset)
        .orderBy(desc(bookingsTable.pickupDate || bookingsTable.startDate));

      // Get additional details for each booking
      const enrichedPickupCars = await Promise.all(
        pickupCars.map(async (booking) => {
          // Get car details
          const car = await db
            .select({
              id: carModel.id,
              name: carModel.name,
              number: carModel.number,
              color: carModel.color,
              price: carModel.price,
              images: carModel.images,
              catalogId: carModel.catalogId,
            })
            .from(carModel)
            .where(eq(carModel.id, booking.carId))
            .limit(1);

          // Get user details
          const user = await db
            .select({
              id: UserTable.id,
              name: UserTable.name,
              email: UserTable.email,
              number: UserTable.number,
            })
            .from(UserTable)
            .where(eq(UserTable.id, booking.userId))
            .limit(1);

          // Get parking details
          const pickupParking = booking.pickupParkingId
            ? await db
                .select({
                  id: parkingTable.id,
                  name: parkingTable.name,
                  locality: parkingTable.locality,
                  city: parkingTable.city,
                  state: parkingTable.state,
                })
                .from(parkingTable)
                .where(eq(parkingTable.id, booking.pickupParkingId))
                .limit(1)
            : null;

          const dropoffParking = booking.dropoffParkingId
            ? await db
                .select({
                  id: parkingTable.id,
                  name: parkingTable.name,
                  locality: parkingTable.locality,
                  city: parkingTable.city,
                  state: parkingTable.state,
                })
                .from(parkingTable)
                .where(eq(parkingTable.id, booking.dropoffParkingId))
                .limit(1)
            : null;

          return {
            ...booking,
            car: car[0] || null,
            user: user[0] || null,
            pickupParking: pickupParking?.[0] || null,
            dropoffParking: dropoffParking?.[0] || null,
          };
        })
      );

      // Calculate pagination info
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      return sendPaginated(
        res,
        enrichedPickupCars,
        total,
        pageNum,
        limitNum,
        "Pickup cars fetched successfully"
      );
    } catch (error) {
      console.log(error);
      throw new ApiError(500, "Failed to fetch pickup cars");
    }
  }
);

// Get cars coming for dropoff at PIC's parking lot (PIC only)
export const getDropoffCars = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    try {
      if (!req.user || req.user.role !== "parkingincharge") {
        throw ApiError.forbidden("Parking In Charge access required");
      }

      const { startDate, endDate, limit = 20, page = 1 } = req.query;

      // Parse and validate query parameters
      const limitNum = Math.min(parseInt(limit as string) || 20, 50);
      const pageNum = Math.max(parseInt(page as string) || 1, 1);
      const offset = (pageNum - 1) * limitNum;

      // Build where conditions for dropoff cars
      const conditions: any[] = [
        eq(bookingsTable.status, "active"), // Active bookings
        isNotNull(bookingsTable.finalPaymentId), // Final payment completed
        // Note: We'll need to get the PIC's parking lot ID from their profile or a separate table
        // For now, we'll show all dropoff cars and let the frontend filter by parking lot
      ];

      // Add date filtering if provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw ApiError.badRequest("Invalid date format");
        }

        if (start >= end) {
          throw ApiError.badRequest("End date must be after start date");
        }

        // Filter by dropoff date range (end date of booking)
        conditions.push(
          and(
            gte(bookingsTable.endDate, start),
            lte(bookingsTable.endDate, end)
          )
        );
      }

      // Get total count
      const totalDropoffs = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(and(...conditions.filter(Boolean)));

      const total = totalDropoffs[0]?.count || 0;

      // Get dropoff cars with pagination
      const dropoffCars = await db
        .select({
          id: bookingsTable.id,
          carId: bookingsTable.carId,
          userId: bookingsTable.userId,
          startDate: bookingsTable.startDate,
          endDate: bookingsTable.endDate,
          actualPickupDate: bookingsTable.actualPickupDate,
          actualDropoffDate: bookingsTable.actualDropoffDate,
          basePrice: bookingsTable.basePrice,
          advanceAmount: bookingsTable.advanceAmount,
          remainingAmount: bookingsTable.remainingAmount,
          totalPrice: bookingsTable.totalPrice,
          status: bookingsTable.status,
          finalPaymentId: bookingsTable.finalPaymentId,
          extensionPrice: bookingsTable.extensionPrice,
          extensionTill: bookingsTable.extensionTill,
          // Late fees removed
          returnCondition: bookingsTable.returnCondition,
          returnComments: bookingsTable.returnComments,
          pickupParkingId: bookingsTable.pickupParkingId,
          dropoffParkingId: bookingsTable.dropoffParkingId,
          createdAt: bookingsTable.createdAt,
          updatedAt: bookingsTable.updatedAt,
        })
        .from(bookingsTable)
        .where(and(...conditions.filter(Boolean)))
        .limit(limitNum)
        .offset(offset)
        .orderBy(desc(bookingsTable.endDate));

      // Get additional details for each booking
      const enrichedDropoffCars = await Promise.all(
        dropoffCars.map(async (booking) => {
          // Get car details
          const car = await db
            .select({
              id: carModel.id,
              name: carModel.name,
              number: carModel.number,
              color: carModel.color,
              price: carModel.price,
              images: carModel.images,
              catalogId: carModel.catalogId,
            })
            .from(carModel)
            .where(eq(carModel.id, booking.carId))
            .limit(1);

          // Get user details
          const user = await db
            .select({
              id: UserTable.id,
              name: UserTable.name,
              email: UserTable.email,
              number: UserTable.number,
            })
            .from(UserTable)
            .where(eq(UserTable.id, booking.userId))
            .limit(1);

          // Get parking details
          const pickupParking = booking.pickupParkingId
            ? await db
                .select({
                  id: parkingTable.id,
                  name: parkingTable.name,
                  locality: parkingTable.locality,
                  city: parkingTable.city,
                  state: parkingTable.state,
                })
                .from(parkingTable)
                .where(eq(parkingTable.id, booking.pickupParkingId))
                .limit(1)
            : null;

          const dropoffParking = booking.dropoffParkingId
            ? await db
                .select({
                  id: parkingTable.id,
                  name: parkingTable.name,
                  locality: parkingTable.locality,
                  city: parkingTable.city,
                  state: parkingTable.state,
                })
                .from(parkingTable)
                .where(eq(parkingTable.id, booking.dropoffParkingId))
                .limit(1)
            : null;

          return {
            ...booking,
            car: car[0] || null,
            user: user[0] || null,
            pickupParking: pickupParking?.[0] || null,
            dropoffParking: dropoffParking?.[0] || null,
          };
        })
      );

      // Calculate pagination info
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      return sendPaginated(
        res,
        enrichedDropoffCars,
        total,
        pageNum,
        limitNum,
        "Dropoff cars fetched successfully"
      );
    } catch (error) {
      console.log(error);
      throw new ApiError(500, "Failed to fetch dropoff cars");
    }
  }
);

export const getPICBookings = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const picId = req.user.id;
    const picParkingId = (req.user as any).parkingid;

    if (!picParkingId) {
      throw ApiError.badRequest("PIC must be assigned to a parking lot");
    }

    // Check if user is PIC (Parking In Charge)
    if ((req.user as any).role !== "parkingincharge") {
      throw ApiError.forbidden(
        "Only Parking In Charge can access this endpoint"
      );
    }

    // Get all cars in PIC's parking lot
    const cars = await db.query.carModel.findMany({
      where: (carModel, { eq }) => eq(carModel.parkingid, picParkingId),
      with: {
        vendor: true,
        parking: true,
        catalog: true,
      },
    });

    // Get all bookings for cars in PIC's parking lot
    const rawBookings = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { inArray }) =>
        cars.length > 0
          ? inArray(
              bookingsTable.carId,
              cars.map((car) => car.id)
            )
          : undefined,
      with: {
        car: {
          with: {
            vendor: true,
            parking: true,
            catalog: true,
          },
        },
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            number: true,
          },
        },
        pickupParking: true,
        dropoffParking: true,
      },
      orderBy: (bookingsTable, { desc }) => [desc(bookingsTable.createdAt)],
    });

    // Clean up tools data for all bookings
    const bookings = rawBookings.map((booking) => ({
      ...booking,
      tools: cleanToolsData(booking.tools),
    }));

    // Group bookings by status
    const groupedBookings = {
      pending: bookings.filter((b) => b.status === "pending"),
      advancePaid: bookings.filter((b) => b.status === "advance_paid"),
      confirmed: bookings.filter((b) => b.status === "confirmed"),
      active: bookings.filter((b) => b.status === "active"),
      completed: bookings.filter((b) => b.status === "completed"),
      cancelled: bookings.filter((b) => b.status === "cancelled"),
    };

    // Get statistics
    const stats = {
      totalBookings: bookings.length,
      pending: groupedBookings.pending.length,
      advancePaid: groupedBookings.advancePaid.length,
      confirmed: groupedBookings.confirmed.length,
      active: groupedBookings.active.length,
      completed: groupedBookings.completed.length,
      cancelled: groupedBookings.cancelled.length,
    };

    return sendSuccess(
      res,
      {
        parkingLotId: picParkingId,
        cars,
        bookings,
        groupedBookings,
        stats,
      },
      "PIC bookings retrieved successfully"
    );
  }
);

export const getPublicBookingStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { bookingId } = req.params;

    if (!bookingId || !/^[0-9]+$/.test(bookingId)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq }) =>
        eq(bookingsTable.id, parseInt(bookingId)),
      with: {
        car: {
          with: {
            vendor: true,
            parking: true,
            catalog: true,
          },
        },
        pickupParking: true,
        dropoffParking: true,
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            number: true,
          },
        },
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found");
    }

    const booking = result;

    // Clean up tools data
    const cleanedBooking = {
      ...booking,
      tools: cleanToolsData(booking.tools),
    };

    // Calculate booking progress and status
    const statusInfo = calculateBookingStatus(cleanedBooking);

    return sendSuccess(
      res,
      {
        booking: cleanedBooking,
        statusInfo,
      },
      "Booking status retrieved successfully"
    );
  }
);

export const getUserBookingsFormatted = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;

    const result = await db.query.bookingsTable.findMany({
      where: (bookingsTable, { eq }) => eq(bookingsTable.userId, userId),
      with: {
        car: {
          with: {
            vendor: true,
            parking: true,
            catalog: true,
          },
        },
        pickupParking: true,
        dropoffParking: true,
      },
      orderBy: (bookingsTable, { desc }) => [desc(bookingsTable.createdAt)],
    });

    // Process bookings and format them according to the required structure
    const formattedBookings = result.map((booking) => {
      // Get car image from catalog or use a default
      const carImage = "https://example.com/car-images/default.jpg";

      // Get car name from catalog or use car name
      const carName = "Unknown Car";

      // Format dates
      const pickupDate = booking.startDate
        ? new Date(booking.startDate).toISOString().split("T")[0]
        : "";
      const dropoffDate = booking.endDate
        ? new Date(booking.endDate).toISOString().split("T")[0]
        : "";
      const bookedAt = booking.createdAt
        ? new Date(booking.createdAt).toISOString().split("T")[0]
        : "";

      // Format times (using pickup and dropoff dates if available)
      const pickupTime = booking.pickupDate
        ? new Date(booking.pickupDate).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "12:00 PM";

      const dropoffTime = booking.endDate
        ? new Date(booking.endDate).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "12:00 PM";

      // Get location names
      const pickupLocation = "Unknown Parking";
      const dropoffLocation = "Unknown Parking";

      // Determine status for current bookings
      let status = "inactive";
      if (
        booking.finalPaymentId !== null &&
        (booking.status === "active" || booking.status === "completed")
      ) {
        status = "active";
      }

      // Create billing breakdown
      const billingBreakdown = {
        basePrice: Number(booking.basePrice) || 0,
        insuranceAmount: Number(booking.insuranceAmount) || 0,
        deliveryCharges: Number(booking.deliveryCharges) || 0,
        discountAmount: Number(booking.discountAmount) || 0,
        totalBeforeDiscount:
          Number(booking.basePrice || 0) +
          Number(booking.insuranceAmount || 0) +
          Number(booking.deliveryCharges || 0),
        totalPrice: Number(booking.totalPrice) || 0,
        advanceAmount: Number(booking.advanceAmount) || 0,
        remainingAmount: Number(booking.remainingAmount) || 0,
      };

      return {
        id: booking.id,
        status,
        carImage,
        carName,
        pickupLocation,
        dropoffLocation,
        pickupDate,
        dropoffDate,
        pickupTime,
        dropoffTime,
        bookedAt,
        billingBreakdown,
      };
    });

    // Separate current and past bookings
    const currentBookings = formattedBookings.filter(
      (booking) => booking.status === "active" || booking.status === "inactive"
    );

    const pastBookings = formattedBookings.filter(
      (booking) => !currentBookings.includes(booking)
    );

    return sendSuccess(
      res,
      {
        bookings: {
          current: currentBookings,
          past: pastBookings,
        },
      },
      "User bookings retrieved successfully"
    );
  }
);

export const getDetailedBookingById = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid booking ID");
    }

    const bookingId = parseInt(id);

    const result = await db.query.bookingsTable.findFirst({
      where: (bookingsTable, { eq, and }) =>
        and(eq(bookingsTable.id, bookingId), eq(bookingsTable.userId, userId)),
      with: {
        car: {
          with: {
            vendor: true,
            parking: true,
            catalog: true,
          },
        },
        pickupParking: true,
        dropoffParking: true,
        coupon: true,
      },
    });

    if (!result) {
      throw ApiError.notFound("Booking not found or access denied");
    }

    // Calculate number of days
    const startDate = new Date(result.startDate);
    const endDate = new Date(result.endDate);
    const numberOfDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get car image from catalog or use a default
    const carImage = "https://example.com/car-images/default.jpg";

    // Get car name from catalog or use car name
    const carName = "Unknown Car";

    // Determine status
    let status = "inactive";
    if (
      result.finalPaymentId !== null &&
      (result.status === "active" || result.status === "completed")
    ) {
      status = "active";
    }

    // Format dates
    const pickupDate = result.startDate
      ? new Date(result.startDate).toISOString().split("T")[0]
      : "";
    const dropoffDate = result.endDate
      ? new Date(result.endDate).toISOString().split("T")[0]
      : "";
    const bookedOn = result.createdAt
      ? new Date(result.createdAt).toISOString().split("T")[0]
      : "";

    // Get location address
    const locationAddress = "Unknown Parking";

    // Create billing breakdown
    const billingBreakdown = {
      basePrice: Number(result.basePrice) || 0,
      insuranceAmount: Number(result.insuranceAmount) || 0,
      deliveryCharges: Number(result.deliveryCharges) || 0,
      discountAmount: Number(result.discountAmount) || 0,
      totalBeforeDiscount:
        Number(result.basePrice || 0) +
        Number(result.insuranceAmount || 0) +
        Number(result.deliveryCharges || 0),
      totalPrice: Number(result.totalPrice) || 0,
      advanceAmount: Number(result.advanceAmount) || 0,
      remainingAmount: Number(result.remainingAmount) || 0,
    };

    const detailedBooking = {
      name: carName,
      image: carImage,
      status: status,
      isOTP: result.otpVerified || false,
      isCarChecked:
        result.carConditionImages && result.carConditionImages.length > 0,
      isPaid: result.finalPaymentId !== null,
      totalRating: 4.5, // This would come from reviews table in a real implementation
      totalPeopleRated: 128, // This would come from reviews table in a real implementation
      parkingName: "Unknown Parking",
      perDayCost:
        Number(0) ||
        Number(0) ||
        0,
      carType: "Sedan",
      fuelType: "Petrol",
      noOfSeats: 5,
      bookingDetails: {
        pickupDate: pickupDate,
        dropoffDate: dropoffDate,
        numberOfDays: numberOfDays,
        locationAddress: locationAddress,
        couponCode: null,
        isInsurance: Number(result.insuranceAmount) > 0,
        isHomeDelivery: result.deliveryType === "delivery",
        bookedOn: bookedOn,
        billingBreakdown: billingBreakdown,
      },
    };

    return sendSuccess(
      res,
      {
        booking: detailedBooking,
      },
      "Detailed booking retrieved successfully"
    );
  }
);

// Admin function to get all bookings
export const getAllBookings = asyncHandler<AuthenticatedRequest>(
  async (req: Request, res: Response) => {
    const user = (req as any).user;

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    // Only admins can access all bookings
    if (user.role !== 'admin') {
      throw new ApiError(403, "Only admins can access all bookings");
    }

    try {
      // Get all bookings with related data
      const bookings = await db
        .select({
          // Booking fields
          id: bookingsTable.id,
          userId: bookingsTable.userId,
          carId: bookingsTable.carId,
          startDate: bookingsTable.startDate,
          endDate: bookingsTable.endDate,
          pickupDate: bookingsTable.pickupDate,
          actualPickupDate: bookingsTable.actualPickupDate,
          actualDropoffDate: bookingsTable.actualDropoffDate,
          originalPickupDate: bookingsTable.originalPickupDate,
          rescheduleCount: bookingsTable.rescheduleCount,
          maxRescheduleCount: bookingsTable.maxRescheduleCount,
          basePrice: bookingsTable.basePrice,
          advanceAmount: bookingsTable.advanceAmount,
          remainingAmount: bookingsTable.remainingAmount,
          totalPrice: bookingsTable.totalPrice,
          discountAmount: bookingsTable.discountAmount,
          insuranceAmount: bookingsTable.insuranceAmount,
          extensionPrice: bookingsTable.extensionPrice,
          extensionTill: bookingsTable.extensionTill,
          extensionTime: bookingsTable.extensionTime,
          // Late fees removed
          // lateFeesPaymentReferenceId: bookingsTable.lateFeesPaymentReferenceId, // Removed in migration
          // lateFeesPaidAt: bookingsTable.lateFeesPaidAt, // Removed in migration
          returnCondition: bookingsTable.returnCondition,
          returnImages: bookingsTable.returnImages,
          returnComments: bookingsTable.returnComments,
          status: bookingsTable.status,
          confirmationStatus: bookingsTable.confirmationStatus,
          advancePaymentId: bookingsTable.advancePaymentId,
          finalPaymentId: bookingsTable.finalPaymentId,
          // advancePaymentReferenceId: bookingsTable.advancePaymentReferenceId, // Removed in migration
          // finalPaymentReferenceId: bookingsTable.finalPaymentReferenceId, // Removed in migration
          carConditionImages: bookingsTable.carConditionImages,
          toolImages: bookingsTable.toolImages,
          tools: bookingsTable.tools,
          picApproved: bookingsTable.picApproved,
          picApprovedAt: bookingsTable.picApprovedAt,
          picApprovedBy: bookingsTable.picApprovedBy,
          picComments: bookingsTable.picComments,
          otpCode: bookingsTable.otpCode,
          otpExpiresAt: bookingsTable.otpExpiresAt,
          otpVerified: bookingsTable.otpVerified,
          otpVerifiedAt: bookingsTable.otpVerifiedAt,
          otpVerifiedBy: bookingsTable.otpVerifiedBy,
          userConfirmed: bookingsTable.userConfirmed,
          userConfirmedAt: bookingsTable.userConfirmedAt,
          pickupParkingId: bookingsTable.pickupParkingId,
          dropoffParkingId: bookingsTable.dropoffParkingId,
          deliveryType: bookingsTable.deliveryType,
          deliveryAddress: bookingsTable.deliveryAddress,
          deliveryCharges: bookingsTable.deliveryCharges,
          createdAt: bookingsTable.createdAt,
          updatedAt: bookingsTable.updatedAt,
          
          // Car fields
          car: {
            id: carModel.id,
            name: carModel.name,
            number: carModel.number,
            vendorid: carModel.vendorid,
            parkingid: carModel.parkingid,
            color: carModel.color,
            price: carModel.price,
            discountprice: carModel.discountprice,
            rcnumber: carModel.rcnumber,
            rcimg: carModel.rcimg,
            pollutionimg: carModel.pollutionimg,
            insuranceimg: carModel.insuranceimg,
            images: carModel.images,
            catalogId: carModel.catalogId,
            status: carModel.status,
            createdAt: carModel.createdAt,
            updatedAt: carModel.updatedAt,
          },
          
          // User fields
          user: {
            id: UserTable.id,
            name: UserTable.name,
            avatar: UserTable.avatar,
            age: UserTable.age,
            number: UserTable.number,
            email: UserTable.email,
            aadharNumber: UserTable.aadharNumber,
            aadharimg: UserTable.aadharimg,
            dlNumber: UserTable.dlNumber,
            dlimg: UserTable.dlimg,
            passportNumber: UserTable.passportNumber,
            passportimg: UserTable.passportimg,
            lat: UserTable.lat,
            lng: UserTable.lng,
            locality: UserTable.locality,
            city: UserTable.city,
            state: UserTable.state,
            country: UserTable.country,
            pincode: UserTable.pincode,
            role: UserTable.role,
            isverified: UserTable.isverified,
            parkingid: UserTable.parkingid,
            createdAt: UserTable.createdAt,
            updatedAt: UserTable.updatedAt,
          },
          
          // Pickup parking fields
          pickupParking: {
            id: sql`pickup_parking.id`.as('pickup_parking_id'),
            name: sql`pickup_parking.name`.as('pickup_parking_name'),
            locality: sql`pickup_parking.locality`.as('pickup_parking_locality'),
            city: sql`pickup_parking.city`.as('pickup_parking_city'),
            state: sql`pickup_parking.state`.as('pickup_parking_state'),
            country: sql`pickup_parking.country`.as('pickup_parking_country'),
            pincode: sql`pickup_parking.pincode`.as('pickup_parking_pincode'),
            capacity: sql`pickup_parking.capacity`.as('pickup_parking_capacity'),
            mainimg: sql`pickup_parking.mainimg`.as('pickup_parking_mainimg'),
            images: sql`pickup_parking.images`.as('pickup_parking_images'),
            lat: sql`pickup_parking.lat`.as('pickup_parking_lat'),
            lng: sql`pickup_parking.lng`.as('pickup_parking_lng'),
            createdAt: sql`pickup_parking.created_at`.as('pickup_parking_createdAt'),
            updatedAt: sql`pickup_parking.updated_at`.as('pickup_parking_updatedAt'),
          },
          
          // Dropoff parking fields
          dropoffParking: {
            id: sql`dropoff_parking.id`.as('dropoff_parking_id'),
            name: sql`dropoff_parking.name`.as('dropoff_parking_name'),
            locality: sql`dropoff_parking.locality`.as('dropoff_parking_locality'),
            city: sql`dropoff_parking.city`.as('dropoff_parking_city'),
            state: sql`dropoff_parking.state`.as('dropoff_parking_state'),
            country: sql`dropoff_parking.country`.as('dropoff_parking_country'),
            pincode: sql`dropoff_parking.pincode`.as('dropoff_parking_pincode'),
            capacity: sql`dropoff_parking.capacity`.as('dropoff_parking_capacity'),
            mainimg: sql`dropoff_parking.mainimg`.as('dropoff_parking_mainimg'),
            images: sql`dropoff_parking.images`.as('dropoff_parking_images'),
            lat: sql`dropoff_parking.lat`.as('dropoff_parking_lat'),
            lng: sql`dropoff_parking.lng`.as('dropoff_parking_lng'),
            createdAt: sql`dropoff_parking.created_at`.as('dropoff_parking_createdAt'),
            updatedAt: sql`dropoff_parking.updated_at`.as('dropoff_parking_updatedAt'),
          },
        })
        .from(bookingsTable)
        .leftJoin(carModel, eq(bookingsTable.carId, carModel.id))
        .leftJoin(UserTable, eq(bookingsTable.userId, UserTable.id))
        .leftJoin(
          sql`${parkingTable} as pickup_parking`,
          sql`${bookingsTable.pickupParkingId} = pickup_parking.id`
        )
        .leftJoin(
          sql`${parkingTable} as dropoff_parking`,
          sql`${bookingsTable.dropoffParkingId} = dropoff_parking.id`
        )
        .orderBy(desc(bookingsTable.createdAt));

      // Transform the data to match the expected format
      const transformedBookings = bookings.map(bookingData => ({
        id: bookingData.id,
        userId: bookingData.userId,
        carId: bookingData.carId,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        pickupDate: bookingData.pickupDate,
        actualPickupDate: bookingData.actualPickupDate,
        actualDropoffDate: bookingData.actualDropoffDate,
        originalPickupDate: bookingData.originalPickupDate,
        rescheduleCount: bookingData.rescheduleCount,
        maxRescheduleCount: bookingData.maxRescheduleCount,
        basePrice: bookingData.basePrice,
        advanceAmount: bookingData.advanceAmount,
        remainingAmount: bookingData.remainingAmount,
        totalPrice: bookingData.totalPrice,
        discountAmount: bookingData.discountAmount,
        insuranceAmount: bookingData.insuranceAmount,
        extensionPrice: bookingData.extensionPrice,
        extensionTill: bookingData.extensionTill,
        extensionTime: bookingData.extensionTime,
        // Late fees removed
        returnCondition: bookingData.returnCondition,
        returnImages: bookingData.returnImages,
        returnComments: bookingData.returnComments,
        status: bookingData.status,
        confirmationStatus: bookingData.confirmationStatus,
        advancePaymentStatus: bookingData.advancePaymentId !== null ? "paid" : "pending",
        finalPaymentStatus: bookingData.finalPaymentId !== null ? "paid" : "pending",
        advancePaymentReferenceId: null,
        finalPaymentReferenceId: null,
        carConditionImages: bookingData.carConditionImages,
        toolImages: bookingData.toolImages,
        tools: cleanToolsData(bookingData.tools),
        picApproved: bookingData.picApproved,
        picApprovedAt: bookingData.picApprovedAt,
        picApprovedBy: bookingData.picApprovedBy,
        picComments: bookingData.picComments,
        otpCode: bookingData.otpCode,
        otpExpiresAt: bookingData.otpExpiresAt,
        otpVerified: bookingData.otpVerified,
        otpVerifiedAt: bookingData.otpVerifiedAt,
        otpVerifiedBy: bookingData.otpVerifiedBy,
        userConfirmed: bookingData.userConfirmed,
        userConfirmedAt: bookingData.userConfirmedAt,
        pickupParkingId: bookingData.pickupParkingId,
        dropoffParkingId: bookingData.dropoffParkingId,
        deliveryType: bookingData.deliveryType,
        deliveryAddress: bookingData.deliveryAddress,
        deliveryCharges: bookingData.deliveryCharges,
        createdAt: bookingData.createdAt,
        updatedAt: bookingData.updatedAt,
        car: bookingData.car,
        user: bookingData.user,
        pickupParking: bookingData.pickupParking,
        dropoffParking: bookingData.dropoffParking,
        // Add paymentStatus field for compatibility with frontend
        paymentStatus: bookingData.finalPaymentId !== null ? "paid" : "pending",
      }));

      sendSuccess(res, transformedBookings, "All bookings retrieved successfully");
    } catch (error) {
      console.error("Error fetching all bookings:", error);
      throw new ApiError(500, "Failed to fetch bookings");
    }
  }
);
