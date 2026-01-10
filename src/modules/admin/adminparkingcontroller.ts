import { Request, Response } from "express";
import { db } from "../../drizzle/db";
import { parkingTable } from "../parking/parkingmodel";
import { carModel } from "../car/carmodel";
import { UserTable } from "../user/usermodel";
import { bookingsTable } from "../booking/bookingmodel";
import { eq, and, or, like, gte, lte, sql, desc, count, sum } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiResponse";

// ========================================
// PARKING STATISTICS
// ========================================

// Get parking statistics for dashboard
export const getParkingStats = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get total parking spots
    const totalSpotsResult = await db
      .select({ count: count() })
      .from(parkingTable);

    const totalSpots = totalSpotsResult[0]?.count || 0;

    // Get total capacity across all parking spots
    const totalCapacityResult = await db
      .select({ totalCapacity: sum(parkingTable.capacity) })
      .from(parkingTable);

    const totalCapacity = Number(totalCapacityResult[0]?.totalCapacity) || 0;

    // Get total cars in all parking spots
    const totalCarsResult = await db
      .select({ count: count() })
      .from(carModel)
      .where(eq(carModel.parkingid, sql`${carModel.parkingid}`));

    const totalCars = totalCarsResult[0]?.count || 0;

    // Get available cars (not in maintenance and available)
    const availableCarsResult = await db
      .select({ count: count() })
      .from(carModel)
      .where(and(
        eq(carModel.status, 'available'),
      ));

    const availableCars = availableCarsResult[0]?.count || 0;

    // Get booked cars
    const bookedCarsResult = await db
      .select({ count: count() })
      .from(carModel)
      .where(eq(carModel.status, "available"));

    const bookedCars = bookedCarsResult[0]?.count || 0;

    // Get maintenance cars
    const maintenanceCarsResult = await db
      .select({ count: count() })
      .from(carModel)
      .where(eq(carModel.status, "maintenance"));

    const maintenanceCars = maintenanceCarsResult[0]?.count || 0;

    // Calculate utilization rate
    const utilizationRate = totalCapacity > 0 ? (totalCars / totalCapacity) * 100 : 0;

    // Get spots with managers (PIC role)
    const spotsWithManagersResult = await db
      .select({ count: count() })
      .from(parkingTable)
      .innerJoin(UserTable, eq(parkingTable.id, UserTable.parkingid))
      .where(eq(UserTable.role, 'parkingincharge'));

    const spotsWithManagers = spotsWithManagersResult[0]?.count || 0;
    const spotsWithoutManagers = totalSpots - spotsWithManagers;

    return res.status(200).json(
      new ApiResponse(200, {
        totalSpots,
        totalCapacity,
        totalCars,
        availableCars,
        bookedCars,
        maintenanceCars,
        utilizationRate: Math.round(utilizationRate * 100) / 100, // Round to 2 decimal places
        spotsWithManagers,
        spotsWithoutManagers,
      }, 'Parking statistics retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching parking statistics:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch parking statistics')
    );
  }
});

// ========================================
// PARKING SEARCH
// ========================================

// Search and filter parking spots
export const searchParkingSpots = asyncHandler(async (req: Request, res: Response) => {
  const { 
    search, 
    city, 
    capacity, 
    hasManager, 
    page = 1, 
    limit = 10 
  } = req.query as {
    search?: string;
    city?: string;
    capacity?: string;
    hasManager?: string;
    page?: number;
    limit?: number;
  };

  try {
    const offset = (Number(page) - 1) * Number(limit);
    const whereConditions = [];

    // Add search condition
    if (search) {
      whereConditions.push(
        or(
          like(parkingTable.name, `%${search}%`),
          like(parkingTable.locality, `%${search}%`),
          like(parkingTable.city, `%${search}%`),
          like(parkingTable.state, `%${search}%`)
        )!
      );
    }

    // Add city filter
    if (city) {
      whereConditions.push(like(parkingTable.city, `%${city}%`));
    }

    // Add capacity filter
    if (capacity) {
      whereConditions.push(gte(parkingTable.capacity, Number(capacity)));
    }

    // Build where conditions for manager filter
    const finalWhereConditions = [...whereConditions];
    
    if (hasManager === 'true') {
      finalWhereConditions.push(eq(UserTable.role, 'parkingincharge'));
    } else if (hasManager === 'false') {
      finalWhereConditions.push(sql`${UserTable.id} IS NULL`);
    }

    // Build the query
    const query = db
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
        createdAt: parkingTable.createdAt,
        updatedAt: parkingTable.updatedAt,
        // Manager info
        managerId: UserTable.id,
        managerName: UserTable.name,
        managerEmail: UserTable.email,
        managerNumber: UserTable.number,
        managerAvatar: UserTable.avatar,
      })
      .from(parkingTable)
      .leftJoin(UserTable, and(
        eq(parkingTable.id, UserTable.parkingid),
        eq(UserTable.role, 'parkingincharge')
      ))
      .where(finalWhereConditions.length > 0 ? and(...finalWhereConditions) : undefined);

    // Get parking spots with pagination
    const parkingSpots = await query
      .orderBy(desc(parkingTable.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count for pagination
    const countQuery = db
      .select({ count: count() })
      .from(parkingTable)
      .leftJoin(UserTable, and(
        eq(parkingTable.id, UserTable.parkingid),
        eq(UserTable.role, 'parkingincharge')
      ))
      .where(finalWhereConditions.length > 0 ? and(...finalWhereConditions) : undefined);

    const totalResult = await countQuery;
    const total = totalResult[0]?.count || 0;

    // Get car statistics for each parking spot
    const parkingSpotsWithStats = await Promise.all(
      parkingSpots.map(async (spot) => {
        // Get total cars in this parking
        const totalCarsResult = await db
          .select({ count: count() })
          .from(carModel)
          .where(eq(carModel.parkingid, spot.id));

        // Get available cars
        const availableCarsResult = await db
          .select({ count: count() })
          .from(carModel)
          .where(and(
            eq(carModel.parkingid, spot.id),
            eq(carModel.status, 'available'),
          ));

        const totalCars = totalCarsResult[0]?.count || 0;
        const availableCars = availableCarsResult[0]?.count || 0;
        const utilizationRate = spot.capacity > 0 ? (totalCars / spot.capacity) * 100 : 0;

        return {
          ...spot,
          totalCars,
          availableCars,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          manager: spot.managerId ? {
            id: spot.managerId,
            name: spot.managerName,
            email: spot.managerEmail,
            number: spot.managerNumber,
            avatar: spot.managerAvatar,
          } : null,
        };
      })
    );

    return res.status(200).json(
      new ApiResponse(200, {
        parkingSpots: parkingSpotsWithStats,
        total,
        page: Number(page),
        limit: Number(limit),
      }, 'Parking spots retrieved successfully')
    );
  } catch (error) {
    console.error('Error searching parking spots:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to search parking spots')
    );
  }
});

// ========================================
// PARKING ANALYTICS
// ========================================

// Get parking analytics for a specific spot
export const getParkingAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'monthly', spotId } = req.query as {
    period?: string;
    spotId?: string;
  };

  try {
    if (!spotId) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Spot ID is required')
      );
    }

    // Get parking spot details
    const parkingSpot = await db
      .select()
      .from(parkingTable)
      .where(eq(parkingTable.id, Number(spotId)))
      .limit(1);

    if (parkingSpot.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Parking spot not found')
      );
    }

    const spot = parkingSpot[0];

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get utilization history (simplified - in real app, you'd have historical data)
    const utilizationHistory = [];
    const daysInPeriod = period === 'daily' ? 1 : 
                        period === 'weekly' ? 7 : 
                        period === 'monthly' ? 30 : 365;

    for (let i = 0; i < daysInPeriod; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      
      // Get car count for this date (simplified - using current data)
      const totalCarsResult = await db
        .select({ count: count() })
        .from(carModel)
        .where(eq(carModel.parkingid, Number(spotId)));

      const availableCarsResult = await db
        .select({ count: count() })
        .from(carModel)
        .where(and(
          eq(carModel.parkingid, Number(spotId)),
          eq(carModel.status, 'available'),
        ));

      const totalCars = totalCarsResult[0]?.count || 0;
      const availableCars = availableCarsResult[0]?.count || 0;
      const utilization = spot.capacity > 0 ? (totalCars / spot.capacity) * 100 : 0;

      utilizationHistory.push({
        date: date.toISOString().split('T')[0],
        utilization: Math.round(utilization * 100) / 100,
        totalCars,
        availableCars,
      });
    }

    // Calculate average and peak utilization
    const utilizations = utilizationHistory.map(h => h.utilization);
    const averageUtilization = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
    const peakUtilization = Math.max(...utilizations);

    return res.status(200).json(
      new ApiResponse(200, {
        spotId: Number(spotId),
        spotName: spot.name,
        utilizationHistory,
        averageUtilization: Math.round(averageUtilization * 100) / 100,
        peakUtilization: Math.round(peakUtilization * 100) / 100,
      }, 'Parking analytics retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching parking analytics:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch parking analytics')
    );
  }
});

// ========================================
// PARKING MANAGERS PERFORMANCE
// ========================================

// Get parking managers performance
export const getParkingManagersPerformance = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get all parking managers (PIC role)
    const managers = await db
      .select({
        id: UserTable.id,
        name: UserTable.name,
        email: UserTable.email,
        number: UserTable.number,
        avatar: UserTable.avatar,
        parkingId: UserTable.parkingid,
        createdAt: UserTable.createdAt,
        updatedAt: UserTable.updatedAt,
        // Parking spot details
        parkingName: parkingTable.name,
        parkingCapacity: parkingTable.capacity,
        parkingLocality: parkingTable.locality,
        parkingCity: parkingTable.city,
      })
      .from(UserTable)
      .leftJoin(parkingTable, eq(UserTable.parkingid, parkingTable.id))
      .where(eq(UserTable.role, 'parkingincharge'))
      .orderBy(desc(UserTable.createdAt));

    // Get performance data for each manager
    const managersWithPerformance = await Promise.all(
      managers.map(async (manager) => {
        if (!manager.parkingId) {
          return {
            ...manager,
            parkingSpot: null,
            carsManaged: 0,
            utilizationRate: 0,
            lastActivity: manager.updatedAt,
          };
        }

        // Get cars managed by this parking spot
        const carsManagedResult = await db
          .select({ count: count() })
          .from(carModel)
          .where(eq(carModel.parkingid, manager.parkingId));

        // Get available cars
        const availableCarsResult = await db
          .select({ count: count() })
          .from(carModel)
          .where(and(
            eq(carModel.parkingid, manager.parkingId),
            eq(carModel.status, 'available'),
          ));

        const carsManaged = carsManagedResult[0]?.count || 0;
        const availableCars = availableCarsResult[0]?.count || 0;
        const utilizationRate = (manager.parkingCapacity && manager.parkingCapacity > 0) ? 
          (carsManaged / manager.parkingCapacity) * 100 : 0;

        // Get last activity (simplified - using updatedAt)
        const lastActivity = manager.updatedAt;

        return {
          id: manager.id,
          name: manager.name,
          email: manager.email,
          number: manager.number,
          avatar: manager.avatar,
          parkingSpot: {
            id: manager.parkingId,
            name: manager.parkingName,
            locality: manager.parkingLocality,
            city: manager.parkingCity,
            capacity: manager.parkingCapacity,
          },
          carsManaged,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          lastActivity: lastActivity?.toISOString() || null,
        };
      })
    );

    return res.status(200).json(
      new ApiResponse(200, {
        managers: managersWithPerformance,
      }, 'Parking managers performance retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching parking managers performance:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch parking managers performance')
    );
  }
});
