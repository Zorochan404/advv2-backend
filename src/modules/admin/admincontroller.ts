import { Request, Response } from "express";
import { db } from "../../drizzle/db";
import { bookingsTable as bookings } from "../booking/bookingmodel";
import { carModel as car, carCatalogTable } from "../car/carmodel";
import { UserTable as users } from "../user/usermodel";
import { parkingTable as parkings } from "../parking/parkingmodel";
import { reviewModel as review } from "../review/reviewmodel";
import { eq, gte, desc, count, sum, and, sql, like, or, inArray } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiResponse";

// Types for dashboard data
interface DashboardMetrics {
  totalRevenue: number;
  activeBookingsCount: number;
  totalUsersCount: number;
  carAvailability: {
    total: number;
    available: number;
    rented: number;
    maintenance: number;
    outOfService: number;
    availabilityRate: string;
  };
  parkingUtilization: Array<{
    name: string;
    cars: number;
    capacity: number;
    utilization: number;
    available: number;
  }>;
  revenueByCarType: Array<{
    type: string;
    revenue: number;
    bookings: number;
  }>;
  chartData: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
  recentBookings: Array<any>;
}

interface FilterPeriod {
  period?: 'today' | 'week' | 'month';
}

// Helper function to get date range based on period
function getDateRange(period: 'today' | 'week' | 'month') {
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;
  }
  
  return { startDate, endDate: now };
}

// Main dashboard endpoint - comprehensive data
export const getDashboardData = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'week' } = req.query as FilterPeriod;
  const { startDate, endDate } = getDateRange(period);

  try {
    // Fetch all data in parallel for better performance
    const [
      bookingsData,
      carsData,
      usersData,
      parkingData,
      filteredBookingsData
    ] = await Promise.all([
      // All bookings for recent activity
      db.select()
        .from(bookings)
        .orderBy(desc(bookings.createdAt))
        .limit(10),

      // All cars for availability calculation
      db.select()
        .from(car),

      // All users count
      db.select({ count: count() })
        .from(users),

      // All parking spots
      db.select()
        .from(parkings),

      // Filtered bookings for period-based calculations
      db.select()
        .from(bookings)
        .where(and(
          gte(bookings.createdAt, startDate),
          sql`${bookings.createdAt} <= ${endDate}`
        ))
    ]);

    // Calculate metrics
    const totalRevenue = filteredBookingsData.reduce((sum, booking) => 
      sum + (booking.totalPrice || 0), 0
    );

    const activeBookingsCount = bookingsData.filter(b => b.status === 'active').length;

    const totalUsersCount = usersData[0]?.count || 0;

    // Car availability calculation
    const totalCars = carsData.length;
    const availableCars = carsData.filter(c => c.isavailable).length;
    const rentedCars = carsData.filter(c => c.status === 'booked').length;
    const maintenanceCars = carsData.filter(c => c.status === 'maintenance').length;
    const outOfServiceCars = carsData.filter(c => c.status === 'unavailable').length;
    const availabilityRate = totalCars > 0 ? ((availableCars / totalCars) * 100).toFixed(1) : '0.0';

    // Parking utilization calculation
    const parkingUtilization = parkingData.map(spot => {
      const carsAtSpot = carsData.filter(car => car.parkingid === spot.id);
      const utilization = spot.capacity ? ((carsAtSpot.length / spot.capacity) * 100) : 0;
      return {
        name: spot.name,
        cars: carsAtSpot.length,
        capacity: spot.capacity,
        utilization: parseFloat(utilization.toFixed(1)),
        available: spot.capacity - carsAtSpot.length
      };
    });

    // Revenue by car type
    const revenueByCarTypeMap: Record<string, { revenue: number, bookings: number }> = {};
    filteredBookingsData.forEach(booking => {
      const car = carsData.find(c => c.id === booking.carId);
      const carType = car?.name || 'Unknown';
      if (!revenueByCarTypeMap[carType]) {
        revenueByCarTypeMap[carType] = { revenue: 0, bookings: 0 };
      }
      revenueByCarTypeMap[carType].revenue += booking.totalPrice || 0;
      revenueByCarTypeMap[carType].bookings += 1;
    });

    const revenueByCarType = Object.entries(revenueByCarTypeMap).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      revenue: data.revenue,
      bookings: data.bookings
    }));

    // Generate chart data
    const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    const chartData = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayBookings = filteredBookingsData.filter(b => {
        const created = b.createdAt ? new Date(b.createdAt) : null;
        const bookingDateStr = created ? created.toISOString().split('T')[0] : '';
        return bookingDateStr === dateStr;
      });
      
      chartData.push({
        date: dateStr,
        revenue: dayBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0),
        bookings: dayBookings.length
      });
    }

    // Get all users for recent bookings
    const allUsers = await db.select().from(users);
    
    // Recent bookings with car and user details
    const recentBookings = bookingsData.slice(0, 5).map(booking => {
      const car = carsData.find(c => c.id === booking.carId);
      const user = allUsers.find(u => u.id === booking.userId);
      
      return {
        id: booking.id,
        status: booking.status,
        totalPrice: booking.totalPrice,
        createdAt: booking.createdAt,
        car: car ? {
          name: car.name,
          number: car.number,
          id: car.id
        } : null,
        user: user ? {
          name: user.name
        } : null
      };
    });

    const dashboardData: DashboardMetrics = {
      totalRevenue,
      activeBookingsCount,
      totalUsersCount,
      carAvailability: {
        total: totalCars,
        available: availableCars,
        rented: rentedCars,
        maintenance: maintenanceCars,
        outOfService: outOfServiceCars,
        availabilityRate
      },
      parkingUtilization,
      revenueByCarType,
      chartData,
      recentBookings
    };

    return res.status(200).json(
      new ApiResponse(200, dashboardData, "Dashboard data retrieved successfully")
    );

  } catch (error) {
    console.error('Dashboard data error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, "Failed to retrieve dashboard data")
    );
  }
});

// Granular endpoints for specific dashboard widgets

// Get key metrics only
export const getDashboardMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'week' } = req.query as FilterPeriod;
  const { startDate, endDate } = getDateRange(period);

  try {
    const [
      filteredBookingsData,
      carsData,
      usersData
    ] = await Promise.all([
      db.select()
        .from(bookings)
        .where(and(
          gte(bookings.createdAt, startDate),
          sql`${bookings.createdAt} <= ${endDate}`
        )),
      db.select().from(car),
      db.select({ count: count() }).from(users)
    ]);

    const totalRevenue = filteredBookingsData.reduce((sum, booking) => 
      sum + (booking.totalPrice || 0), 0
    );

    const activeBookingsCount = filteredBookingsData.filter(b => b.status === 'active').length;
    const totalUsersCount = usersData[0]?.count || 0;

    const totalCars = carsData.length;
    const availableCars = carsData.filter(c => c.isavailable).length;
    const availabilityRate = totalCars > 0 ? ((availableCars / totalCars) * 100).toFixed(1) : '0.0';

    const metrics = {
      totalRevenue,
      activeBookingsCount,
      totalUsersCount,
      carAvailability: {
        total: totalCars,
        available: availableCars,
        availabilityRate
      }
    };

    return res.status(200).json(
      new ApiResponse(200, metrics, "Dashboard metrics retrieved successfully")
    );

  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, "Failed to retrieve dashboard metrics")
    );
  }
});

// Get car availability status
export const getCarAvailability = asyncHandler(async (req: Request, res: Response) => {
  try {
    const carsData = await db.select().from(car);

    const totalCars = carsData.length;
    const availableCars = carsData.filter(c => c.isavailable).length;
    const rentedCars = carsData.filter(c => c.status === 'booked').length;
    const maintenanceCars = carsData.filter(c => c.status === 'maintenance').length;
    const outOfServiceCars = carsData.filter(c => c.status === 'unavailable').length;
    const availabilityRate = totalCars > 0 ? ((availableCars / totalCars) * 100).toFixed(1) : '0.0';

    const carAvailability = {
      total: totalCars,
      available: availableCars,
      rented: rentedCars,
      maintenance: maintenanceCars,
      outOfService: outOfServiceCars,
      availabilityRate
    };

    return res.status(200).json(
      new ApiResponse(200, carAvailability, "Car availability data retrieved successfully")
    );

  } catch (error) {
    console.error('Car availability error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, "Failed to retrieve car availability data")
    );
  }
});

// Get parking utilization
export const getParkingUtilization = asyncHandler(async (req: Request, res: Response) => {
  try {
    const [carsData, parkingData] = await Promise.all([
      db.select().from(car),
      db.select().from(parkings)
    ]);

    const parkingUtilization = parkingData.map(spot => {
      const carsAtSpot = carsData.filter(car => car.parkingid === spot.id);
      const utilization = spot.capacity ? ((carsAtSpot.length / spot.capacity) * 100) : 0;
      return {
        name: spot.name,
        cars: carsAtSpot.length,
        capacity: spot.capacity,
        utilization: parseFloat(utilization.toFixed(1)),
        available: spot.capacity - carsAtSpot.length
      };
    });

    return res.status(200).json(
      new ApiResponse(200, parkingUtilization, "Parking utilization data retrieved successfully")
    );

  } catch (error) {
    console.error('Parking utilization error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, "Failed to retrieve parking utilization data")
    );
  }
});

// Get revenue trends for charts
export const getRevenueTrends = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'week' } = req.query as FilterPeriod;
  const { startDate, endDate } = getDateRange(period);

  try {
    const [filteredBookingsData, carsData] = await Promise.all([
      db.select()
        .from(bookings)
        .where(and(
          gte(bookings.createdAt, startDate),
          sql`${bookings.createdAt} <= ${endDate}`
        )),
      db.select().from(car)
    ]);

    // Generate chart data
    const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    const chartData = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayBookings = filteredBookingsData.filter(b => {
        const created = b.createdAt ? new Date(b.createdAt) : null;
        const bookingDateStr = created ? created.toISOString().split('T')[0] : '';
        return bookingDateStr === dateStr;
      });
      
      chartData.push({
        date: dateStr,
        revenue: dayBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0),
        bookings: dayBookings.length
      });
    }

    // Revenue by car type
    const revenueByCarTypeMap: Record<string, { revenue: number, bookings: number }> = {};
    filteredBookingsData.forEach(booking => {
      const car = carsData.find(c => c.id === booking.carId);
      const carType = car?.name || 'Unknown';
      if (!revenueByCarTypeMap[carType]) {
        revenueByCarTypeMap[carType] = { revenue: 0, bookings: 0 };
      }
      revenueByCarTypeMap[carType].revenue += booking.totalPrice || 0;
      revenueByCarTypeMap[carType].bookings += 1;
    });

    const revenueByCarType = Object.entries(revenueByCarTypeMap).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      revenue: data.revenue,
      bookings: data.bookings
    }));

    const trendsData = {
      chartData,
      revenueByCarType
    };

    return res.status(200).json(
      new ApiResponse(200, trendsData, "Revenue trends data retrieved successfully")
    );

  } catch (error) {
    console.error('Revenue trends error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, "Failed to retrieve revenue trends data")
    );
  }
});

// Get recent bookings
export const getRecentBookings = asyncHandler(async (req: Request, res: Response) => {
  const { limit = 5 } = req.query;

  try {
    const [bookingsData, carsData, usersData] = await Promise.all([
      db.select()
        .from(bookings)
        .orderBy(desc(bookings.createdAt))
        .limit(Number(limit)),
      db.select().from(car),
      db.select().from(users)
    ]);

    const recentBookings = bookingsData.map(booking => {
      const car = carsData.find(c => c.id === booking.carId);
      const user = usersData.find(u => u.id === booking.userId);
      
      return {
        id: booking.id,
        status: booking.status,
        totalPrice: booking.totalPrice,
        createdAt: booking.createdAt,
        car: car ? {
          name: car.name,
          number: car.number,
          id: car.id
        } : null,
        user: user ? {
          name: user.name
        } : null
      };
    });

    return res.status(200).json(
      new ApiResponse(200, recentBookings, "Recent bookings retrieved successfully")
    );

  } catch (error) {
    console.error('Recent bookings error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, "Failed to retrieve recent bookings")
    );
  }
});

// Get booking timeline and status overview for admin dashboard
export const getBookingTimelineOverview = asyncHandler(async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    // Get all active bookings
    const activeBookings = await db.select()
      .from(bookings)
      .where(sql`${bookings.status} IN ('active', 'confirmed')`);

    const [carsData, usersData] = await Promise.all([
      db.select().from(car),
      db.select().from(users)
    ]);

    const bookingTimeline = activeBookings.map(booking => {
      const car = carsData.find(c => c.id === booking.carId);
      const user = usersData.find(u => u.id === booking.userId);
      
      const endDate = new Date(booking.extensionTill || booking.endDate);
      const isOverdue = now > endDate;
      const hasTopup = booking.extensionTill !== null;

      // Determine booking status
      let bookingStatus = "ontime";
      if (hasTopup && isOverdue) {
        bookingStatus = "topup/late";
      } else if (hasTopup && !isOverdue) {
        bookingStatus = "topup/ontime";
      } else if (!hasTopup && isOverdue) {
        bookingStatus = "late";
      }

      // Calculate overdue hours for display
      const overdueHours = isOverdue ? Math.ceil(
        (now.getTime() - endDate.getTime()) / (1000 * 60 * 60)
      ) : 0;

      return {
        bookingId: booking.id,
        status: booking.status,
        bookingStatus, // ontime, late, topup/ontime, topup/late
        isOverdue,
        hasTopup,
        overdueHours,
        currentEndDate: booking.extensionTill || booking.endDate,
        originalEndDate: booking.endDate,
        extensionTill: booking.extensionTill,
        car: car ? {
          name: car.name,
          number: car.number,
          id: car.id
        } : null,
        user: user ? {
          name: user.name,
          id: user.id,
          phone: user.number
        } : null,
        createdAt: booking.createdAt,
        actualPickupDate: booking.actualPickupDate,
        // Admin can see if car needs to be cut off after 1 hour of no response
        requiresAction: isOverdue && overdueHours >= 1,
        actionRequired: isOverdue && overdueHours >= 1 ? "ENGINE_CUT_APPROVAL" : null
      };
    });

    // Sort by urgency (overdue bookings first, then by overdue hours)
    const sortedTimeline = bookingTimeline.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.isOverdue && b.isOverdue) return b.overdueHours - a.overdueHours;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    // Calculate summary statistics
    const summary = {
      totalActiveBookings: bookingTimeline.length,
      ontimeBookings: bookingTimeline.filter(b => b.bookingStatus === "ontime").length,
      lateBookings: bookingTimeline.filter(b => b.bookingStatus === "late").length,
      topupOntimeBookings: bookingTimeline.filter(b => b.bookingStatus === "topup/ontime").length,
      topupLateBookings: bookingTimeline.filter(b => b.bookingStatus === "topup/late").length,
      requiresAction: bookingTimeline.filter(b => b.requiresAction).length
    };

    return res.status(200).json(
      new ApiResponse(200, {
        summary,
        timeline: sortedTimeline,
        lastUpdated: now
      }, "Booking timeline overview retrieved successfully")
    );

  } catch (error) {
    console.error('Booking timeline overview error:', error);
    return res.status(500).json(
      new ApiResponse(500, null, "Failed to retrieve booking timeline overview")
    );
  }
});

// ========================================
// VENDOR MANAGEMENT
// ========================================

// Get list of vendors
export const getVendorsList = asyncHandler(async (req: Request, res: Response) => {
  const { search, limit = 20, offset = 0 } = req.query as {
    search?: string;
    limit?: number;
    offset?: number;
  };

  try {
    // Build where conditions
    const whereConditions = [eq(users.role, 'vendor')];

    // Add search condition if provided
    if (search) {
      whereConditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`),
          sql`CAST(${users.number} AS TEXT) LIKE ${`%${search}%`}`
        )!
      );
    }

    // Get vendors with pagination
    const vendors = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        number: users.number,
        avatar: users.avatar,
        locality: users.locality,
        city: users.city,
        state: users.state,
        isverified: users.isverified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(...whereConditions))
      .orderBy(desc(users.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Get total count for pagination
    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get car count for each vendor
    const vendorsWithCarCount = await Promise.all(
      vendors.map(async (vendor) => {
        const carCountResult = await db
          .select({ count: count() })
          .from(car)
          .where(eq(car.vendorid, vendor.id));

        return {
          ...vendor,
          carCount: carCountResult[0]?.count || 0,
        };
      })
    );

    return res.status(200).json(
      new ApiResponse(200, {
        vendors: vendorsWithCarCount,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      }, 'Vendors retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch vendors')
    );
  }
});

// ========================================
// PARKING MANAGEMENT
// ========================================

// Get list of parkings
export const getParkingsList = asyncHandler(async (req: Request, res: Response) => {
  const { search, limit = 20, offset = 0 } = req.query as {
    search?: string;
    limit?: number;
    offset?: number;
  };

  try {
    // Build where conditions
    const whereConditions = [];

    // Add search condition if provided
    if (search) {
      whereConditions.push(
        or(
          like(parkings.name, `%${search}%`),
          like(parkings.locality, `%${search}%`),
          like(parkings.city, `%${search}%`),
          like(parkings.state, `%${search}%`)
        )!
      );
    }

    // Get parkings with pagination
    const parkingList = await db
      .select({
        id: parkings.id,
        name: parkings.name,
        locality: parkings.locality,
        city: parkings.city,
        state: parkings.state,
        country: parkings.country,
        pincode: parkings.pincode,
        capacity: parkings.capacity,
        mainimg: parkings.mainimg,
        images: parkings.images,
        lat: parkings.lat,
        lng: parkings.lng,
        createdAt: parkings.createdAt,
        updatedAt: parkings.updatedAt,
      })
      .from(parkings)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(parkings.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Get total count for pagination
    const totalResult = await db
      .select({ count: count() })
      .from(parkings)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const total = totalResult[0]?.count || 0;

    // Get car count and availability for each parking
    const parkingsWithStats = await Promise.all(
      parkingList.map(async (parking) => {
        // Get total cars in this parking
        const totalCarsResult = await db
          .select({ count: count() })
          .from(car)
          .where(eq(car.parkingid, parking.id));

        // Get available cars in this parking
        const availableCarsResult = await db
          .select({ count: count() })
          .from(car)
          .where(and(
            eq(car.parkingid, parking.id),
            eq(car.isavailable, true),
            eq(car.inmaintainance, false)
          ));

        const totalCars = totalCarsResult[0]?.count || 0;
        const availableCars = availableCarsResult[0]?.count || 0;
        const utilizationPercentage = parking.capacity > 0 ? Math.round((totalCars / parking.capacity) * 100) : 0;

        return {
          ...parking,
          totalCars,
          availableCars,
          utilizationPercentage,
        };
      })
    );

    return res.status(200).json(
      new ApiResponse(200, {
        parkings: parkingsWithStats,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      }, 'Parkings retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching parkings:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch parkings')
    );
  }
});

// ========================================
// USER ROLE MANAGEMENT
// ========================================

// Assign roles to multiple users
export const assignUserRoles = asyncHandler(async (req: Request, res: Response) => {
  const { userIds, role } = req.body as {
    userIds: number[];
    role: 'user' | 'admin' | 'vendor' | 'parkingincharge';
  };

  try {
    // Validate input
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'User IDs array is required and cannot be empty')
      );
    }

    if (!role || !['user', 'admin', 'vendor', 'parkingincharge'].includes(role)) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Valid role is required (user, admin, vendor, parkingincharge)')
      );
    }

    // Check if all users exist
    const existingUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, currentRole: users.role })
      .from(users)
      .where(inArray(users.id, userIds));

    if (existingUsers.length !== userIds.length) {
      const foundIds = existingUsers.map(u => u.id);
      const missingIds = userIds.filter(id => !foundIds.includes(id));
      return res.status(404).json(
        new ApiResponse(404, null, `Users not found: ${missingIds.join(', ')}`)
      );
    }

    // Update roles for all users using individual updates
    const updatePromises = userIds.map(userId => 
      db
        .update(users)
        .set({ 
          role: role,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          updatedAt: users.updatedAt
        })
    );

    const updateResults = await Promise.all(updatePromises);
    const updateResult = updateResults.flat();

    // Prepare response with before/after role information
    const roleAssignments = updateResult.map(updatedUser => {
      const originalUser = existingUsers.find(u => u.id === updatedUser.id);
      return {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        previousRole: originalUser?.currentRole,
        newRole: updatedUser.role,
        updatedAt: updatedUser.updatedAt
      };
    });

    return res.status(200).json(
      new ApiResponse(200, {
        message: `Successfully assigned role '${role}' to ${roleAssignments.length} user(s)`,
        roleAssignments,
        summary: {
          totalUsers: roleAssignments.length,
          assignedRole: role,
          successCount: roleAssignments.length
        }
      }, 'User roles assigned successfully')
    );
  } catch (error) {
    console.error('Error assigning user roles:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to assign user roles')
    );
  }
});

// ========================================
// USER LIST MANAGEMENT
// ========================================

// Get list of users with search and pagination
export const getUsersList = asyncHandler(async (req: Request, res: Response) => {
  const { search, role, limit = 20, offset = 0 } = req.query as {
    search?: string;
    role?: string;
    limit?: number;
    offset?: number;
  };

  try {
    const whereConditions = [];

    // Add search condition
    if (search) {
      whereConditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`),
          sql`CAST(${users.number} AS TEXT) LIKE ${`%${search}%`}`
        )!
      );
    }

    // Add role filter
    if (role && ['user', 'admin', 'vendor', 'parkingincharge'].includes(role)) {
      whereConditions.push(eq(users.role, role as any));
    }

    // Get users with pagination
    const usersList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        number: users.number,
        avatar: users.avatar,
        role: users.role,
        isverified: users.isverified,
        locality: users.locality,
        city: users.city,
        state: users.state,
        country: users.country,
        pincode: users.pincode,
        parkingid: users.parkingid,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Get total count for pagination
    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const total = totalResult[0]?.count || 0;

    // Get additional statistics for each user
    const usersWithStats = await Promise.all(
      usersList.map(async (user) => {
        let additionalStats = {};

        // Get car count for vendors
        if (user.role === 'vendor') {
          const carCountResult = await db
            .select({ count: count() })
            .from(car)
            .where(eq(car.vendorid, user.id));
          additionalStats = { carCount: carCountResult[0]?.count || 0 };
        }

        // Get parking info for PIC
        if (user.role === 'parkingincharge' && user.parkingid) {
          const parkingResult = await db
            .select({
              id: parkings.id,
              name: parkings.name,
              locality: parkings.locality,
              city: parkings.city,
              capacity: parkings.capacity,
            })
            .from(parkings)
            .where(eq(parkings.id, user.parkingid))
            .limit(1);
          
          if (parkingResult.length > 0) {
            additionalStats = { 
              parkingInfo: parkingResult[0],
              // Get cars managed in this parking
              carsManaged: (await db
                .select({ count: count() })
                .from(car)
                .where(eq(car.parkingid, user.parkingid)))[0]?.count || 0
            };
          }
        }

        // Get booking count for regular users
        if (user.role === 'user') {
          const bookingCountResult = await db
            .select({ count: count() })
            .from(bookings)
            .where(eq(bookings.userId, user.id));
          additionalStats = { bookingCount: bookingCountResult[0]?.count || 0 };
        }

        return {
          ...user,
          ...additionalStats,
        };
      })
    );

    return res.status(200).json(
      new ApiResponse(200, {
        users: usersWithStats,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      }, 'Users retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch users')
    );
  }
});

// ========================================
// BOOKING MANAGEMENT
// ========================================

// Get single booking by ID with all details
export const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Get booking with basic related data
    const bookingResult = await db
      .select({
        // Booking details
        id: bookings.id,
        userId: bookings.userId,
        carId: bookings.carId,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        basePrice: bookings.basePrice,
        advanceAmount: bookings.advanceAmount,
        remainingAmount: bookings.remainingAmount,
        totalPrice: bookings.totalPrice,
        discountAmount: bookings.discountAmount,
        insuranceAmount: bookings.insuranceAmount,
        extensionPrice: bookings.extensionPrice,
        extensionTill: bookings.extensionTill,
        extensionTime: bookings.extensionTime,
        status: bookings.status,
        confirmationStatus: bookings.confirmationStatus,
        tools: bookings.tools,
        carConditionImages: bookings.carConditionImages,
        toolImages: bookings.toolImages,
        pickupParkingId: bookings.pickupParkingId,
        dropoffParkingId: bookings.dropoffParkingId,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
        
        // Car details
        carName: car.name,
        carMaker: carCatalogTable.carMaker,
        carYear: carCatalogTable.carModelYear,
        carNumber: car.number,
        carPrice: carCatalogTable.carPlatformPrice,
        carDiscountedPrice: carCatalogTable.carPlatformPrice,
        carColor: car.color,
        carTransmission: carCatalogTable.transmission,
        carFuel: carCatalogTable.fuelType,
        carType: carCatalogTable.carName,
        carSeats: carCatalogTable.seats,
        carRcNumber: car.rcnumber,
        carRcImg: car.rcimg,
        carPollutionImg: car.pollutionimg,
        carInsuranceImg: car.insuranceimg,
        carInMaintenance: car.inmaintainance,
        carIsAvailable: car.isavailable,
        carImages: car.images,
        carMainImg: car.images,
        carVendorId: car.vendorid,
        carParkingId: car.parkingid,
        carIsApproved: sql`true`,
        carIsPopular: sql`false`,
        carInsurancePrice: car.insuranceAmount,
        carCreatedAt: car.createdAt,
        carUpdatedAt: car.updatedAt,
        
        // User details
        userName: users.name,
        userAvatar: users.avatar,
        userAge: users.age,
        userNumber: users.number,
        userEmail: users.email,
        userAadharNumber: users.aadharNumber,
        userAadharImg: users.aadharimg,
        userDlNumber: users.dlNumber,
        userDlImg: users.dlimg,
        userPassportNumber: users.passportNumber,
        userPassportImg: users.passportimg,
        userLat: users.lat,
        userLng: users.lng,
        userLocality: users.locality,
        userCity: users.city,
        userState: users.state,
        userCountry: users.country,
        userPincode: users.pincode,
        userRole: users.role,
        userIsVerified: users.isverified,
        userParkingId: users.parkingid,
        userCreatedAt: users.createdAt,
        userUpdatedAt: users.updatedAt,
      })
      .from(bookings)
      .leftJoin(car, eq(bookings.carId, car.id))
      .leftJoin(carCatalogTable, eq(car.catalogId, carCatalogTable.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.id, Number(id)))
      .limit(1);

    if (bookingResult.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Booking not found')
      );
    }

    const booking = bookingResult[0];

    // Get pickup parking details
    let pickupParking = null;
    if (booking.pickupParkingId) {
      const pickupResult = await db
        .select()
        .from(parkings)
        .where(eq(parkings.id, Number(booking.pickupParkingId)))
        .limit(1);
      pickupParking = pickupResult[0] || null;
    }

    // Get dropoff parking details
    let dropoffParking = null;
    if (booking.dropoffParkingId) {
      const dropoffResult = await db
        .select()
        .from(parkings)
        .where(eq(parkings.id, Number(booking.dropoffParkingId)))
        .limit(1);
      dropoffParking = dropoffResult[0] || null;
    }

    // Transform the flat result into nested objects
    const transformedBooking = {
      id: booking.id,
      userId: booking.userId,
      carId: booking.carId,
      startDate: booking.startDate,
      endDate: booking.endDate,
      price: Number(booking.basePrice),
      insurancePrice: Number(booking.insuranceAmount),
      totalPrice: Number(booking.totalPrice),
      extensionPrice: booking.extensionPrice ? Number(booking.extensionPrice) : null,
      extentiontill: booking.extensionTill,
      extentiontime: booking.extensionTime,
      status: booking.status,
      tool: booking.tools || "",
      tripStartingCarImages: booking.carConditionImages || [],
      paymentStatus: "paid", // Default to paid, can be enhanced with payment table
      paymentReferenceId: "PAY_REF_123456", // Default, can be enhanced with payment table
      pickupParkingId: booking.pickupParkingId,
      dropoffParkingId: booking.dropoffParkingId,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      
      car: {
        id: booking.carId,
        name: booking.carName,
        maker: booking.carMaker,
        year: booking.carYear,
        carnumber: booking.carNumber,
        price: Number(booking.carPrice),
        discountedprice: Number(booking.carDiscountedPrice),
        color: booking.carColor,
        transmission: booking.carTransmission,
        fuel: booking.carFuel,
        type: booking.carType,
        seats: booking.carSeats,
        rcnumber: booking.carRcNumber,
        rcimg: booking.carRcImg,
        pollutionimg: booking.carPollutionImg,
        insuranceimg: booking.carInsuranceImg,
        inmaintainance: booking.carInMaintenance,
        isavailable: booking.carIsAvailable,
        images: booking.carImages || [],
        mainimg: booking.carMainImg,
        vendorid: booking.carVendorId,
        parkingid: booking.carParkingId,
        isapproved: booking.carIsApproved,
        ispopular: booking.carIsPopular,
        insurancePrice: Number(booking.carInsurancePrice),
        createdAt: booking.carCreatedAt,
        updatedAt: booking.carUpdatedAt,
      },
      
      user: {
        id: booking.userId,
        name: booking.userName,
        avatar: booking.userAvatar,
        age: booking.userAge,
        number: booking.userNumber,
        email: booking.userEmail,
        aadharNumber: booking.userAadharNumber,
        aadharimg: booking.userAadharImg,
        dlNumber: booking.userDlNumber,
        dlimg: booking.userDlImg,
        passportNumber: booking.userPassportNumber,
        passportimg: booking.userPassportImg,
        lat: booking.userLat,
        lng: booking.userLng,
        locality: booking.userLocality,
        city: booking.userCity,
        state: booking.userState,
        country: booking.userCountry,
        pincode: booking.userPincode,
        role: booking.userRole,
        isverified: booking.userIsVerified,
        parkingid: booking.userParkingId,
        createdAt: booking.userCreatedAt,
        updatedAt: booking.userUpdatedAt,
      },
      
      pickupParking: pickupParking ? {
        id: pickupParking.id,
        name: pickupParking.name,
        locality: pickupParking.locality,
        city: pickupParking.city,
        state: pickupParking.state,
        country: pickupParking.country,
        pincode: pickupParking.pincode,
        capacity: pickupParking.capacity,
        mainimg: pickupParking.mainimg,
        images: pickupParking.images || [],
        lat: pickupParking.lat,
        lng: pickupParking.lng,
        createdAt: pickupParking.createdAt,
        updatedAt: pickupParking.updatedAt,
      } : null,
      
      dropoffParking: dropoffParking ? {
        id: dropoffParking.id,
        name: dropoffParking.name,
        locality: dropoffParking.locality,
        city: dropoffParking.city,
        state: dropoffParking.state,
        country: dropoffParking.country,
        pincode: dropoffParking.pincode,
        capacity: dropoffParking.capacity,
        mainimg: dropoffParking.mainimg,
        images: dropoffParking.images || [],
        lat: dropoffParking.lat,
        lng: dropoffParking.lng,
        createdAt: dropoffParking.createdAt,
        updatedAt: dropoffParking.updatedAt,
      } : null,
    };

    return res.status(200).json(
      new ApiResponse(200, transformedBooking, 'Booking retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching booking:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch booking')
    );
  }
});
