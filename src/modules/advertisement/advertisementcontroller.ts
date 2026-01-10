import { Request, Response } from "express";
import { db } from "../../drizzle/db";
import {
  advertisementTable,
  adStatusEnum,
  adTypeEnum,
} from "./advertisementmodel";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { eq, and, gte, lte, desc, asc, like, or } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Create new advertisement
export const createAdvertisement = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    try {
      // Check if user is authorized (admin or vendor)
      if (
        !req.user ||
        (req.user.role !== "admin" && req.user.role !== "vendor")
      ) {
        throw new ApiError(
          403,
          "You are not authorized to create advertisements"
        );
      }

      const {
        title,
        description,
        imageUrl,
        videoUrl,
        linkUrl,
        adType,
        priority,
        startDate,
        endDate,
        targetAudience,
        location,
      } = req.body;

      // Validate required fields
      if (!title || !imageUrl || !startDate || !endDate) {
        throw new ApiError(
          400,
          "Title, image URL, start date, and end date are required"
        );
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      const currentDate = new Date();

      if (start >= end) {
        throw new ApiError(400, "End date must be after start date");
      }

      // Allow start dates in the past but not too far back (within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(currentDate.getDate() - 30);

      if (start < thirtyDaysAgo) {
        throw new ApiError(
          400,
          "Start date cannot be more than 30 days in the past"
        );
      }

      const advertisement = await db
        .insert(advertisementTable)
        .values({
          title,
          description,
          imageUrl,
          videoUrl,
          linkUrl,
          adType: (adType as any) || "banner",
          priority: priority || 1,
          startDate: new Date(start),
          endDate: new Date(end),
          targetAudience: targetAudience || "all",
          location: location || "homepage",
          createdBy: req.user.id,
        })
        .returning();

      return res
        .status(201)
        .json(
          new ApiResponse(
            201,
            advertisement[0],
            "Advertisement created successfully"
          )
        );
    } catch (error) {
      console.log(error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to create advertisement");
    }
  }
);

// Get all advertisements (admin only)
export const getAllAdvertisements = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        throw new ApiError(
          403,
          "You are not authorized to view all advertisements"
        );
      }

      const {
        limit = 10,
        page = 1,
        status,
        adType,
        sort = "createdAt",
        order = "desc",
      } = req.query;

      // Parse and validate query parameters
      const limitNum = Math.min(parseInt(limit as string) || 10, 50);
      const pageNum = Math.max(parseInt(page as string) || 1, 1);
      const offset = (pageNum - 1) * limitNum;

      // Build where conditions
      const conditions = [];
      if (status) conditions.push(eq(advertisementTable.status, status as any));
      if (adType) conditions.push(eq(advertisementTable.adType, adType as any));

      // Get total count
      const totalAds = await db
        .select({ count: sql<number>`count(*)` })
        .from(advertisementTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = totalAds[0]?.count || 0;

      // Get advertisements with pagination
      const advertisements = await db
        .select()
        .from(advertisementTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limitNum)
        .offset(offset)
        .orderBy(
          order === "asc"
            ? asc(advertisementTable.createdAt)
            : desc(advertisementTable.createdAt)
        );

      // Calculate pagination info
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      const response = {
        advertisements,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalAds: total,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null,
        },
      };

      return res
        .status(200)
        .json(
          new ApiResponse(200, response, "Advertisements fetched successfully")
        );
    } catch (error) {
      console.log(error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to fetch advertisements");
    }
  }
);

// Get advertisement by ID
export const getAdvertisementById = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const advertisement = await db
        .select()
        .from(advertisementTable)
        .where(eq(advertisementTable.id, parseInt(id)))
        .limit(1);

      if (!advertisement || advertisement.length === 0) {
        throw new ApiError(404, "Advertisement not found");
      }

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            advertisement[0],
            "Advertisement fetched successfully"
          )
        );
    } catch (error) {
      console.log(error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to fetch advertisement");
    }
  }
);

// Update advertisement
export const updateAdvertisement = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    try {
      const { id } = req.params;

      if (
        !req.user ||
        (req.user.role !== "admin" && req.user.role !== "vendor")
      ) {
        throw new ApiError(
          403,
          "You are not authorized to update advertisements"
        );
      }

      const advertisement = await db
        .select()
        .from(advertisementTable)
        .where(eq(advertisementTable.id, parseInt(id)))
        .limit(1);

      if (!advertisement || advertisement.length === 0) {
        throw new ApiError(404, "Advertisement not found");
      }

      // Only admin can update any ad, vendors can only update their own ads
      if (
        req.user.role !== "admin" &&
        advertisement[0].createdBy !== req.user.id
      ) {
        throw new ApiError(403, "You can only update your own advertisements");
      }

      const updateData = { ...req.body };

      // Handle date fields properly
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      // Validate dates if provided
      if (updateData.startDate && updateData.endDate) {
        const start = new Date(updateData.startDate);
        const end = new Date(updateData.endDate);
        const currentDate = new Date();

        if (start >= end) {
          throw new ApiError(400, "End date must be after start date");
        }

        // Allow start dates in the past but not too far back (within last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(currentDate.getDate() - 30);

        if (start < thirtyDaysAgo) {
          throw new ApiError(
            400,
            "Start date cannot be more than 30 days in the past"
          );
        }
      }

      const updatedAdvertisement = await db
        .update(advertisementTable)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(advertisementTable.id, parseInt(id)))
        .returning();

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            updatedAdvertisement[0],
            "Advertisement updated successfully"
          )
        );
    } catch (error) {
      console.log(error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to update advertisement");
    }
  }
);

// Delete advertisement
export const deleteAdvertisement = asyncHandler(
  async (
    req: Request & { user?: { id?: number; role?: string } },
    res: Response
  ) => {
    try {
      const { id } = req.params;

      if (
        !req.user ||
        (req.user.role !== "admin" && req.user.role !== "vendor")
      ) {
        throw new ApiError(
          403,
          "You are not authorized to delete advertisements"
        );
      }

      const advertisement = await db
        .select()
        .from(advertisementTable)
        .where(eq(advertisementTable.id, parseInt(id)))
        .limit(1);

      if (!advertisement || advertisement.length === 0) {
        throw new ApiError(404, "Advertisement not found");
      }

      // Only admin can delete any ad, vendors can only delete their own ads
      if (
        req.user.role !== "admin" &&
        advertisement[0].createdBy !== req.user.id
      ) {
        throw new ApiError(403, "You can only delete your own advertisements");
      }

      await db
        .delete(advertisementTable)
        .where(eq(advertisementTable.id, parseInt(id)));

      return res
        .status(200)
        .json(new ApiResponse(200, null, "Advertisement deleted successfully"));
    } catch (error) {
      console.log(error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to delete advertisement");
    }
  }
);

// Get active advertisements for carousel (public endpoint)
export const getActiveAdvertisements = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const {
        adType = "carousel",
        location = "homepage",
        limit = 5,
      } = req.query;

      const limitNum = Math.min(parseInt(limit as string) || 5, 20);
      const currentDate = new Date();

      // Allow advertisements that are currently active or scheduled to start within the next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(currentDate.getDate() + 30);

      const advertisements = await db
        .select({
          id: advertisementTable.id,
          title: advertisementTable.title,
          description: advertisementTable.description,
          imageUrl: advertisementTable.imageUrl,
          videoUrl: advertisementTable.videoUrl,
          linkUrl: advertisementTable.linkUrl,
          adType: advertisementTable.adType,
          priority: advertisementTable.priority,
        })
        .from(advertisementTable)
        .where(
          and(
            eq(advertisementTable.isActive, true),
            eq(advertisementTable.location, location as string),
            lte(advertisementTable.startDate, thirtyDaysFromNow), // Allow ads starting within next 30 days
            gte(advertisementTable.endDate, currentDate) // Must not have ended yet
          )
        )
        .orderBy(
          desc(advertisementTable.priority),
          desc(advertisementTable.createdAt)
        )
        .limit(limitNum);

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            advertisements,
            "Active advertisements fetched successfully"
          )
        );
    } catch (error) {
      console.log(error);
      throw new ApiError(500, "Failed to fetch active advertisements");
    }
  }
);

// Increment view count
export const incrementViewCount = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .update(advertisementTable)
        .set({
          viewCount: sql`${advertisementTable.viewCount} + 1`,
        })
        .where(eq(advertisementTable.id, parseInt(id)));

      return res
        .status(200)
        .json(new ApiResponse(200, null, "View count incremented"));
    } catch (error) {
      console.log(error);
      throw new ApiError(500, "Failed to increment view count");
    }
  }
);

// Increment click count
export const incrementClickCount = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .update(advertisementTable)
        .set({
          clickCount: sql`${advertisementTable.clickCount} + 1`,
        })
        .where(eq(advertisementTable.id, parseInt(id)));

      return res
        .status(200)
        .json(new ApiResponse(200, null, "Click count incremented"));
    } catch (error) {
      console.log(error);
      throw new ApiError(500, "Failed to increment click count");
    }
  }
);

// Get advertisement statistics (admin only)
export const getAdvertisementStats = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        throw new ApiError(
          403,
          "You are not authorized to view advertisement statistics"
        );
      }

      const stats = await db
        .select({
          totalAds: sql<number>`count(*)`,
          activeAds: sql<number>`count(*) filter (where status = 'active')`,
          pendingAds: sql<number>`count(*) filter (where status = 'pending')`,
          totalViews: sql<number>`sum(view_count)`,
          totalClicks: sql<number>`sum(click_count)`,
        })
        .from(advertisementTable);

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            stats[0],
            "Advertisement statistics fetched successfully"
          )
        );
    } catch (error) {
      console.log(error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to fetch advertisement statistics");
    }
  }
);
