import { Request, Response } from "express";
import { carModel, carCatalogTable } from "./carmodel";
import { db } from "../../drizzle/db";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { and, eq, like, or, sql, gte, lte, asc, desc, notInArray, inArray, lt, gt, isNotNull } from "drizzle-orm";
import { reviewModel } from "../review/reviewmodel";
import { parkingTable } from "../parking/parkingmodel";
import { bookingsTable } from "../booking/bookingmodel";
import {
  sendSuccess,
  sendItem,
  sendList,
  sendCreated,
  sendUpdated,
  sendDeleted,
  sendPaginated,
} from "../utils/responseHandler";
import { withDatabaseErrorHandling } from "../utils/dbErrorHandler";

// Test function to verify database connection
export const testCarConnection = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await withDatabaseErrorHandling(async () => {
      // Simple count query to test connection
      return await db.select({ count: sql<number>`count(*)` }).from(carModel);
    }, "testCarConnection");

    return sendSuccess(res, result[0], "Database connection successful");
  }
);

export const getCar = asyncHandler(async (req: Request, res: Response) => {
  const cars = await withDatabaseErrorHandling(async () => {
    return await db.select().from(carModel);
  }, "getCar");

  return sendList(res, cars, cars.length, "Cars fetched successfully");
});

export const getNearestCars = asyncHandler(
  async (req: Request, res: Response) => {
    // Support both GET (query params) and POST (body)
    const {
      lat,
      lng,
      radius = 500,
      limit = 10,
      page = 1,
    } = req.method === "GET" ? req.query : req.body;

    // Validate input coordinates
    if (!lat || !lng) {
      throw ApiError.badRequest("Latitude and longitude are required");
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw ApiError.badRequest("Invalid coordinates provided");
    }

    const result = await withDatabaseErrorHandling(async () => {
      // Get total count first
      const totalCountQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(carModel)
        .innerJoin(
          parkingTable,
          sql`${carModel.parkingid} = ${parkingTable.id}`
        )
        .where(
          sql`
                (6371 * acos(
                    cos(radians(${lat})) * 
                    cos(radians(${parkingTable.lat})) * 
                    cos(radians(${parkingTable.lng}) - radians(${lng})) + 
                    sin(radians(${lat})) * 
                    sin(radians(${parkingTable.lat}))
                )) <= ${radius}
            `
        );

      const totalCountResult = await totalCountQuery;
      const total = totalCountResult[0]?.count || 0;

      // Get paginated results
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const cars = await db
        .select({
          id: carModel.id,
          name: carModel.name,
          number: carModel.number,
          price: carModel.price,
          discountprice: carModel.discountprice,
          color: carModel.color,
          rcnumber: carModel.rcnumber,
          rcimg: carModel.rcimg,
          pollutionimg: carModel.pollutionimg,
          insuranceimg: carModel.insuranceimg,
          images: carModel.images,
          vendorid: carModel.vendorid,
          parkingid: carModel.parkingid,
          status: carModel.status,
          createdAt: carModel.createdAt,
          updatedAt: carModel.updatedAt,
          parkingDistance: sql<number>`
                    (6371 * acos(
                        cos(radians(${lat})) * 
                        cos(radians(${parkingTable.lat})) * 
                        cos(radians(${parkingTable.lng}) - radians(${lng})) + 
                        sin(radians(${lat})) * 
                        sin(radians(${parkingTable.lat}))
                    )) as parking_distance
                `,
          parkingName: parkingTable.name,
          parkingLocation: parkingTable.locality,
          parkingCity: parkingTable.city,
          parkingState: parkingTable.state,
        })
        .from(carModel)
        .innerJoin(
          parkingTable,
          sql`${carModel.parkingid} = ${parkingTable.id}`
        )
        .where(
          sql`
                (6371 * acos(
                    cos(radians(${lat})) * 
                    cos(radians(${parkingTable.lat})) * 
                    cos(radians(${parkingTable.lng}) - radians(${lng})) + 
                    sin(radians(${lat})) * 
                    sin(radians(${parkingTable.lat}))
                )) <= ${radius}
            `
        )
        .orderBy(sql`parking_distance`)
        .limit(parseInt(limit as string))
        .offset(offset);

      return { cars, total };
    }, "getNearestCars");

    return sendPaginated(
      res,
      result.cars,
      result.total,
      parseInt(page as string),
      parseInt(limit as string),
      "Nearest cars fetched successfully"
    );
  }
);

export const getNearestAvailableCars = asyncHandler(
  async (req: Request, res: Response) => {
    // Support both GET (query params) and POST (body)
    const {
      lat,
      lng,
      radius = 500,
      limit = 10,
      page = 1,
      startDate,
      endDate,
      startTime,
      endTime,
      categories,
      category,
      minPrice,
      maxPrice,
      transmission,
      fuelType,
      minSeats,
      maxSeats,
      search,
    } = req.method === "GET" ? req.query : req.body;

    // Validate input coordinates
    if (!lat || !lng) {
      throw ApiError.badRequest("Latitude and longitude are required");
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw ApiError.badRequest("Invalid coordinates provided");
    }

    const result = await withDatabaseErrorHandling(async () => {
      // Build dynamic conditions
      const conditions = [
        // Distance condition
        sql`
          (6371 * acos(
              cos(radians(${lat})) * 
              cos(radians(${parkingTable.lat})) * 
              cos(radians(${parkingTable.lng}) - radians(${lng})) + 
              sin(radians(${lat})) * 
              sin(radians(${parkingTable.lat}))
          )) <= ${radius}
        `,
        // Basic availability conditions
        eq(carModel.status, "available"),
      ];

      // Add date filtering (exclude cars with conflicting bookings)
      if (startDate && endDate) {
        // Helper to combine date and time
        const combineDateAndTime = (dateStr: string, timeStr?: string) => {
          const time = timeStr || "00:00:00";
          return new Date(`${dateStr}T${time}`);
        };

        const searchStart = combineDateAndTime(startDate as string, startTime as string);
        const searchEnd = combineDateAndTime(endDate as string, endTime as string);

        if (isNaN(searchStart.getTime()) || isNaN(searchEnd.getTime())) {
          throw ApiError.badRequest("Invalid date format");
        }

        const activeBookingCarIds = await db
          .select({ carId: bookingsTable.carId })
          .from(bookingsTable)
          .where(
            and(
              sql`${bookingsTable.status} IN ('pending', 'advance_paid', 'confirmed', 'active')`,
              or(
                // Booking starts before our end date and ends after our start date
                // Note: Drizzle/Postgres handles Date objects correctly in comparisons
                and(
                  lt(bookingsTable.startDate, searchEnd),
                  gt(bookingsTable.endDate, searchStart)
                ),
                // Booking has extension that conflicts
                and(
                  isNotNull(bookingsTable.extensionTill),
                  gt(bookingsTable.extensionTill, searchStart)
                )
              )
            )
          );

        if (activeBookingCarIds.length > 0) {
          const bookedCarIds = activeBookingCarIds.map(b => b.carId);
          conditions.push(notInArray(carModel.id, bookedCarIds));
        }
      }

      // Add category filtering
      if (category) {
        conditions.push(eq(carCatalogTable.category, category));
      } else if (categories) {
        if (Array.isArray(categories)) {
          // Handle array from JSON body - use inArray from drizzle-orm
          conditions.push(inArray(carCatalogTable.category, categories as string[]));
        } else {
          // Handle comma-separated string from query params
          const categoryList = (categories as string).split(',').map((c: string) => c.trim());
          conditions.push(inArray(carCatalogTable.category, categoryList));
        }
      }

      // Add price filtering
      if (minPrice) {
        conditions.push(gte(carModel.discountprice || carModel.price, minPrice));
      }
      if (maxPrice) {
        conditions.push(lte(carModel.discountprice || carModel.price, maxPrice));
      }

      // Add transmission filtering
      if (transmission) {
        conditions.push(eq(carCatalogTable.transmission, transmission));
      }

      // Add fuel type filtering
      if (fuelType) {
        conditions.push(eq(carCatalogTable.fuelType, fuelType));
      }

      // Add seats filtering
      if (minSeats) {
        conditions.push(gte(carCatalogTable.seats, minSeats));
      }
      if (maxSeats) {
        conditions.push(lte(carCatalogTable.seats, maxSeats));
      }

      // Add search filtering
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(
          sql`(
            ${carModel.name} ILIKE ${searchTerm} OR 
            ${carModel.number} ILIKE ${searchTerm} OR 
            ${carCatalogTable.carName} ILIKE ${searchTerm} OR 
            ${carCatalogTable.carMaker} ILIKE ${searchTerm}
          )`
        );
      }

      // Get total count first
      const totalCountQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(carModel)
        .innerJoin(
          parkingTable,
          sql`${carModel.parkingid} = ${parkingTable.id}`
        )
        .leftJoin(
          carCatalogTable,
          eq(carModel.catalogId, carCatalogTable.id)
        )
        .where(and(...conditions));

      const totalCountResult = await totalCountQuery;
      const total = totalCountResult[0]?.count || 0;

      // Get paginated results
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const cars = await db
        .select({
          id: carModel.id,
          name: carModel.name,
          number: carModel.number,
          price: carModel.price,
          discountprice: carModel.discountprice,
          color: carModel.color,
          rcnumber: carModel.rcnumber,
          rcimg: carModel.rcimg,
          pollutionimg: carModel.pollutionimg,
          insuranceimg: carModel.insuranceimg,
          images: carModel.images,
          vendorid: carModel.vendorid,
          parkingid: carModel.parkingid,
          status: carModel.status,
          createdAt: carModel.createdAt,
          updatedAt: carModel.updatedAt,
          parkingDistance: sql<number>`
                    (6371 * acos(
                        cos(radians(${lat})) * 
                        cos(radians(${parkingTable.lat})) * 
                        cos(radians(${parkingTable.lng}) - radians(${lng})) + 
                        sin(radians(${lat})) * 
                        sin(radians(${parkingTable.lat}))
                    )) as parking_distance
                `,
          parkingName: parkingTable.name,
          parkingLocation: parkingTable.locality,
          parkingCity: parkingTable.city,
          parkingState: parkingTable.state,
          // Add catalog information
          maker: carCatalogTable.carMaker,
          year: carCatalogTable.carModelYear,
          engineCapacity: carCatalogTable.engineCapacity,
          mileage: carCatalogTable.mileage,
          features: carCatalogTable.features,
          transmission: carCatalogTable.transmission,
          fuel: carCatalogTable.fuelType,
          seats: carCatalogTable.seats,
          category: carCatalogTable.category,
        })
        .from(carModel)
        .innerJoin(
          parkingTable,
          sql`${carModel.parkingid} = ${parkingTable.id}`
        )
        .leftJoin(
          carCatalogTable,
          eq(carModel.catalogId, carCatalogTable.id)
        )
        .where(and(...conditions))
        .orderBy(sql`parking_distance`)
        .limit(parseInt(limit as string))
        .offset(offset);

      return { cars, total };
    }, "getNearestAvailableCars");

    return sendPaginated(
      res,
      result.cars,
      result.total,
      parseInt(page as string),
      parseInt(limit as string),
      "Nearest available cars fetched successfully"
    );
  }
);

export const getavailablecars = asyncHandler(async (req: Request, res: Response) => {
  const cars = await withDatabaseErrorHandling(async () => {
    return await db.select().from(carModel).where(eq(carModel.status, "available"));
  }, "getavailablecars");

  return sendList(res, cars, cars.length, "Cars fetched successfully");
});

export const getNearestPopularCars = asyncHandler(
  async (req: Request, res: Response) => {
    // Support both GET (query params) and POST (body)
    const {
      lat,
      lng,
      radius = 500,
      limit = 3,
      page = 1,
    } = req.method === "GET" ? req.query : req.body;

    // Validate input coordinates
    if (!lat || !lng) {
      throw ApiError.badRequest("Latitude and longitude are required");
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw ApiError.badRequest("Invalid coordinates provided");
    }

    const limitNum = Math.min(parseInt(limit as string) || 3, 50);
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const result = await withDatabaseErrorHandling(async () => {
      // Get total count for pagination
      const totalCount = await db
        .select({ count: sql<number>`count(distinct ${carModel.id})` })
        .from(carModel)
        .innerJoin(
          parkingTable,
          sql`${carModel.parkingid} = ${parkingTable.id}`
        )
        .leftJoin(reviewModel, eq(carModel.id, reviewModel.carid))
        .where(
          and(
            sql`
                (6371 * acos(
                    cos(radians(${lat})) * 
                    cos(radians(${parkingTable.lat})) * 
                    cos(radians(${parkingTable.lng}) - radians(${lng})) + 
                    sin(radians(${lat})) * 
                    sin(radians(${parkingTable.lat}))
                )) <= ${radius}
            `,
            eq(carModel.status, "available")
          )
        );

      const total = totalCount[0]?.count || 0;

      // Get popular cars with catalog data - ordered by review count and average rating
      const cars = await db
        .select({
          id: carModel.id,
          name: carModel.name,
          number: carModel.number,
          price: carModel.price,
          discountprice: carModel.discountprice,
          color: carModel.color,
          rcnumber: carModel.rcnumber,
          rcimg: carModel.rcimg,
          pollutionimg: carModel.pollutionimg,
          insuranceimg: carModel.insuranceimg,
          images: carModel.images,
          vendorid: carModel.vendorid,
          parkingid: carModel.parkingid,
          status: carModel.status,
          createdAt: carModel.createdAt,
          updatedAt: carModel.updatedAt,
          parkingDistance: sql<number>`
                    (6371 * acos(
                        cos(radians(${lat})) * 
                        cos(radians(${parkingTable.lat})) * 
                        cos(radians(${parkingTable.lng}) - radians(${lng})) + 
                        sin(radians(${lat})) * 
                        sin(radians(${parkingTable.lat}))
                    )) as parking_distance
                `,
          parkingName: parkingTable.name,
          parkingLocation: parkingTable.locality,
          parkingCity: parkingTable.city,
          parkingState: parkingTable.state,
          // Catalog data
          maker: carCatalogTable.carMaker,
          year: carCatalogTable.carModelYear,
          engineCapacity: carCatalogTable.engineCapacity,
          mileage: carCatalogTable.mileage,
          features: carCatalogTable.features,
          transmission: carCatalogTable.transmission,
          fuel: carCatalogTable.fuelType,
          seats: carCatalogTable.seats,
          // Popularity metrics
          reviewCount: sql<number>`count(${reviewModel.id})`,
          averageRating: sql<number>`avg(${reviewModel.rating})`,
        })
        .from(carModel)
        .innerJoin(
          parkingTable,
          sql`${carModel.parkingid} = ${parkingTable.id}`
        )
        .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
        .leftJoin(reviewModel, eq(carModel.id, reviewModel.carid))
        .where(
          and(
            sql`
                (6371 * acos(
                    cos(radians(${lat})) * 
                    cos(radians(${parkingTable.lat})) * 
                    cos(radians(${parkingTable.lng}) - radians(${lng})) + 
                    sin(radians(${lat})) * 
                    sin(radians(${parkingTable.lat}))
                )) <= ${radius}
            `,
            eq(carModel.status, "available")
          )
        )
        .groupBy(
          carModel.id,
          carModel.name,
          carModel.number,
          carModel.price,
          carModel.discountprice,
          carModel.color,
          carModel.rcnumber,
          carModel.rcimg,
          carModel.pollutionimg,
          carModel.insuranceimg,
          carModel.images,
          carModel.vendorid,
          carModel.parkingid,
          carModel.status,
          carModel.createdAt,
          carModel.updatedAt,
          parkingTable.name,
          parkingTable.locality,
          parkingTable.city,
          parkingTable.state,
          parkingTable.lat,
          parkingTable.lng,
          carCatalogTable.carMaker,
          carCatalogTable.carModelYear,
          carCatalogTable.engineCapacity,
          carCatalogTable.mileage,
          carCatalogTable.features,
          carCatalogTable.transmission,
          carCatalogTable.fuelType,
          carCatalogTable.seats
        )
        .orderBy(
          desc(sql`count(${reviewModel.id})`),
          desc(sql`avg(${reviewModel.rating})`),
          sql`parking_distance`
        )
        .limit(limitNum)
        .offset(offset);

      return { cars, total };
    }, "getNearestPopularCars");

    return sendPaginated(
      res,
      result.cars,
      result.total,
      pageNum,
      limitNum,
      "Nearest popular cars fetched successfully"
    );
  }
);

export const getCarByParkingId = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { limit = 10, page = 1 } = req.query;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const result = await withDatabaseErrorHandling(async () => {
      // Get total count for pagination
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(carModel)
        .where(eq(carModel.parkingid, parseInt(id)));

      const total = totalCount[0]?.count || 0;

      // Get cars with catalog data
      const cars = await db
        .select({
          id: carModel.id,
          name: carModel.name,
          number: carModel.number,
          price: carModel.price,
          discountprice: carModel.discountprice,
          color: carModel.color,
          rcnumber: carModel.rcnumber,
          rcimg: carModel.rcimg,
          pollutionimg: carModel.pollutionimg,
          insuranceimg: carModel.insuranceimg,
          images: carModel.images,
          vendorid: carModel.vendorid,
          parkingid: carModel.parkingid,
          status: carModel.status,
          createdAt: carModel.createdAt,
          updatedAt: carModel.updatedAt,
          // Catalog data
          maker: carCatalogTable.carMaker,
          year: carCatalogTable.carModelYear,
          engineCapacity: carCatalogTable.engineCapacity,
          mileage: carCatalogTable.mileage,
          features: carCatalogTable.features,
          transmission: carCatalogTable.transmission,
          fuel: carCatalogTable.fuelType,
          seats: carCatalogTable.seats,
        })
        .from(carModel)
        .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
        .where(eq(carModel.parkingid, parseInt(id)))
        .limit(limitNum)
        .offset(offset);

      return { cars, total };
    }, "getCarByParkingId");

    return sendPaginated(
      res,
      result.cars,
      result.total,
      pageNum,
      limitNum,
      "Cars by parking ID fetched successfully"
    );
  }
);


export const getCarByParkingIdbyuser = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { limit = 10, page = 1 } = req.query;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const result = await withDatabaseErrorHandling(async () => {
      // Get total count for pagination
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(carModel)
        .where(and(eq(carModel.parkingid, parseInt(id)), eq(carModel.status, "available")));

      const total = totalCount[0]?.count || 0;

      // Get cars with catalog data
      const cars = await db
        .select({
          id: carModel.id,
          name: carModel.name,
          number: carModel.number,
          price: carModel.price,
          discountprice: carModel.discountprice,
          color: carModel.color,
          rcnumber: carModel.rcnumber,
          rcimg: carModel.rcimg,
          pollutionimg: carModel.pollutionimg,
          insuranceimg: carModel.insuranceimg,
          images: carModel.images,
          vendorid: carModel.vendorid,
          parkingid: carModel.parkingid,
          status: carModel.status,
          createdAt: carModel.createdAt,
          updatedAt: carModel.updatedAt,
          // Catalog data
          maker: carCatalogTable.carMaker,
          year: carCatalogTable.carModelYear,
          engineCapacity: carCatalogTable.engineCapacity,
          mileage: carCatalogTable.mileage,
          features: carCatalogTable.features,
          transmission: carCatalogTable.transmission,
          fuel: carCatalogTable.fuelType,
          seats: carCatalogTable.seats,
        })
        .from(carModel)
        .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
        .where(eq(carModel.parkingid, parseInt(id)))
        .limit(limitNum)
        .offset(offset);

      return { cars, total };
    }, "getCarByParkingId");

    return sendPaginated(
      res,
      result.cars,
      result.total,
      pageNum,
      limitNum,
      "Cars by parking ID fetched successfully"
    );
  }
);
export const searchbynameornumber = asyncHandler(
  async (req: Request, res: Response) => {
    // Support both GET (query params) and POST (body)
    const search = req.query.search || req.body?.search;

    if (!search) {
      throw ApiError.badRequest("Search term is required");
    }

    const cars = await withDatabaseErrorHandling(async () => {
      return await db
        .select({
          id: carModel.id,
          name: carModel.name,
          number: carModel.number,
          price: carModel.price,
          discountprice: carModel.discountprice,
          color: carModel.color,
          rcnumber: carModel.rcnumber,
          rcimg: carModel.rcimg,
          pollutionimg: carModel.pollutionimg,
          insuranceimg: carModel.insuranceimg,
          images: carModel.images,
          vendorid: carModel.vendorid,
          parkingid: carModel.parkingid,
          status: carModel.status,
          createdAt: carModel.createdAt,
          updatedAt: carModel.updatedAt,
          // Catalog data
          maker: carCatalogTable.carMaker,
          year: carCatalogTable.carModelYear,
          engineCapacity: carCatalogTable.engineCapacity,
          mileage: carCatalogTable.mileage,
          features: carCatalogTable.features,
          transmission: carCatalogTable.transmission,
          fuel: carCatalogTable.fuelType,
          seats: carCatalogTable.seats,
        })
        .from(carModel)
        .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
        .where(
          or(
            like(carModel.name, `%${search}%`),
            like(carModel.number, `%${search}%`)
          )
        );
    }, "searchbynameornumber");

    return sendList(res, cars, cars.length, "Cars found successfully");
  }
);

export const getCarById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !/^[0-9]+$/.test(id)) {
    throw ApiError.badRequest("Invalid car ID");
  }

  const car = await withDatabaseErrorHandling(async () => {
    // Get car with catalog data
    const carData = await db
      .select({
        id: carModel.id,
        name: carModel.name,
        number: carModel.number,
        price: carModel.price,
        discountprice: carModel.discountprice,
        color: carModel.color,
        rcnumber: carModel.rcnumber,
        rcimg: carModel.rcimg,
        pollutionimg: carModel.pollutionimg,
        insuranceimg: carModel.insuranceimg,
        images: carModel.images,
        vendorid: carModel.vendorid,
        parkingid: carModel.parkingid,
        status: carModel.status,
        createdAt: carModel.createdAt,
        updatedAt: carModel.updatedAt,
        category: carCatalogTable.category,
        insuranceamount: carModel.insuranceAmount,
        fineperhour: carModel.fineperhour,
        extensionperhour: carModel.extensionperhour,
        // Catalog data
        maker: carCatalogTable.carMaker,
        year: carCatalogTable.carModelYear,
        engineCapacity: carCatalogTable.engineCapacity,
        mileage: carCatalogTable.mileage,
        features: carCatalogTable.features,
        transmission: carCatalogTable.transmission,
        fuel: carCatalogTable.fuelType,
        seats: carCatalogTable.seats,
      })
      .from(carModel)
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
      .where(eq(carModel.id, parseInt(id)))
      .limit(1);

    if (!carData || carData.length === 0) {
      throw ApiError.notFound("Car not found");
    }

    const car = carData[0];

    // Get parking details
    const parking = await db
      .select()
      .from(parkingTable)
      .where(eq(parkingTable.id, car.parkingid))
      .limit(1);

    // Get reviews for this car
    const reviews = await db
      .select()
      .from(reviewModel)
      .where(eq(reviewModel.carid, parseInt(id)));

    // Calculate average rating
    const validRatings = reviews
      .map((review) => review.rating)
      .filter(
        (rating): rating is number => rating !== null && rating !== undefined
      );
    const avgRating =
      validRatings.length > 0
        ? validRatings.reduce((acc, rating) => acc + rating, 0) /
        validRatings.length
        : 0;

    // Get user details for reviews
    const reviewsWithUsers = await db.query.reviewModel.findMany({
      where: eq(reviewModel.carid, parseInt(id)),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            avatar: true,
            email: true,
            number: true,
            role: true,
            isverified: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      car,
      reviews,
      parking,
      avgRating,
      reviewsWithUsers,
    };
  }, "getCarById");

  return sendItem(res, car, "Car fetched successfully");
});

export const createCar = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    console.log(`🚗 [CREATE_CAR] Starting car creation...`);
    console.log(
      `🚗 [CREATE_CAR] Request ID: ${req.headers["x-request-id"] || "none"}`
    );
    console.log(
      `🚗 [CREATE_CAR] User: ${req.user?.id}, Role: ${req.user?.role}`
    );

    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "parkingincharge")
    ) {
      throw ApiError.forbidden("You are not authorized to create cars");
    }

    // Check if headers have already been sent (prevent double response)
    if (res.headersSent) {
      console.log(`🚗 [CREATE_CAR] Headers already sent, skipping...`);
      return;
    }

    // Add request deduplication check
    const requestId = `${req.user.id || "unknown"}-${req.body.number
      }-${Date.now()}`;

    console.log(`🚗 [CREATE_CAR] Creating car with request ID: ${requestId}`);

    const car = await withDatabaseErrorHandling(async () => {
      console.log(`🚗 [CREATE_CAR] Database operation starting...`);

      // Check if car with same number already exists
      const existingCar = await db
        .select()
        .from(carModel)
        .where(eq(carModel.number, req.body.number))
        .limit(1);

      if (existingCar.length > 0) {
        throw ApiError.conflict(
          `Car with number ${req.body.number} already exists`
        );
      }

      // Create a copy of the request body to modify
      const carData = { ...req.body };

      // If catalogId is provided, fetch price and discountprice from catalog
      if (carData.catalogId) {
        console.log(`🚗 [CREATE_CAR] Fetching price from catalog ID: ${carData.catalogId}`);

        const catalogEntry = await db
          .select({
            platformPrice: carCatalogTable.carPlatformPrice,
          })
          .from(carCatalogTable)
          .where(eq(carCatalogTable.id, carData.catalogId))
          .limit(1);

        if (catalogEntry.length > 0) {
          // Use platform price as the regular price
          carData.price = Number(catalogEntry[0].platformPrice);

          carData.discountprice = Number(catalogEntry[0].platformPrice);

          console.log(`🚗 [CREATE_CAR] Inferred price: ${carData.price}, discount price: ${carData.discountprice}`);
        } else {
          console.log(`🚗 [CREATE_CAR] Warning: Catalog ID ${carData.catalogId} not found`);
        }
      }

      const newCar = await db.insert(carModel).values(carData).returning();
      console.log(
        `🚗 [CREATE_CAR] Database operation completed. Car ID: ${newCar[0]?.id}`
      );
      return newCar[0];
    }, "createCar");

    console.log(`🚗 [CREATE_CAR] Sending response...`);
    return sendCreated(res, car, "Car created successfully");
  }
);

export const updateCar = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    const requestId = `${req.user?.id || "unknown"}-${req.params.id
      }-${Date.now()}`;
    console.log(
      `🚗 [UPDATE_CAR] Starting update for car ${req.params.id}, Request ID: ${requestId}`
    );

    // Check if headers have already been sent (prevent double response)
    if (res.headersSent) {
      console.log(
        `🚗 [UPDATE_CAR] Headers already sent, skipping... Request ID: ${requestId}`
      );
      return;
    }

    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "vendor")
    ) {
      throw ApiError.forbidden("You are not authorized to update cars");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid car ID");
    }

    // Check if request body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      throw ApiError.badRequest("Update data is required");
    }

    console.log(`🚗 [UPDATE_CAR] Processing update data:`, req.body);

    try {
      // First check if car exists
      const existingCar = await db
        .select()
        .from(carModel)
        .where(eq(carModel.id, parseInt(id)))
        .limit(1);

      if (!existingCar || existingCar.length === 0) {
        throw ApiError.notFound("Car not found");
      }

      // Separate car fields from catalog fields
      const carFields = [
        "name",
        "number",
        "vendorid",
        "parkingid",
        "color",
        "price",
        "discountprice",
        "isavailable",
        "rcnumber",
        "rcimg",
        "pollutionimg",
        "insuranceimg",
        "images",
        "catalogId",
        "status",
        "insuranceAmount",
      ];

      const catalogFields = [
        "transmission",
        "fuel",
        "seats",
        "maker",
        "year",
        "engineCapacity",
        "mileage",
        "features",
        "category",
      ];

      const carUpdateData = Object.keys(req.body)
        .filter((key) => carFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = req.body[key];
          return obj;
        }, {} as any);

      const catalogUpdateData = Object.keys(req.body)
        .filter((key) => catalogFields.includes(key))
        .reduce((obj, key) => {
          // Map frontend field names to catalog field names
          const fieldMapping: { [key: string]: string } = {
            transmission: "transmission",
            fuel: "fuelType",
            seats: "seats",
            maker: "carMaker",
            year: "carModelYear",
            engineCapacity: "engineCapacity",
            mileage: "mileage",
            features: "features",
            category: "category",
          };
          obj[fieldMapping[key]] = req.body[key];
          return obj;
        }, {} as any);

      // If updating car number, check for duplicates
      if (
        carUpdateData.number &&
        carUpdateData.number !== existingCar[0].number
      ) {
        const duplicateCar = await db
          .select()
          .from(carModel)
          .where(eq(carModel.number, carUpdateData.number))
          .limit(1);

        if (duplicateCar.length > 0) {
          throw ApiError.conflict(
            `Car with number ${carUpdateData.number} already exists`
          );
        }
      }

      // Update car fields if any
      let updatedCar = existingCar[0];
      if (Object.keys(carUpdateData).length > 0) {
        const carResult = await db
          .update(carModel)
          .set(carUpdateData)
          .where(eq(carModel.id, parseInt(id)))
          .returning();

        if (!carResult || carResult.length === 0) {
          throw ApiError.notFound("Car not found");
        }
        updatedCar = carResult[0];
      }

      // Update catalog fields if any
      if (Object.keys(catalogUpdateData).length > 0) {
        if (!updatedCar.catalogId) {
          throw ApiError.badRequest(
            "Cannot update catalog fields: car has no catalog association"
          );
        }

        await db
          .update(carCatalogTable)
          .set(catalogUpdateData)
          .where(eq(carCatalogTable.id, updatedCar.catalogId));
      }

      console.log(
        `🚗 [UPDATE_CAR] Sending response for Request ID: ${requestId}`
      );
      return sendUpdated(res, updatedCar, "Car updated successfully");
    } catch (error: any) {
      console.error(`🚗 [UPDATE_CAR] Database error:`, error);

      // Handle specific database errors
      if (error.code === "23505") {
        throw ApiError.conflict("Duplicate field value");
      }
      if (error.code === "23503") {
        throw ApiError.badRequest("Referenced record not found");
      }
      if (error.code === "22P02") {
        throw ApiError.badRequest("Invalid ID format");
      }

      // If it's already an ApiError, re-throw it
      if (error instanceof ApiError) {
        throw error;
      }

      // For other database errors, throw generic error
      throw ApiError.internal("Database operation failed");
    }
  }
);

export const deleteCar = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "vendor")
    ) {
      throw ApiError.forbidden("You are not authorized to delete cars");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid car ID");
    }

    await withDatabaseErrorHandling(async () => {
      const deletedCar = await db
        .delete(carModel)
        .where(eq(carModel.id, parseInt(id)))
        .returning();

      if (!deletedCar || deletedCar.length === 0) {
        throw ApiError.notFound("Car not found");
      }
    }, "deleteCar");

    return sendDeleted(res, "Car deleted successfully");
  }
);

export const filterCars = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query;

  const result = await withDatabaseErrorHandling(async () => {
    // Build where conditions dynamically
    const conditions = [];

    // Basic car fields
    if (filters.name) {
      conditions.push(like(carModel.name, `%${filters.name}%`));
    }
    if (filters.number) {
      conditions.push(like(carModel.number, `%${filters.number}%`));
    }
    if (filters.color) {
      conditions.push(like(carModel.color, `%${filters.color}%`));
    }
    if (filters.status) {
      conditions.push(eq(carModel.status, filters.status as any));
    }
    if (filters.price_min) {
      conditions.push(
        gte(carModel.price, parseInt(filters.price_min as string))
      );
    }
    if (filters.price_max) {
      conditions.push(
        lte(carModel.price, parseInt(filters.price_max as string))
      );
    }
    if (filters.discountprice_min) {
      conditions.push(
        gte(
          carModel.discountprice,
          parseInt(filters.discountprice_min as string)
        )
      );
    }
    if (filters.discountprice_max) {
      conditions.push(
        lte(
          carModel.discountprice,
          parseInt(filters.discountprice_max as string)
        )
      );
    }
    if (filters.parkingid) {
      conditions.push(
        eq(carModel.parkingid, parseInt(filters.parkingid as string))
      );
    }
    if (filters.vendorid) {
      conditions.push(
        eq(carModel.vendorid, parseInt(filters.vendorid as string))
      );
    }

    // Catalog fields
    if (filters.maker) {
      conditions.push(like(carCatalogTable.carMaker, `%${filters.maker}%`));
    }
    if (filters.year) {
      conditions.push(
        eq(carCatalogTable.carModelYear, parseInt(filters.year as string))
      );
    }
    if (filters.transmission) {
      conditions.push(
        eq(carCatalogTable.transmission, filters.transmission as any)
      );
    }
    if (filters.fuel) {
      conditions.push(eq(carCatalogTable.fuelType, filters.fuel as any));
    }
    if (filters.seats) {
      conditions.push(
        eq(carCatalogTable.seats, parseInt(filters.seats as string))
      );
    }
    if (filters.category) {
      conditions.push(eq(carCatalogTable.category, filters.category as any));
    }

    // Enhanced availability check: Exclude cars with active bookings
    // This provides an extra safety layer in case car status wasn't updated properly
    const activeBookingCarIds = await db
      .select({ carId: bookingsTable.carId })
      .from(bookingsTable)
      .where(
        sql`${bookingsTable.status} IN ('pending', 'advance_paid', 'confirmed', 'active')`
      );

    if (activeBookingCarIds.length > 0) {
      const bookedCarIds = activeBookingCarIds.map(b => b.carId);
      conditions.push(
        notInArray(carModel.id, bookedCarIds)
      );
    }

    // Get total count first
    const totalCountQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(carModel)
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id));

    const totalCountResult =
      conditions.length > 0
        ? await totalCountQuery.where(and(...conditions))
        : await totalCountQuery;

    const total = totalCountResult[0]?.count || 0;

    // Get paginated results
    const limit = parseInt(filters.limit as string) || 10;
    const page = parseInt(filters.page as string) || 1;
    const offset = (page - 1) * limit; // Fixed offset calculation

    const carsQuery = db
      .select({
        id: carModel.id,
        name: carModel.name,
        number: carModel.number,
        price: carModel.price,
        discountprice: carModel.discountprice,
        color: carModel.color,
        rcnumber: carModel.rcnumber,
        rcimg: carModel.rcimg,
        pollutionimg: carModel.pollutionimg,
        insuranceimg: carModel.insuranceimg,
        images: carModel.images,
        vendorid: carModel.vendorid,
        parkingid: carModel.parkingid,
        status: carModel.status,
        createdAt: carModel.createdAt,
        updatedAt: carModel.updatedAt,
        // Catalog data
        maker: carCatalogTable.carMaker,
        year: carCatalogTable.carModelYear,
        engineCapacity: carCatalogTable.engineCapacity,
        mileage: carCatalogTable.mileage,
        features: carCatalogTable.features,
        transmission: carCatalogTable.transmission,
        fuel: carCatalogTable.fuelType,
        seats: carCatalogTable.seats,
        category: carCatalogTable.category,
      })
      .from(carModel)
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
      .orderBy(desc(carModel.createdAt))
      .limit(limit)
      .offset(offset);

    const cars =
      conditions.length > 0
        ? await carsQuery.where(and(...conditions))
        : await carsQuery;

    return { cars, total };
  }, "filterCars");

  const limit = parseInt(filters.limit as string) || 10;
  const page = parseInt(filters.page as string) || 1;

  return sendPaginated(
    res,
    result.cars,
    result.total,
    page,
    limit,
    "Cars filtered successfully"
  );
});
