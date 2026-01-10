import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiResponse";
import { db } from "../../drizzle/db";
import { bookingsTable, bookingRelations } from "../booking/bookingmodel";
import { carModel, carRelations, carCatalogTable } from "../car/carmodel";
import { UserTable } from "../user/usermodel";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Extend the Request interface to include 'user' property
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    parkingid: number;
    role: string;
  };
}

// Get cars coming for pickup at PIC's parking lot
export const getPickupCars = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const picParkingId = req.user.parkingid;

    if (!picParkingId) {
      throw new ApiResponse(400, null, "PIC must be assigned to a parking lot");
    }

    // Get all cars in PIC's parking lot that are booked and ready for pickup
    // Get cars in PIC's parking lot first
    const carsInParking = await db
      .select({ carId: carModel.id })
      .from(carModel)
      .where(eq(carModel.parkingid, picParkingId));

    const carIds = carsInParking.map(car => car.carId);

    // Create aliases for UserTable to avoid conflicts
    const vendorTable = alias(UserTable, 'vendor');
    const userTable = alias(UserTable, 'user');

    // Now get bookings with proper joins
    const pickupCars = await db
      .select({
        // Booking fields
        id: bookingsTable.id,
        carId: bookingsTable.carId,
        userId: bookingsTable.userId,
        status: bookingsTable.status,
        pickupDate: bookingsTable.pickupDate,
        startDate: bookingsTable.startDate,
        endDate: bookingsTable.endDate,
        actualPickupDate: bookingsTable.actualPickupDate,
        // Car fields
        carNumber: carModel.number,
        carColor: carModel.color,
        carPrice: carModel.price,
        // Car catalog fields
        carName: carCatalogTable.carName,
        carMaker: carCatalogTable.carMaker,
        // Vendor fields
        vendorName: vendorTable.name,
        // User fields
        userName: userTable.name,
        userEmail: userTable.email,
        userNumber: userTable.number,
      })
      .from(bookingsTable)
      .leftJoin(carModel, eq(bookingsTable.carId, carModel.id))
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
      .leftJoin(vendorTable, eq(carModel.vendorid, vendorTable.id))
      .leftJoin(userTable, eq(bookingsTable.userId, userTable.id))
      .where(
        and(
          inArray(bookingsTable.carId, carIds),
          eq(bookingsTable.status, "advance_paid"),
          eq(bookingsTable.picApproved, false)
        )
      )
      .orderBy(bookingsTable.pickupDate);

    // Transform the data to include required fields
    const transformedCars = pickupCars.map((booking) => ({
      id: `car${booking.carId}`,
      bookingId: booking.id,
      carId: booking.carId,
      userId: booking.userId,
      licensePlate: booking.carNumber || "Unknown Plate",
      model: booking.carName || "Unknown Car",
      pickupTime: booking.pickupDate || booking.startDate,
      customerName: booking.userName || "Unknown User",
      customerEmail: booking.userEmail || "unknown@example.com",
      customerPhone: booking.userNumber || "0000000000",
      status: "ready_for_pickup",
      carColor: booking.carColor || "Unknown Color",
      carPrice: booking.carPrice || 0,
      vendorName: booking.vendorName || "Unknown Vendor",
    }));

    const responseData = {
      cars: transformedCars,
      total: transformedCars.length,
    };

    res
      .status(200)
      .json(
        new ApiResponse(200, responseData, "Pickup cars retrieved successfully")
      );
  }
);

// Get cars coming for dropoff at PIC's parking lot
export const getDropoffCars = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const picParkingId = req.user.parkingid;

    if (!picParkingId) {
      throw new ApiResponse(400, null, "PIC must be assigned to a parking lot");
    }

    // Get cars in PIC's parking lot first
    const carsInParking = await db
      .select({ carId: carModel.id })
      .from(carModel)
      .where(eq(carModel.parkingid, picParkingId));

    const carIds = carsInParking.map(car => car.carId);

    // Create aliases for UserTable to avoid conflicts
    const vendorTable = alias(UserTable, 'vendor');
    const userTable = alias(UserTable, 'user');

    // Get all cars that are currently active (out for rental) and need to be returned
    const dropoffCars = await db
      .select({
        // Booking fields
        id: bookingsTable.id,
        carId: bookingsTable.carId,
        userId: bookingsTable.userId,
        status: bookingsTable.status,
        pickupDate: bookingsTable.pickupDate,
        startDate: bookingsTable.startDate,
        endDate: bookingsTable.endDate,
        actualPickupDate: bookingsTable.actualPickupDate,
        // Car fields
        carNumber: carModel.number,
        carColor: carModel.color,
        carPrice: carModel.price,
        // Car catalog fields
        carName: carCatalogTable.carName,
        carMaker: carCatalogTable.carMaker,
        // Vendor fields
        vendorName: vendorTable.name,
        // User fields
        userName: userTable.name,
        userEmail: userTable.email,
        userNumber: userTable.number,
      })
      .from(bookingsTable)
      .leftJoin(carModel, eq(bookingsTable.carId, carModel.id))
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
      .leftJoin(vendorTable, eq(carModel.vendorid, vendorTable.id))
      .leftJoin(userTable, eq(bookingsTable.userId, userTable.id))
      .where(
        and(
          inArray(bookingsTable.carId, carIds),
          eq(bookingsTable.status, "active") // Only active bookings (car is out)
        )
      )
      .orderBy(bookingsTable.endDate);

    // Transform the data to include required fields
    const transformedCars = dropoffCars.map((booking) => ({
      id: `car${booking.carId}`,
      bookingId: booking.id,
      carId: booking.carId,
      userId: booking.userId,
      licensePlate: booking.carNumber || "Unknown Plate",
      model: booking.carName || "Unknown Car",
      dropoffTime: booking.endDate,
      expectedDropoffTime: booking.endDate,
      customerName: booking.userName || "Unknown User",
      customerEmail: booking.userEmail || "unknown@example.com",
      customerPhone: booking.userNumber || "0000000000",
      status: "scheduled_for_dropoff",
      carColor: booking.carColor || "Unknown Color",
      carPrice: booking.carPrice || 0,
      vendorName: booking.vendorName || "Unknown Vendor",
      startDate: booking.startDate,
      actualPickupDate: booking.actualPickupDate,
    }));

    const responseData = {
      cars: transformedCars,
      total: transformedCars.length,
    };

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          "Dropoff cars retrieved successfully"
        )
      );
  }
);

// Get all cars under the PIC's parking lot
export const getAllCarsUnderPIC = asyncHandler<AuthenticatedRequest>(
  async (req: AuthenticatedRequest, res: Response) => {
    const picParkingId = req.user.parkingid;

    if (!picParkingId) {
      throw new ApiResponse(400, null, "PIC must be assigned to a parking lot");
    }

    // Get all cars in PIC's parking lot
    const cars = await db.query.carModel.findMany({
      where: (carModel, { eq }) => eq(carModel.parkingid, picParkingId),
      with: {
        catalog: true,
        vendor: {
          columns: {
            id: true,
            name: true,
            email: true,
            number: true,
          },
        },
      },
      orderBy: (carModel, { asc }) => [asc(carModel.name)],
    });

    // Transform the data to include required fields
    const transformedCars = cars.map((car) => ({
      id: car.id,
      name: car.name,
      number: car.number,
      price: car.price,
      discountPrice: car.discountprice,
      color: car.color,
      status: car.status,
      maker: car.catalog?.carMaker,
      year: car.catalog?.carModelYear,
      engineCapacity: car.catalog?.engineCapacity,
      mileage: car.catalog?.mileage,
      features: car.catalog?.features,
      transmission: car.catalog?.transmission,
      fuel: car.catalog?.fuelType,
      seats: car.catalog?.seats,
      vendorName: car.vendor?.name,
      vendorEmail: car.vendor?.email,
      vendorPhone: car.vendor?.number,
      createdAt: car.createdAt,
      updatedAt: car.updatedAt,
    }));

    const responseData = {
      cars: transformedCars,
      total: transformedCars.length,
      parkingId: picParkingId,
    };

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          "Cars under PIC parking lot retrieved successfully"
        )
      );
  }
);
