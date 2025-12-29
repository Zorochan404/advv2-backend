import { eq, and } from "drizzle-orm";
import { db } from "../../drizzle/db";
import { asyncHandler } from "../utils/asyncHandler";
import { reviewModel } from "./reviewmodel";
import { Request, Response } from "express";
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
import { withDatabaseErrorHandling } from "../utils/dbErrorHandler";
import { sql } from "drizzle-orm";

export const addreview = asyncHandler(async (req: Request, res: Response) => {
  const { rating, comment } = req.body;
  const { carid } = req.params;
  const userid = (req as any).user?.id;

  if (!userid) {
    throw ApiError.unauthorized("User not authenticated");
  }

  if (!rating || !comment) {
    throw ApiError.badRequest("Rating and comment are required");
  }

  // Validate rating range (assuming 1-5 scale)
  if (rating < 1 || rating > 5) {
    throw ApiError.badRequest("Rating must be between 1 and 5");
  }

  const review = await withDatabaseErrorHandling(async () => {
    // Check if user has already reviewed this car
    const existingReview = await db
      .select()
      .from(reviewModel)
      .where(
        and(
          eq(reviewModel.carid, parseInt(carid)),
          eq(reviewModel.userid, userid)
        )
      );

    if (existingReview.length > 0) {
      throw ApiError.conflict("You have already reviewed this car");
    }

    // Add the review
    const newReview = await db
      .insert(reviewModel)
      .values({
        carid: parseInt(carid),
        userid,
        rating,
        comment,
      })
      .returning();

    // Get the populated review with user data
    const populatedReview = await db.query.reviewModel.findFirst({
      where: eq(reviewModel.id, newReview[0].id),
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

    return populatedReview;
  }, "addreview");

  return sendCreated(res, review, "Review added successfully");
});

export const getavgratingbycars = asyncHandler(
  async (req: Request, res: Response) => {
    const { carid } = req.params;

    if (!carid || !/^[0-9]+$/.test(carid)) {
      throw ApiError.badRequest("Invalid car ID");
    }

    const avgRating = await withDatabaseErrorHandling(async () => {
      const reviews = await db
        .select()
        .from(reviewModel)
        .where(eq(reviewModel.carid, parseInt(carid)));

      // Safely handle possible null ratings
      const validRatings = reviews
        .map((review) => review.rating)
        .filter(
          (rating): rating is number => rating !== null && rating !== undefined
        );

      return validRatings.length > 0
        ? validRatings.reduce((acc, rating) => acc + rating, 0) /
            validRatings.length
        : 0;
    }, "getavgratingbycars");

    return sendSuccess(
      res,
      { review: avgRating },
      "Average rating calculated successfully"
    );
  }
);

export const getreviewsbycars = asyncHandler(
  async (req: Request, res: Response) => {
    const { carid } = req.params;
    const {
      limit = 10,
      page = 1,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    if (!carid || !/^[0-9]+$/.test(carid)) {
      throw ApiError.badRequest("Invalid car ID");
    }

    // Parse and validate query parameters
    const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Max 50 reviews per request
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    // Validate sort field
    const allowedSortFields = ["createdAt", "updatedAt", "rating"];
    const sortField = allowedSortFields.includes(sort as string)
      ? (sort as string)
      : "createdAt";
    const sortOrder = order === "asc" ? "asc" : "desc";

    const result = await withDatabaseErrorHandling(async () => {
      // Get total count for pagination
      const totalReviews = await db
        .select({ count: sql<number>`count(*)` })
        .from(reviewModel)
        .where(eq(reviewModel.carid, parseInt(carid)));

      const total = totalReviews[0]?.count || 0;

      // Get reviews with populated user and car data
      const reviews = await db.query.reviewModel.findMany({
        where: eq(reviewModel.carid, parseInt(carid)),
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
        limit: limitNum,
        offset: offset,
        orderBy: (reviewModel, { asc, desc }) =>
          sortOrder === "asc"
            ? asc(reviewModel[sortField as keyof typeof reviewModel])
            : desc(reviewModel[sortField as keyof typeof reviewModel]),
      });

      return { reviews, total };
    }, "getreviewsbycars");

    return sendPaginated(
      res,
      result.reviews,
      result.total,
      pageNum,
      limitNum,
      "Reviews fetched successfully"
    );
  }
);

export const getreviews = asyncHandler(async (req: Request, res: Response) => {
  const {
    limit = 10,
    page = 1,
    sort = "createdAt",
    order = "desc",
  } = req.query;

  // Parse and validate query parameters
  const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Max 50 reviews per request
  const pageNum = Math.max(parseInt(page as string) || 1, 1);
  const offset = (pageNum - 1) * limitNum;

  // Validate sort field
  const allowedSortFields = ["createdAt", "updatedAt", "rating"];
  const sortField = allowedSortFields.includes(sort as string)
    ? (sort as string)
    : "createdAt";
  const sortOrder = order === "asc" ? "asc" : "desc";

  const result = await withDatabaseErrorHandling(async () => {
    // Get total count for pagination
    const totalReviews = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviewModel);

    const total = totalReviews[0]?.count || 0;

    // Get all reviews with populated user data
    const reviews = await db.query.reviewModel.findMany({
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
      limit: limitNum,
      offset: offset,
      orderBy: (reviewModel, { asc, desc }) =>
        sortOrder === "asc"
          ? asc(reviewModel[sortField as keyof typeof reviewModel])
          : desc(reviewModel[sortField as keyof typeof reviewModel]),
    });

    return { reviews, total };
  }, "getreviews");

  return sendPaginated(
    res,
    result.reviews,
    result.total,
    pageNum,
    limitNum,
    "All reviews fetched successfully"
  );
});

export const updatereview = asyncHandler(
  async (req: Request, res: Response) => {
    const { reviewid } = req.params;
    const currentUser = (req as any).user;

    if (!currentUser) {
      throw ApiError.unauthorized("User not authenticated");
    }

    const { rating, comment } = req.body;

    if (!rating || !comment) {
      throw ApiError.badRequest("Rating and comment are required");
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      throw ApiError.badRequest("Rating must be between 1 and 5");
    }

    const review = await withDatabaseErrorHandling(async () => {
      const singlereview = await db
        .select()
        .from(reviewModel)
        .where(eq(reviewModel.id, parseInt(reviewid)));

      if (singlereview.length === 0) {
        throw ApiError.notFound("Review not found");
      }

      const reviewToUpdate = singlereview[0];

      // Check if user can update the review (admin or review owner)
      if (
        currentUser.role === "admin" ||
        currentUser.id === reviewToUpdate.userid
      ) {
        await db
          .update(reviewModel)
          .set({ rating, comment })
          .where(eq(reviewModel.id, parseInt(reviewid)));

        // Get the updated review with populated user data
        const updatedReview = await db.query.reviewModel.findFirst({
          where: eq(reviewModel.id, parseInt(reviewid)),
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

        return updatedReview;
      } else {
        throw ApiError.forbidden(
          "You are not authorized to update this review"
        );
      }
    }, "updatereview");

    return sendUpdated(res, review, "Review updated successfully");
  }
);

export const deletereview = asyncHandler(
  async (req: Request, res: Response) => {
    const { reviewid } = req.params;
    const currentUser = (req as any).user;

    if (!currentUser) {
      throw ApiError.unauthorized("User not authenticated");
    }

    await withDatabaseErrorHandling(async () => {
      // Get the review to check ownership
      const singlereview = await db
        .select()
        .from(reviewModel)
        .where(eq(reviewModel.id, parseInt(reviewid)));

      if (singlereview.length === 0) {
        throw ApiError.notFound("Review not found");
      }

      const reviewToDelete = singlereview[0];

      // Check if user can delete the review (admin or review owner)
      if (
        currentUser.role === "admin" ||
        currentUser.id === reviewToDelete.userid
      ) {
        await db
          .delete(reviewModel)
          .where(eq(reviewModel.id, parseInt(reviewid)));
      } else {
        throw ApiError.forbidden(
          "You are not authorized to delete this review"
        );
      }
    }, "deletereview");

    return sendDeleted(res, "Review deleted successfully");
  }
);
