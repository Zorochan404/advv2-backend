import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../../drizzle/db";
import { parkingTable, parkingApprovalTable } from "./parkingmodel";
import { ApiError } from "../utils/apiError";
import { Request, Response } from "express";
import { and, eq, sql, like } from "drizzle-orm";
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
import { carCatalog } from "../../drizzle/migrations/schema";
import { carCatalogTable } from "../car/carmodel";

export const getParking = asyncHandler(async (req: Request, res: Response) => {
  const parking = await withDatabaseErrorHandling(async () => {
    return await db.select().from(parkingTable);
  }, "getParking");

  return sendList(res, parking, parking.length, "Parking fetched successfully");
});

export const getParkingByFilter = asyncHandler(
  async (req: Request, res: Response) => {
    const { state, pincode, name, city, locality, country } = req.query;

    const parking = await withDatabaseErrorHandling(async () => {
      // Build dynamic where conditions based on provided filters
      const conditions = [];

      if (state) {
        conditions.push(eq(parkingTable.state, state as string));
      }

      if (pincode) {
        conditions.push(eq(parkingTable.pincode, parseInt(pincode as string)));
      }

      if (name) {
        conditions.push(
          like(
            sql`lower(${parkingTable.name})`,
            `%${(name as string).toLowerCase()}%`
          )
        );
      }

      if (city) {
        conditions.push(
          like(
            sql`lower(${parkingTable.city})`,
            `%${(city as string).toLowerCase()}%`
          )
        );
      }

      if (locality) {
        conditions.push(
          like(
            sql`lower(${parkingTable.locality})`,
            `%${(locality as string).toLowerCase()}%`
          )
        );
      }

      if (country) {
        conditions.push(
          like(
            sql`lower(${parkingTable.country})`,
            `%${(country as string).toLowerCase()}%`
          )
        );
      }

      // If no filters provided, return all parking
      if (conditions.length === 0) {
        return await db.select().from(parkingTable);
      }

      // Apply filters using AND condition
      return await db
        .select()
        .from(parkingTable)
        .where(and(...conditions));
    }, "getParkingByFilter");

    if (parking.length === 0) {
      return sendList(
        res,
        [],
        0,
        "No parking found with the specified filters"
      );
    }

    return sendList(
      res,
      parking,
      parking.length,
      "Filtered parking fetched successfully"
    );
  }
);

export const getNearByParking = asyncHandler(
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

    // Parse and validate pagination parameters
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const result = await withDatabaseErrorHandling(async () => {
      // Get total count first for pagination
      const totalCountQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(parkingTable)
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

      const total = totalCountQuery[0]?.count || 0;

      // Get paginated results
      const parking = await db
        .select({
          id: parkingTable.id,
          name: parkingTable.name,
          locality: parkingTable.locality,
          city: parkingTable.city,
          state: parkingTable.state,
          country: parkingTable.country,
          pincode: parkingTable.pincode,
          capacity: parkingTable.capacity,
          mainimg: parkingTable.mainimg,
          images: parkingTable.images,
          lat: parkingTable.lat,
          lng: parkingTable.lng,
          distance: sql<number>`
                    (6371 * acos(
                        cos(radians(${lat})) * 
                        cos(radians(${parkingTable.lat})) * 
                        cos(radians(${parkingTable.lng}) - radians(${lng})) + 
                        sin(radians(${lat})) * 
                        sin(radians(${parkingTable.lat}))
                    )) as distance
                `,
          createdAt: parkingTable.createdAt,
          updatedAt: parkingTable.updatedAt,
        })
        .from(parkingTable)
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
        .orderBy(sql`distance`)
        .limit(limitNum)
        .offset(offset);

      return { parking, total };
    }, "getNearByParking");

    if (result.parking.length === 0) {
      return sendPaginated(
        res,
        [],
        result.total,
        pageNum,
        limitNum,
        "No parking found"
      );
    }

    return sendPaginated(
      res,
      result.parking,
      result.total,
      pageNum,
      limitNum,
      "Nearby parking fetched successfully"
    );
  }
);

export const getParkingById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    const result = await withDatabaseErrorHandling(async () => {
      // First get the parking details
      const parking = await db
        .select()
        .from(parkingTable)
        .where(eq(parkingTable.id, parseInt(id)));

      if (parking.length === 0) {
        throw ApiError.notFound("Parking not found");
      }

      // Import carModel for the query
      const { carModel } = await import("../car/carmodel");

      // Get all cars in this parking location
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
          transmission: carCatalogTable.transmission,
          fuel: carCatalogTable.fuelType,
          seats: carCatalogTable.seats,
          vendorid: carModel.vendorid,
          parkingid: carModel.parkingid,
          status: carModel.status,
          createdAt: carModel.createdAt,
          updatedAt: carModel.updatedAt,
        })
        .from(carModel)
        .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
        .where(eq(carModel.parkingid, parseInt(id)));

      

      // Combine parking details with cars
      return {
        parking: parking[0],
        cars: cars,
        totalCars: cars.length,
        availableCars: cars.filter((car) => car.status === "available").length,
      };
    }, "getParkingById");

    return sendItem(res, result, "Parking with cars fetched successfully");
  }
);

//admin

export const createParking = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "parkingincharge")
    ) {
      throw ApiError.forbidden("You are not authorized to add parking");
    }

    // Validate that req.body exists and has required fields
    if (!req.body || Object.keys(req.body).length === 0) {
      throw ApiError.badRequest("Request body is required");
    }

    const parking = await withDatabaseErrorHandling(async () => {
      const newParking = await db
        .insert(parkingTable)
        .values(req.body)
        .returning();

      return newParking[0];
    }, "createParking");

    return sendCreated(res, parking, "Parking added successfully");
  }
);

export const updateParking = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "parkingincharge")
    ) {
      throw ApiError.forbidden("You are not authorized to update parking");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    const parking = await withDatabaseErrorHandling(async () => {
      const updatedParking = await db
        .update(parkingTable)
        .set(req.body)
        .where(eq(parkingTable.id, parseInt(id)))
        .returning();

      if (!updatedParking || updatedParking.length === 0) {
        throw ApiError.notFound("Parking not found");
      }

      return updatedParking[0];
    }, "updateParking");

    return sendUpdated(res, parking, "Parking updated successfully");
  }
);

export const deleteParking = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "parkingincharge")
    ) {
      throw ApiError.forbidden("You are not authorized to delete parking");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    await withDatabaseErrorHandling(async () => {
      const deletedParking = await db
        .delete(parkingTable)
        .where(eq(parkingTable.id, parseInt(id)))
        .returning();

      if (!deletedParking || deletedParking.length === 0) {
        throw ApiError.notFound("Parking not found");
      }
    }, "deleteParking");

    return sendDeleted(res, "Parking deleted successfully");
  }
);

export const getParkingByIDadmin = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (
      !req.user ||
      (req.user.role !== "admin" && req.user.role !== "parkingincharge")
    ) {
      throw ApiError.forbidden("You are not authorized to fetch parking");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid parking ID");
    }

    const result = await withDatabaseErrorHandling(async () => {
      // Get parking details
      const parking = await db
        .select()
        .from(parkingTable)
        .where(eq(parkingTable.id, parseInt(id)));

      if (parking.length === 0) {
        throw ApiError.notFound("Parking not found");
      }

      // Import required models
      const { carModel } = await import("../car/carmodel");
      const { UserTable } = await import("../user/usermodel");

      // Get parking incharge (users with parkingincharge role assigned to this parking)
      const parkingIncharge = await db
        .select({
          id: UserTable.id,
          name: UserTable.name,
          email: UserTable.email,
          number: UserTable.number,
          role: UserTable.role,
          isverified: UserTable.isverified,
          avatar: UserTable.avatar,
          createdAt: UserTable.createdAt,
          updatedAt: UserTable.updatedAt,
        })
        .from(UserTable)
        .where(
          and(
            eq(UserTable.role, "parkingincharge"),
            eq(UserTable.parkingid, parseInt(id))
          )
        );

      // Get all cars in this parking location
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
        })
        .from(carModel)
        .where(eq(carModel.parkingid, parseInt(id)));

      // Combine all data
      return {
        parking: parking[0],
        parkingIncharge: parkingIncharge,
        cars: cars,
        totalCars: cars.length,
        availableCars: cars.filter((car) => car.status === "available").length,
        // approvedCars: cars.filter((car) => car.status === "approved").length,
        inMaintenanceCars: cars.filter((car) => car.status === "maintenance").length,
      };
    }, "getParkingByIDadmin");

    return sendItem(
      res,
      result,
      "Parking details with incharge and cars fetched successfully"
    );
  }
);


export const getparkingrequestbyid = asyncHandler(
  async (req: Request & { user?: { id?: number; role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admin can get parking requests");
    }

    if (!req.user.id) {
      throw ApiError.unauthorized("User ID not found");
    }
    const id = req.params.id;

    const result = await withDatabaseErrorHandling(async () => {
      const parking = await db
        .select()
        .from(parkingApprovalTable)
        .where(eq(parkingApprovalTable.id, parseInt(id)));

      if (parking.length === 0) {
        throw ApiError.notFound("Parking request not found");
      }

      return parking[0];
    }, "getparkingrequestbyid");

    return sendItem(res, result, "Parking request fetched successfully");
  }
);

// New methods for parking approval flow

// User submits parking approval request
export const submitParkingApproval = asyncHandler(
  async (req: Request & { user?: { id?: number; role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "user") {
      throw ApiError.forbidden("Only verified users can submit parking approval requests");
    }

    if (!req.user.id) {
      throw ApiError.unauthorized("User ID not found");
    }

    const parkingData = req.body;
    const userId = req.user.id;

    const result = await withDatabaseErrorHandling(async () => {
      // Check if user already has a pending or approved request
      const existingRequest = await db
        .select()
        .from(parkingApprovalTable)
        .where(
          and(
            eq(parkingApprovalTable.userId, userId),
            sql`${parkingApprovalTable.status} IN ('pending', 'approved')`
          )
        );

      if (existingRequest.length > 0) {
        throw ApiError.conflict("You already have a pending or approved parking request");
      }

      // Create parking approval request
      const newRequest = await db
        .insert(parkingApprovalTable)
        .values({
          userId: userId,
          parkingName: parkingData.parkingName,
          locality: parkingData.locality,
          city: parkingData.city,
          state: parkingData.state,
          country: parkingData.country,
          pincode: parkingData.pincode,
          capacity: parkingData.capacity,
          mainimg: parkingData.mainimg,
          images: parkingData.images,
          lat: parkingData.lat,
          lng: parkingData.lng,
          status: "pending",
        })
        .returning();

      return newRequest[0];
    }, "submitParkingApproval");

    return sendCreated(res, result, "Parking approval request submitted successfully");
  }
);

// Admin gets all parking approval requests
export const getParkingApprovalRequests = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can view parking approval requests");
    }

    const { status, userId } = req.query;

    const result = await withDatabaseErrorHandling(async () => {
      let conditions = [];

      if (status) {
        conditions.push(eq(parkingApprovalTable.status, status as string));
      }

      if (userId) {
        conditions.push(eq(parkingApprovalTable.userId, parseInt(userId as string)));
      }

      const requests = await db
        .select({
          id: parkingApprovalTable.id,
          userId: parkingApprovalTable.userId,
          parkingName: parkingApprovalTable.parkingName,
          locality: parkingApprovalTable.locality,
          city: parkingApprovalTable.city,
          state: parkingApprovalTable.state,
          country: parkingApprovalTable.country,
          pincode: parkingApprovalTable.pincode,
          capacity: parkingApprovalTable.capacity,
          mainimg: parkingApprovalTable.mainimg,
          images: parkingApprovalTable.images,
          lat: parkingApprovalTable.lat,
          lng: parkingApprovalTable.lng,
          status: parkingApprovalTable.status,
          adminComments: parkingApprovalTable.adminComments,
          approvedBy: parkingApprovalTable.approvedBy,
          approvedAt: parkingApprovalTable.approvedAt,
          createdAt: parkingApprovalTable.createdAt,
          updatedAt: parkingApprovalTable.updatedAt,
        })
        .from(parkingApprovalTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(parkingApprovalTable.createdAt);

      return requests;
    }, "getParkingApprovalRequests");

    return sendList(res, result, result.length, "Parking approval requests fetched successfully");
  }
);

// Admin approves/rejects parking request
export const updateParkingApprovalStatus = asyncHandler(
  async (req: Request & { user?: { role?: string; id?: number } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can update parking approval status");
    }

    if (!req.user.id) {
      throw ApiError.unauthorized("Admin ID not found");
    }

    const { id } = req.params;
    const { status, adminComments } = req.body;
    const adminId = req.user.id;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid approval request ID");
    }

    if (!["approved", "rejected"].includes(status)) {
      throw ApiError.badRequest("Status must be either 'approved' or 'rejected'");
    }

    const result = await withDatabaseErrorHandling(async () => {
      // Get the approval request
      const approvalRequest = await db
        .select()
        .from(parkingApprovalTable)
        .where(eq(parkingApprovalTable.id, parseInt(id)));

      if (approvalRequest.length === 0) {
        throw ApiError.notFound("Parking approval request not found");
      }

      const request = approvalRequest[0];

      if (request.status !== "pending") {
        throw ApiError.badRequest("Can only update pending requests");
      }

      // Update the approval status
      const updatedRequest = await db
        .update(parkingApprovalTable)
        .set({
          status: status,
          adminComments: adminComments,
          approvedBy: adminId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(parkingApprovalTable.id, parseInt(id)))
        .returning();

      // If approved, create the parking and update user role
      if (status === "approved") {
        // Import UserTable for the update
        const { UserTable } = await import("../user/usermodel");

        // Create the parking
        const newParking = await db
          .insert(parkingTable)
          .values({
            name: request.parkingName,
            locality: request.locality || null,
            city: request.city || null,
            state: request.state || null,
            country: request.country || null,
            pincode: request.pincode || null,
            capacity: request.capacity,
            mainimg: request.mainimg,
            images: request.images,
            lat: request.lat,
            lng: request.lng,
          })
          .returning();

        // Update user role to parkingincharge and assign parking ID
        await db
          .update(UserTable)
          .set({
            role: "parkingincharge",
            parkingid: newParking[0].id,
            updatedAt: new Date(),
          })
          .where(eq(UserTable.id, request.userId));

        return {
          approvalRequest: updatedRequest[0],
          parking: newParking[0],
          message: "Parking approved and user role updated successfully",
        };
      }

      return {
        approvalRequest: updatedRequest[0],
        message: "Parking request rejected",
      };
    }, "updateParkingApprovalStatus");

    return sendUpdated(res, result, "Parking approval status updated successfully");
  }
);

// User gets their parking approval requests
export const getUserParkingApprovalRequests = asyncHandler(
  async (req: Request & { user?: { id?: number; role?: string } }, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("User not authenticated");
    }

    if (!req.user.id) {
      throw ApiError.unauthorized("User ID not found");
    }

    const userId = req.user.id;

    const result = await withDatabaseErrorHandling(async () => {
      const requests = await db
        .select()
        .from(parkingApprovalTable)
        .where(eq(parkingApprovalTable.userId, userId))
        .orderBy(parkingApprovalTable.createdAt);

      return requests;
    }, "getUserParkingApprovalRequests");

    return sendList(res, result, result.length, "User parking approval requests fetched successfully");
  }
);
