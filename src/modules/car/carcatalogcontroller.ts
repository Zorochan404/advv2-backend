import { Request, Response } from "express";
import { carCatalogTable } from "./carmodel";
import { db } from "../../drizzle/db";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { eq, and, desc, asc, like, or, count } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  sendSuccess,
  sendCreated,
  sendUpdated,
  sendDeleted,
  sendItem,
  sendPaginated,
  sendList,
} from "../utils/responseHandler";
import { withDatabaseErrorHandling } from "../utils/dbErrorHandler";

// Create car catalog entry (Admin only)
export const createCarCatalog = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can create car catalog entries");
    }

    const {
      carName,
      carMaker,
      carModelYear,
      carVendorPrice,
      carPlatformPrice,
      transmission,
      fuelType,
      seats,
      engineCapacity,
      mileage,
      features,
      imageUrl,
      category,
      estimation,
    } = req.body;

    // Validate required fields
    if (
      !carName ||
      !carMaker ||
      !carModelYear ||
      !carVendorPrice ||
      !carPlatformPrice
    ) {
      throw ApiError.badRequest("Missing required fields");
    }

    const catalogEntry = await withDatabaseErrorHandling(async () => {
      const newEntry = await db
        .insert(carCatalogTable)
        .values({
          carName: carName,
          carMaker: carMaker,
          carModelYear: parseInt(carModelYear),
          carVendorPrice: carVendorPrice.toString(),
          carPlatformPrice: carPlatformPrice.toString(),
          transmission: (transmission || "manual") as any,
          fuelType: (fuelType || "petrol") as any,
          seats: parseInt(seats) || 5,
          engineCapacity: engineCapacity,
          mileage: mileage,
          features: features,
          imageUrl: imageUrl,
          category: category || "sedan",
          createdBy: req.user!.id,
          estimation: estimation,
        })
        .returning();

      return newEntry[0];
    }, "createCarCatalog");

    return sendCreated(
      res,
      catalogEntry,
      "Car catalog entry created successfully"
    );
  }
);

// Get all car catalog entries (with pagination and filtering)
export const getAllCarCatalog = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      limit = 10,
      page = 1,
      category,
      fuelType,
      transmission,
      isActive = "true",
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const result = await withDatabaseErrorHandling(async () => {
      // Build where conditions
      const conditions = [];
      if (category)
        conditions.push(eq(carCatalogTable.category, category as string));
      if (fuelType)
        conditions.push(eq(carCatalogTable.fuelType, fuelType as any));
      if (transmission)
        conditions.push(eq(carCatalogTable.transmission, transmission as any));
      if (isActive !== undefined) {
        conditions.push(eq(carCatalogTable.isActive, isActive === "true"));
      }

      // Get total count
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(carCatalogTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = totalCount[0]?.count || 0;

      // Get catalog entries
      const catalogEntries = await db
        .select()
        .from(carCatalogTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(carCatalogTable.createdAt))
        .limit(limitNum)
        .offset(offset);

      return { catalogEntries, total };
    }, "getAllCarCatalog");

    return sendPaginated(
      res,
      result.catalogEntries,
      result.total,
      pageNum,
      limitNum,
      "Car catalog entries fetched successfully"
    );
  }
);

// Get car catalog entry by ID
export const getCarCatalogById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid catalog ID");
    }

    const catalogEntry = await withDatabaseErrorHandling(async () => {
      const foundEntry = await db
        .select()
        .from(carCatalogTable)
        .where(eq(carCatalogTable.id, parseInt(id)))
        .limit(1);

      if (!foundEntry || foundEntry.length === 0) {
        throw ApiError.notFound("Car catalog entry not found");
      }

      return foundEntry[0];
    }, "getCarCatalogById");

    return sendItem(
      res,
      catalogEntry,
      "Car catalog entry fetched successfully"
    );
  }
);

// Update car catalog entry (Admin only)
export const updateCarCatalog = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can update car catalog entries");
    }

    const { id } = req.params;
    const updateData = { ...req.body };

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid catalog ID");
    }

    // Convert numeric fields
    if (updateData.carModelYear) {
      updateData.carModelYear = parseInt(updateData.carModelYear);
    }
    if (updateData.carVendorPrice) {
      updateData.carVendorPrice = parseFloat(updateData.carVendorPrice);
    }
    if (updateData.carPlatformPrice) {
      updateData.carPlatformPrice = parseFloat(updateData.carPlatformPrice);
    }
    if (updateData.seats) {
      updateData.seats = parseInt(updateData.seats);
    }

    const updatedEntry = await withDatabaseErrorHandling(async () => {
      const result = await db
        .update(carCatalogTable)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(carCatalogTable.id, parseInt(id)))
        .returning();

      if (!result || result.length === 0) {
        throw ApiError.notFound("Car catalog entry not found");
      }

      return result[0];
    }, "updateCarCatalog");

    return sendUpdated(
      res,
      updatedEntry,
      "Car catalog entry updated successfully"
    );
  }
);

// Delete car catalog entry (Admin only)
export const deleteCarCatalog = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can delete car catalog entries");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid catalog ID");
    }

    const deletedEntry = await withDatabaseErrorHandling(async () => {
      const result = await db
        .delete(carCatalogTable)
        .where(eq(carCatalogTable.id, parseInt(id)))
        .returning();

      if (!result || result.length === 0) {
        throw ApiError.notFound("Car catalog entry not found");
      }

      return result[0];
    }, "deleteCarCatalog");

    return sendDeleted(res, "Car catalog entry deleted successfully");
  }
);

// Get active car catalog entries for vendors
export const getActiveCarCatalog = asyncHandler(
  async (req: Request, res: Response) => {
    const { category, fuelType, transmission } = req.query;

    const catalogEntries = await withDatabaseErrorHandling(async () => {
      // Build where conditions
      const conditions = [eq(carCatalogTable.isActive, true)];
      if (category)
        conditions.push(eq(carCatalogTable.category, category as string));
      if (fuelType)
        conditions.push(eq(carCatalogTable.fuelType, fuelType as any));
      if (transmission)
        conditions.push(eq(carCatalogTable.transmission, transmission as any));

      return await db
        .select()
        .from(carCatalogTable)
        .where(and(...conditions))
        .orderBy(asc(carCatalogTable.carName));
    }, "getActiveCarCatalog");

    return sendList(
      res,
      catalogEntries,
      catalogEntries.length,
      "Active car catalog entries fetched successfully"
    );
  }
);

// Seed car catalog data for testing (Admin only)
export const seedCarCatalog = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can seed car catalog data");
    }

    const seedData = [
      {
        carName: "Honda City",
        carMaker: "Honda",
        carModelYear: 2023,
        carVendorPrice: "800.00",
        carPlatformPrice: "1200.00",
        transmission: "manual" as any,
        fuelType: "petrol" as any,
        seats: 5,
        engineCapacity: "1.5L",
        mileage: "18 kmpl",
        features: "AC, Power Steering, Music System, Airbags, Bluetooth",
        imageUrl:
          "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500",
        category: "sedan",
        // Late fee rate removed
      },
      {
        carName: "Maruti Swift",
        carMaker: "Maruti Suzuki",
        carModelYear: 2023,
        carVendorPrice: "600.00",
        carPlatformPrice: "900.00",
        transmission: "manual" as any,
        fuelType: "petrol" as any,
        seats: 5,
        engineCapacity: "1.2L",
        mileage: "22 kmpl",
        features: "AC, Power Steering, Music System, Airbags",
        imageUrl:
          "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=500",
        category: "hatchback",
        // Late fee rate removed
      },
      {
        carName: "Toyota Innova Crysta",
        carMaker: "Toyota",
        carModelYear: 2023,
        carVendorPrice: "1200.00",
        carPlatformPrice: "1800.00",
        transmission: "automatic" as any,
        fuelType: "diesel" as any,
        seats: 7,
        engineCapacity: "2.4L",
        mileage: "12 kmpl",
        features:
          "AC, Power Steering, Music System, GPS, Leather Seats, Sunroof",
        imageUrl:
          "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=500",
        category: "suv",
        // Late fee rate removed
      },
      {
        carName: "Hyundai i20",
        carMaker: "Hyundai",
        carModelYear: 2023,
        carVendorPrice: "700.00",
        carPlatformPrice: "1000.00",
        transmission: "manual" as any,
        fuelType: "petrol" as any,
        seats: 5,
        engineCapacity: "1.2L",
        mileage: "20 kmpl",
        features: "AC, Power Steering, Music System, Airbags, LED Headlamps",
        imageUrl:
          "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=500",
        category: "hatchback",
        // Late fee rate removed
      },
      {
        carName: "Mahindra XUV500",
        carMaker: "Mahindra",
        carModelYear: 2023,
        carVendorPrice: "1000.00",
        carPlatformPrice: "1500.00",
        transmission: "manual" as any,
        fuelType: "diesel" as any,
        seats: 7,
        engineCapacity: "2.2L",
        mileage: "15 kmpl",
        features: "AC, Power Steering, Music System, GPS, Sunroof, 4WD",
        imageUrl:
          "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500",
        category: "suv",
        // Late fee rate removed
      },
      {
        carName: "Kia Seltos",
        carMaker: "Kia",
        carModelYear: 2023,
        carVendorPrice: "900.00",
        carPlatformPrice: "1300.00",
        transmission: "automatic" as any,
        fuelType: "petrol" as any,
        seats: 5,
        engineCapacity: "1.5L",
        mileage: "16 kmpl",
        features:
          "AC, Power Steering, Music System, GPS, Panoramic Sunroof, LED DRLs",
        imageUrl:
          "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=500",
        category: "suv",
        // Late fee rate removed
      },
      {
        carName: "Tata Nexon EV",
        carMaker: "Tata",
        carModelYear: 2023,
        carVendorPrice: "800.00",
        carPlatformPrice: "1200.00",
        transmission: "automatic" as any,
        fuelType: "electric" as any,
        seats: 5,
        engineCapacity: "30.2 kWh",
        mileage: "312 km range",
        features:
          "AC, Power Steering, Music System, GPS, Fast Charging, Regenerative Braking",
        imageUrl:
          "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=500",
        category: "electric",
        // Late fee rate removed
      },
      {
        carName: "BMW 3 Series",
        carMaker: "BMW",
        carModelYear: 2023,
        carVendorPrice: "2000.00",
        carPlatformPrice: "3000.00",
        transmission: "automatic" as any,
        fuelType: "petrol" as any,
        seats: 5,
        engineCapacity: "2.0L",
        mileage: "14 kmpl",
        features:
          "AC, Power Steering, Music System, GPS, Leather Seats, Sport Mode, LED Headlamps",
        imageUrl:
          "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500",
        category: "luxury",
        // Late fee rate removed
      },
    ];

    const createdEntries = await withDatabaseErrorHandling(async () => {
      const entries = [];
      for (const data of seedData) {
        const entry = await db
          .insert(carCatalogTable)
          .values({
            ...data,
            createdBy: req.user!.id,
          })
          .returning();
        entries.push(entry[0]);
      }
      return entries;
    }, "seedCarCatalog");

    return sendCreated(res, createdEntries, "Car catalog seeded successfully");
  }
);

// Update existing car catalog entries with late fee rates
export const updateCarCatalogLateFees = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can update car catalog late fees");
    }

    const result = await withDatabaseErrorHandling(async () => {
      // Get all existing car catalog entries
      const existingEntries = await db.select().from(carCatalogTable);

      const updatedEntries = [];
      for (const entry of existingEntries) {
        // Late fee rate logic removed - users can use topup instead
        const updatedEntry = await db
          .update(carCatalogTable)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(carCatalogTable.id, entry.id))
          .returning();

        updatedEntries.push(updatedEntry[0]);
      }

      return updatedEntries;
    }, "updateCarCatalogLateFees");

    return sendSuccess(
      res,
      result,
      "Car catalog late fees updated successfully"
    );
  }
);

// Get all unique car categories
export const getAllCarCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const categories = await withDatabaseErrorHandling(async () => {
      const result = await db
        .selectDistinct({ category: carCatalogTable.category })
        .from(carCatalogTable)
        .where(eq(carCatalogTable.isActive, true));

      // Extract categories and filter out null/undefined values
      const categoryList = result
        .map(item => item.category)
        .filter(category => category && category.trim() !== "");

      // Remove duplicates and sort alphabetically
      const uniqueCategories = [...new Set(categoryList)].sort();

      return uniqueCategories;
    }, "getAllCarCategories");

    return sendSuccess(
      res,
      { categories },
      "Car categories retrieved successfully"
    );
  }
);

// Search car catalog with filters (Admin only)
export const searchCarCatalog = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can search car catalog");
    }

    const { q, category, fuelType, transmission, seats, isActive, page = 1, limit = 20 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [];

    // Search query (q parameter)
    if (q) {
      const searchTerm = `%${q}%`;
      conditions.push(
        or(
          like(carCatalogTable.carName, searchTerm),
          like(carCatalogTable.carMaker, searchTerm),
          sql`CAST(${carCatalogTable.carModelYear} AS TEXT) LIKE ${searchTerm}`
        )
      );
    }

    // Category filter
    if (category) {
      conditions.push(eq(carCatalogTable.category, category as string));
    }

    // Fuel type filter
    if (fuelType && ['petrol', 'diesel', 'electric', 'hybrid'].includes(fuelType as string)) {
      conditions.push(eq(carCatalogTable.fuelType, fuelType as 'petrol' | 'diesel' | 'electric' | 'hybrid'));
    }

    // Transmission filter
    if (transmission && ['manual', 'automatic'].includes(transmission as string)) {
      conditions.push(eq(carCatalogTable.transmission, transmission as 'manual' | 'automatic'));
    }

    // Seats filter
    if (seats) {
      conditions.push(eq(carCatalogTable.seats, Number(seats)));
    }

    // Active status filter
    if (isActive !== undefined) {
      conditions.push(eq(carCatalogTable.isActive, isActive === 'true'));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await withDatabaseErrorHandling(async () => {
      // Get total count
      const totalCountResult = await db
        .select({ count: count() })
        .from(carCatalogTable)
        .where(whereCondition);

      const totalCount = totalCountResult[0]?.count || 0;

      // Get paginated results
      const catalogEntries = await db
        .select()
        .from(carCatalogTable)
        .where(whereCondition)
        .orderBy(desc(carCatalogTable.createdAt))
        .limit(Number(limit))
        .offset(offset);

      return {
        entries: catalogEntries,
        totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / Number(limit))
      };
    }, "searchCarCatalog");

    return sendSuccess(
      res,
      {
        data: results.entries,
        pagination: {
          page: results.page,
          limit: results.limit,
          total: results.totalCount,
          totalPages: results.totalPages,
          hasNext: results.page < results.totalPages,
          hasPrev: results.page > 1
        },
        filters: {
          q: q || null,
          category: category || null,
          fuelType: fuelType || null,
          transmission: transmission || null,
          seats: seats || null,
          isActive: isActive || null
        }
      },
      "Car catalog search completed successfully"
    );
  }
);

// Get usage statistics for a specific car catalog template
export const getCatalogUsageStats = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can view catalog usage stats");
    }

    const { id } = req.params;

    if (!id || !/^[0-9]+$/.test(id)) {
      throw ApiError.badRequest("Invalid catalog ID");
    }

    const catalogId = parseInt(id);

    const stats = await withDatabaseErrorHandling(async () => {
      // Get catalog entry details
      const catalogEntry = await db
        .select()
        .from(carCatalogTable)
        .where(eq(carCatalogTable.id, catalogId))
        .limit(1);

      if (!catalogEntry.length) {
        throw ApiError.notFound("Car catalog entry not found");
      }

      // Get usage statistics
      const usageStatsResult = await sql`
        SELECT 
          COUNT(c.id) as total_cars,
          COUNT(CASE WHEN c.status = 'available' THEN 1 END) as available_cars,
          COUNT(CASE WHEN c.status = 'booked' THEN 1 END) as booked_cars,
          COUNT(CASE WHEN c.status = 'maintenance' THEN 1 END) as maintenance_cars,
          COUNT(CASE WHEN c.status = 'unavailable' THEN 1 END) as unavailable_cars,
          COUNT(CASE WHEN b.id IS NOT NULL THEN 1 END) as total_bookings,
          COUNT(CASE WHEN b.status = 'active' THEN 1 END) as active_bookings,
          COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings
        FROM car_catalog cc
        LEFT JOIN car c ON c.catalog_id = cc.id
        LEFT JOIN bookings b ON b.car_id = c.id
        WHERE cc.id = ${catalogId}
      `;
      const usageStats = usageStatsResult || [];

      // Get recent bookings for this catalog
      const recentBookingsResult = await sql`
        SELECT 
          b.id,
          b.status,
          b.created_at,
          b.total_price,
          u.name as user_name,
          c.number as car_number
        FROM bookings b
        JOIN car c ON c.id = b.car_id
        LEFT JOIN users u ON u.id = b.user_id
        WHERE c.catalog_id = ${catalogId}
        ORDER BY b.created_at DESC
        LIMIT 10
      `;
      const recentBookings = recentBookingsResult || [];

      return {
        catalog: catalogEntry[0],
        usage: (usageStats as unknown as any[])[0] || {},
        recentBookings: (recentBookings as unknown as any[]) || []
      };
    }, "getCatalogUsageStats");

    return sendSuccess(
      res,
      stats,
      "Catalog usage statistics retrieved successfully"
    );
  }
);

// Get categories with template counts
export const getCategoriesWithCounts = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can view category counts");
    }

    const categoriesWithCounts = await withDatabaseErrorHandling(async () => {
      // Get all categories with their counts using Drizzle queries
      const allCategories = await db.select({
        category: carCatalogTable.category,
        isActive: carCatalogTable.isActive
      }).from(carCatalogTable);

      // Group by category and calculate counts
      const categoryStats = allCategories.reduce((acc: any, item) => {
        const category = item.category || 'unknown';
        if (!acc[category]) {
          acc[category] = {
            category,
            template_count: 0,
            active_templates: 0,
            inactive_templates: 0
          };
        }
        acc[category].template_count++;
        if (item.isActive) {
          acc[category].active_templates++;
        } else {
          acc[category].inactive_templates++;
        }
        return acc;
      }, {});

      const categoryStatsArray = Object.values(categoryStats).sort((a: any, b: any) => b.template_count - a.template_count);

      // Get total statistics
      const totalTemplates = allCategories.length;
      const totalActiveTemplates = allCategories.filter(c => c.isActive).length;
      const totalCategories = Object.keys(categoryStats).length;

      return {
        categories: categoryStatsArray,
        summary: {
          total_templates: totalTemplates,
          total_active_templates: totalActiveTemplates,
          total_categories: totalCategories
        }
      };
    }, "getCategoriesWithCounts");

    return sendSuccess(
      res,
      categoriesWithCounts,
      "Categories with counts retrieved successfully"
    );
  }
);
