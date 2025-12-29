import { Request, Response } from "express";
import { carModel } from "./carmodel";
import { db } from "../../drizzle/db";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { sql } from "drizzle-orm";
import { sendSuccess } from "../utils/responseHandler";

// Seed insurance amounts for cars with null entries (admin only)
export const seedInsuranceAmounts = asyncHandler(
  async (req: Request & { user?: { role?: string } }, res: Response) => {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      throw ApiError.forbidden("Only admins can seed insurance amounts");
    }

    const { defaultAmount = 500 } = req.body;

    try {
      // Find cars with null insurance amounts
      const carsWithNullInsurance = await db
        .select()
        .from(carModel)
        .where(sql`${carModel.insuranceAmount} IS NULL`);

      if (carsWithNullInsurance.length === 0) {
        return sendSuccess(res, { updated: 0 }, "No cars found with null insurance amounts");
      }

      // Update all cars with null insurance amounts
      const updatedCars = await db
        .update(carModel)
        .set({ insuranceAmount: defaultAmount.toString() })
        .where(sql`${carModel.insuranceAmount} IS NULL`)
        .returning();

      return sendSuccess(
        res,
        { updated: updatedCars.length, cars: updatedCars },
        `Updated insurance amounts for ${updatedCars.length} cars`
      );
    } catch (error: any) {
      console.error(`🚗 [SEED_INSURANCE] Database error:`, error);
      throw ApiError.internal("Failed to seed insurance amounts");
    }
  }
);
