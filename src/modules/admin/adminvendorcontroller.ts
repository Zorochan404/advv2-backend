import { Request, Response } from "express";
import { db } from "../../drizzle/db";
import { UserTable, vendorRelations } from "../user/usermodel";
import { carModel as car } from "../car/carmodel";
import { eq, and, or, like, count, desc, sql, exists } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiResponse";
import bcrypt from "bcryptjs";

// ========================================
// VENDOR MANAGEMENT CONTROLLERS
// ========================================

// Get all users who have created cars (vendors + admins with cars)
export const getAllVendors = asyncHandler(async (req: Request, res: Response) => {
  const { search, limit = 20, offset = 0 } = req.query as {
    search?: string;
    limit?: number;
    offset?: number;
  };

  try {
    // Build where conditions - get users who either:
    // 1. Have role = 'vendor' OR
    // 2. Have created at least one car (regardless of role)
    const whereConditions = [
      or(
        eq(UserTable.role, 'vendor'),
        exists(
          db.select().from(car).where(eq(car.vendorid, UserTable.id))
        )
      )!
    ];

    // Add search condition if provided
    if (search) {
      whereConditions.push(
        or(
          like(UserTable.name, `%${search}%`),
          like(UserTable.email, `%${search}%`),
          sql`CAST(${UserTable.number} AS TEXT) LIKE ${`%${search}%`}`
        )!
      );
    }

    // Get users with pagination and populate cars
    const users = await db
      .select({
        id: UserTable.id,
        name: UserTable.name,
        email: UserTable.email,
        number: UserTable.number,
        avatar: UserTable.avatar,
        age: UserTable.age,
        aadharNumber: UserTable.aadharNumber,
        aadharimg: UserTable.aadharimg,
        dlNumber: UserTable.dlNumber,
        dlimg: UserTable.dlimg,
        passportNumber: UserTable.passportNumber,
        passportimg: UserTable.passportimg,
        locality: UserTable.locality,
        city: UserTable.city,
        state: UserTable.state,
        country: UserTable.country,
        pincode: UserTable.pincode,
        isverified: UserTable.isverified,
        role: UserTable.role,
        createdAt: UserTable.createdAt,
        updatedAt: UserTable.updatedAt,
      })
      .from(UserTable)
      .where(and(...whereConditions))
      .orderBy(desc(UserTable.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Get total count for pagination
    const totalResult = await db
      .select({ count: count() })
      .from(UserTable)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get car count and cars for each user
    const usersWithCars = await Promise.all(
      users.map(async (user) => {
        // Get cars for this user
        const userCars = await db
          .select({
            id: car.id,
            name: car.name,
            number: car.number,
            price: car.price,
            isavailable: car.isavailable,
            inmaintainance: car.inmaintainance,
            status: car.status,
            images: car.images,
            createdAt: car.createdAt,
            updatedAt: car.updatedAt,
          })
          .from(car)
          .where(eq(car.vendorid, user.id))
          .orderBy(desc(car.createdAt));

        return {
          ...user,
          carCount: userCars.length,
          cars: userCars,
        };
      })
    );

    return res.status(200).json(
      new ApiResponse(200, {
        vendors: usersWithCars,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      }, "Vendors retrieved successfully")
    );
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch vendors')
    );
  }
});

// Get vendor by ID
export const getVendorById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const vendor = await db
      .select({
        id: UserTable.id,
        name: UserTable.name,
        email: UserTable.email,
        number: UserTable.number,
        avatar: UserTable.avatar,
        age: UserTable.age,
        aadharNumber: UserTable.aadharNumber,
        aadharimg: UserTable.aadharimg,
        dlNumber: UserTable.dlNumber,
        dlimg: UserTable.dlimg,
        passportNumber: UserTable.passportNumber,
        passportimg: UserTable.passportimg,
        locality: UserTable.locality,
        city: UserTable.city,
        state: UserTable.state,
        country: UserTable.country,
        pincode: UserTable.pincode,
        isverified: UserTable.isverified,
        role: UserTable.role,
        createdAt: UserTable.createdAt,
        updatedAt: UserTable.updatedAt,
      })
      .from(UserTable)
      .where(and(
        eq(UserTable.id, Number(id)),
        or(
          eq(UserTable.role, 'vendor'),
          exists(
            db.select().from(car).where(eq(car.vendorid, UserTable.id))
          )
        )!
      ))
      .limit(1);

    if (vendor.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Vendor not found')
      );
    }

    // Get cars for this vendor
    const userCars = await db
      .select({
        id: car.id,
        name: car.name,
        number: car.number,
        price: car.price,
        isavailable: car.isavailable,
        inmaintainance: car.inmaintainance,
        status: car.status,
        images: car.images,
        createdAt: car.createdAt,
        updatedAt: car.updatedAt,
      })
      .from(car)
      .where(eq(car.vendorid, Number(id)))
      .orderBy(desc(car.createdAt));

    const vendorWithCars = {
      ...vendor[0],
      carCount: userCars.length,
      cars: userCars,
    };

    return res.status(200).json(
      new ApiResponse(200, vendorWithCars, "Vendor retrieved successfully")
    );
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch vendor')
    );
  }
});

// Create new vendor
export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    email,
    number,
    password,
    age,
    aadharNumber,
    aadharimg,
    dlNumber,
    dlimg,
    passportNumber,
    passportimg,
    locality,
    city,
    state,
    country,
    pincode,
    isverified = false,
    role = 'vendor'
  } = req.body;

  try {
    // Check if vendor with email already exists
    const existingVendor = await db
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(eq(UserTable.email, email))
      .limit(1);

    if (existingVendor.length > 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Vendor with this email already exists')
      );
    }

    // Hash password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 12) : '123456';

    // Create vendor
    const newVendor = await db
      .insert(UserTable)
      .values({
        name: name || null,
        email: email || null,
        number: Number(number),
        password: hashedPassword,
        age: age || null,
        aadharNumber: aadharNumber || null,
        aadharimg: aadharimg || null,
        dlNumber: dlNumber || null,
        dlimg: dlimg || null,
        passportNumber: passportNumber || null,
        passportimg: passportimg || null,
        locality: locality || null,
        city: city || null,
        state: state || null,
        country: country || null,
        pincode: Number(pincode) || null,
        isverified: isverified || false,
        role: 'vendor',
      })
      .returning({
        id: UserTable.id,
        name: UserTable.name,
        email: UserTable.email,
        number: UserTable.number,
        avatar: UserTable.avatar,
        age: UserTable.age,
        aadharNumber: UserTable.aadharNumber,
        aadharimg: UserTable.aadharimg,
        dlNumber: UserTable.dlNumber,
        dlimg: UserTable.dlimg,
        passportNumber: UserTable.passportNumber,
        passportimg: UserTable.passportimg,
        locality: UserTable.locality,
        city: UserTable.city,
        state: UserTable.state,
        country: UserTable.country,
        pincode: UserTable.pincode,
        isverified: UserTable.isverified,
        role: UserTable.role,
        createdAt: UserTable.createdAt,
        updatedAt: UserTable.updatedAt,
      });

    return res.status(201).json(
      new ApiResponse(201, newVendor[0], "Vendor created successfully")
    );
  } catch (error) {
    console.error('Error creating vendor:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to create vendor')
    );
  }
});

// Update vendor
export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    // Check if vendor exists
    const existingVendor = await db
      .select({ id: UserTable.id, email: UserTable.email })
      .from(UserTable)
      .where(and(
        eq(UserTable.id, Number(id)),
        or(
          eq(UserTable.role, 'vendor'),
          exists(
            db.select().from(car).where(eq(car.vendorid, UserTable.id))
          )
        )!
      ))
      .limit(1);

    if (existingVendor.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Vendor not found')
      );
    }

    // Check if email is being changed and if new email already exists
    if (updateData.email && updateData.email !== existingVendor[0].email) {
      const emailExists = await db
        .select({ id: UserTable.id })
        .from(UserTable)
        .where(eq(UserTable.email, updateData.email))
        .limit(1);

      if (emailExists.length > 0) {
        return res.status(400).json(
          new ApiResponse(400, null, 'Vendor with this email already exists')
        );
      }
    }

    // Hash password if provided
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    // Prepare update data
    const updateFields: any = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    // Convert number fields
    if (updateData.number) updateFields.number = Number(updateData.number);
    if (updateData.pincode) updateFields.pincode = Number(updateData.pincode);
    if (updateData.age) updateFields.age = Number(updateData.age);

    // Map field names to database column names
    if (updateData.aadharimg) updateFields.aadharimg = updateData.aadharimg;
    if (updateData.dlimg) updateFields.dlimg = updateData.dlimg;
    if (updateData.passportimg) updateFields.passportimg = updateData.passportimg;
    if (updateData.isverified !== undefined) updateFields.isverified = updateData.isverified;

    // Remove fields that shouldn't be updated
    delete updateFields.aadharimg;
    delete updateFields.dlimg;
    delete updateFields.passportimg;
    delete updateFields.isverified;

    // Update vendor
    const updatedVendor = await db
      .update(UserTable)
      .set(updateFields)
      .where(eq(UserTable.id, Number(id)))
      .returning({
        id: UserTable.id,
        name: UserTable.name,
        email: UserTable.email,
        number: UserTable.number,
        avatar: UserTable.avatar,
        age: UserTable.age,
        aadharNumber: UserTable.aadharNumber,
        aadharimg: UserTable.aadharimg,
        dlNumber: UserTable.dlNumber,
        dlimg: UserTable.dlimg,
        passportNumber: UserTable.passportNumber,
        passportimg: UserTable.passportimg,
        locality: UserTable.locality,
        city: UserTable.city,
        state: UserTable.state,
        country: UserTable.country,
        pincode: UserTable.pincode,
        isverified: UserTable.isverified,
        role: UserTable.role,
        createdAt: UserTable.createdAt,
        updatedAt: UserTable.updatedAt,
      });

    return res.status(200).json(
      new ApiResponse(200, updatedVendor[0], "Vendor updated successfully")
    );
  } catch (error) {
    console.error('Error updating vendor:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to update vendor')
    );
  }
});

// Delete vendor
export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Check if vendor exists
    const existingVendor = await db
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(and(
        eq(UserTable.id, Number(id)),
        or(
          eq(UserTable.role, 'vendor'),
          exists(
            db.select().from(car).where(eq(car.vendorid, UserTable.id))
          )
        )!
      ))
      .limit(1);

    if (existingVendor.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Vendor not found')
      );
    }

    // Check if vendor has cars
    const vendorCars = await db
      .select({ count: count() })
      .from(car)
      .where(eq(car.vendorid, Number(id)));

    if (vendorCars[0]?.count > 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Cannot delete vendor with existing cars. Please remove all cars first.')
      );
    }

    // Delete vendor
    await db
      .delete(UserTable)
      .where(eq(UserTable.id, Number(id)));

    return res.status(200).json(
      new ApiResponse(200, null, "Vendor deleted successfully")
    );
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to delete vendor')
    );
  }
});

// Get all cars added by a specific vendor
export const getVendorCars = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Check if vendor exists
    const existingVendor = await db
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(and(
        eq(UserTable.id, Number(id)),
        or(
          eq(UserTable.role, 'vendor'),
          exists(
            db.select().from(car).where(eq(car.vendorid, UserTable.id))
          )
        )!
      ))
      .limit(1);

    if (existingVendor.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Vendor not found')
      );
    }

    // Get vendor's cars
    const vendorCars = await db
      .select({
        id: car.id,
        name: car.name,
        model: car.name, // Using name as model for now
        licensePlate: car.number,
        mainimg: car.images,
        isavailable: car.isavailable,
        inmaintainance: car.inmaintainance,
        createdAt: car.createdAt,
        vendorId: car.vendorid,
      })
      .from(car)
      .where(eq(car.vendorid, Number(id)))
      .orderBy(desc(car.createdAt));

    return res.status(200).json(
      new ApiResponse(200, vendorCars, "Vendor cars retrieved successfully")
    );
  } catch (error) {
    console.error('Error fetching vendor cars:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch vendor cars')
    );
  }
});

// Get vendor statistics
export const getVendorStats = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get total users who have created cars (vendors + admins with cars)
    const totalVendorsResult = await db
      .select({ count: count() })
      .from(UserTable)
      .where(
        or(
          eq(UserTable.role, 'vendor'),
          exists(
            db.select().from(car).where(eq(car.vendorid, UserTable.id))
          )
        )!
      );

    // Get verified vendors
    const verifiedVendorsResult = await db
      .select({ count: count() })
      .from(UserTable)
      .where(and(
        or(
          eq(UserTable.role, 'vendor'),
          exists(
            db.select().from(car).where(eq(car.vendorid, UserTable.id))
          )
        )!,
        eq(UserTable.isverified, true)
      ));

    // Get pending vendors
    const pendingVendorsResult = await db
      .select({ count: count() })
      .from(UserTable)
      .where(and(
        or(
          eq(UserTable.role, 'vendor'),
          exists(
            db.select().from(car).where(eq(car.vendorid, UserTable.id))
          )
        )!,
        eq(UserTable.isverified, false)
      ));

    // Get total cars
    const totalCarsResult = await db
      .select({ count: count() })
      .from(car);

    const totalVendors = totalVendorsResult[0]?.count || 0;
    const verifiedVendors = verifiedVendorsResult[0]?.count || 0;
    const pendingVendors = pendingVendorsResult[0]?.count || 0;
    const totalCars = totalCarsResult[0]?.count || 0;
    const averageCarsPerVendor = totalVendors > 0 ? Math.round((totalCars / totalVendors) * 10) / 10 : 0;

    const stats = {
      totalVendors,
      verifiedVendors,
      pendingVendors,
      totalCars,
      averageCarsPerVendor,
    };

    return res.status(200).json(
      new ApiResponse(200, stats, "Vendor statistics retrieved successfully")
    );
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch vendor statistics')
    );
  }
});
