import { Request, Response } from 'express';
import { db } from '../../drizzle/db';
import { carModel, carCatalogTable } from '../car/carmodel';
import { bookingsTable } from '../booking/bookingmodel';
import { UserTable } from '../user/usermodel';
import { parkingTable } from '../parking/parkingmodel';
import { eq, and, or, like, gte, lte, sql, desc, asc, count } from 'drizzle-orm';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';

// Interface for car data with all required fields
interface CarData {
  id: number;
  name: string;
  maker: string;
  year: number;
  carnumber: string;
  price: number;
  insurancePrice: number;
  discountedprice: number;
  color: string;
  transmission: string;
  fuel: string;
  type: string;
  seats: number;
  rcnumber: string;
  rcimg: string;
  pollutionimg: string;
  insuranceimg: string;
  inmaintainance: boolean;
  isavailable: boolean;
  images: string[] | null;
  mainimg: string;
  vendorid: number;
  parkingid: number | null;
  catalogId: number | null;
  // Vendor object with complete details
  vendor?: {
    id: number;
    name: string;
    avatar: string | null;
    email: string | null;
    number: number | null;
  } | null;
  // Parking object with complete details
  parking?: {
    id: number;
    name: string;
    mainimg: string | null;
    locality: string | null;
    city: string | null;
    capacity: number;
  } | null;
  isapproved: boolean;
  ispopular: boolean;
  createdAt: string;
  updatedAt: string;
}

// Interface for car statistics
interface CarStats {
  total: number;
  available: number;
  rented: number;
  maintenance: number;
  outOfService: number;
}

// Interface for search and filter parameters
interface CarFilters {
  search?: string;
  status?: 'all' | 'available' | 'rented' | 'maintenance' | 'out_of_service';
  popularOnly?: boolean;
  startDate?: string;
  endDate?: string;
  // Additional filtering options
  maker?: string;
  type?: string;
  fuel?: string;
  transmission?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  seats?: number;
  color?: string;
  vendorId?: number;
  parkingId?: number;
  limit?: number;
  offset?: number;
}

// Get all cars with comprehensive data
export const getAllCars = asyncHandler(async (req: Request, res: Response) => {
  const {
    search,
    status = 'all',
    popularOnly = false,
    startDate,
    endDate,
    maker,
    type,
    fuel,
    transmission,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    seats,
    color,
    vendorId,
    parkingId,
    limit = 100,
    offset = 0
  } = req.query as CarFilters;

  try {
    // Build where conditions array
    const whereConditions = [];

    // Apply search filter
    if (search) {
      whereConditions.push(
        or(
          like(carModel.name, `%${search}%`),
          like(carCatalogTable.carMaker, `%${search}%`),
          like(carModel.number, `%${search}%`),
          like(carModel.rcnumber, `%${search}%`),
          like(UserTable.name, `%${search}%`)
        )
      );
    }

    // Apply status filter
    if (status !== 'all') {
      if (status === 'available') {
        whereConditions.push(and(eq(carModel.isavailable, true), eq(carModel.inmaintainance, false)));
      } else if (status === 'rented') {
        whereConditions.push(and(eq(carModel.isavailable, false), eq(carModel.inmaintainance, false)));
      } else if (status === 'maintenance') {
        whereConditions.push(eq(carModel.inmaintainance, true));
      } else if (status === 'out_of_service') {
        whereConditions.push(and(eq(carModel.isavailable, false), eq(carModel.inmaintainance, false)));
      }
    }

    // Apply popular filter (assuming popular cars have more bookings)
    if (popularOnly) {
      const popularCarIds = await db
        .select({ carId: bookingsTable.carId })
        .from(bookingsTable)
        .groupBy(bookingsTable.carId)
        .having(sql`COUNT(*) >= 3`); // Cars with 3+ bookings are considered popular

      const popularIds = popularCarIds.map(item => item.carId);
      if (popularIds.length > 0) {
        whereConditions.push(sql`${carModel.id} = ANY(${popularIds})`);
      } else {
        // If no popular cars, return empty result
        whereConditions.push(sql`1 = 0`);
      }
    }

    // Apply date range filter for bookings
    if (startDate && endDate) {
      const bookingCarIds = await db
        .select({ carId: bookingsTable.carId })
        .from(bookingsTable)
        .where(
          and(
            gte(bookingsTable.createdAt, new Date(startDate)),
            lte(bookingsTable.createdAt, new Date(endDate))
          )
        );

      const carIds = bookingCarIds.map(item => item.carId);
      if (carIds.length > 0) {
        whereConditions.push(sql`${carModel.id} = ANY(${carIds})`);
      } else {
        // If no bookings in date range, return empty result
        whereConditions.push(sql`1 = 0`);
      }
    }

    // Apply additional filters
    if (maker) {
      whereConditions.push(like(carCatalogTable.carMaker, `%${maker}%`));
    }

    if (type) {
      whereConditions.push(eq(carCatalogTable.category, type));
    }

    if (fuel) {
      whereConditions.push(eq(carCatalogTable.fuelType, fuel as any));
    }

    if (transmission) {
      whereConditions.push(eq(carCatalogTable.transmission, transmission as any));
    }

    if (minPrice !== undefined) {
      whereConditions.push(gte(carModel.price, minPrice));
    }

    if (maxPrice !== undefined) {
      whereConditions.push(lte(carModel.price, maxPrice));
    }

    if (minYear !== undefined) {
      whereConditions.push(gte(carCatalogTable.carModelYear, minYear));
    }

    if (maxYear !== undefined) {
      whereConditions.push(lte(carCatalogTable.carModelYear, maxYear));
    }

    if (seats !== undefined) {
      whereConditions.push(eq(carCatalogTable.seats, seats));
    }

    if (color) {
      whereConditions.push(like(carModel.color, `%${color}%`));
    }

    if (vendorId !== undefined) {
      whereConditions.push(eq(carModel.vendorid, vendorId));
    }

    if (parkingId !== undefined) {
      whereConditions.push(eq(carModel.parkingid, parkingId));
    }

    // Build the final query with all conditions
    const cars = await db
      .select({
        // Car fields
        id: carModel.id,
        name: carModel.name,
        number: carModel.number,
        color: carModel.color,
        price: carModel.price,
        discountprice: carModel.discountprice,
        insuranceAmount: carModel.insuranceAmount,
        inmaintainance: carModel.inmaintainance,
        isavailable: carModel.isavailable,
        rcnumber: carModel.rcnumber,
        rcimg: carModel.rcimg,
        pollutionimg: carModel.pollutionimg,
        insuranceimg: carModel.insuranceimg,
        images: carModel.images,
        vendorid: carModel.vendorid,
        parkingid: carModel.parkingid,
        catalogId: carModel.catalogId,
        status: carModel.status,
        createdAt: carModel.createdAt,
        updatedAt: carModel.updatedAt,
        // Catalog fields
        maker: carCatalogTable.carMaker,
        year: carCatalogTable.carModelYear,
        transmission: carCatalogTable.transmission,
        fuel: carCatalogTable.fuelType,
        type: carCatalogTable.category,
        seats: carCatalogTable.seats,
        // Vendor fields
        vendorId: UserTable.id,
        vendorName: UserTable.name,
        vendorAvatar: UserTable.avatar,
        vendorEmail: UserTable.email,
        vendorNumber: UserTable.number,
        // Parking fields
        parkingId: parkingTable.id,
        parkingName: parkingTable.name,
        parkingMainImg: parkingTable.mainimg,
        parkingLocality: parkingTable.locality,
        parkingCity: parkingTable.city,
        parkingCapacity: parkingTable.capacity,
      })
      .from(carModel)
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
      .leftJoin(UserTable, eq(carModel.vendorid, UserTable.id))
      .leftJoin(parkingTable, eq(carModel.parkingid, parkingTable.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(carModel.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Transform the data to match frontend interface
    const transformedCars: CarData[] = cars.map(car => ({
      id: car.id,
      name: car.name,
      maker: car.maker || 'Unknown',
      year: car.year || new Date().getFullYear(),
      carnumber: car.number,
      price: car.price,
      insurancePrice: Number(car.insuranceAmount) || 0,
      discountedprice: car.discountprice || car.price,
      color: car.color || 'Unknown',
      transmission: car.transmission || 'manual',
      fuel: car.fuel || 'petrol',
      type: car.type || 'sedan',
      seats: car.seats || 5,
      rcnumber: car.rcnumber || '',
      rcimg: car.rcimg || '',
      pollutionimg: car.pollutionimg || '',
      insuranceimg: car.insuranceimg || '',
      inmaintainance: car.inmaintainance,
      isavailable: car.isavailable,
      images: car.images || null,
      mainimg: car.images?.[0] || '',
      vendorid: car.vendorid,
      parkingid: car.parkingid,
      catalogId: car.catalogId,
      // Vendor object with complete details
      vendor: car.vendorId ? {
        id: car.vendorId,
        name: car.vendorName || 'Unknown Vendor',
        avatar: car.vendorAvatar || null,
        email: car.vendorEmail || null,
        number: car.vendorNumber || null
      } : null,
      // Parking object with complete details
      parking: car.parkingId ? {
        id: car.parkingId,
        name: car.parkingName || 'Unknown Parking',
        mainimg: car.parkingMainImg || null,
        locality: car.parkingLocality || null,
        city: car.parkingCity || null,
        capacity: car.parkingCapacity || 0
      } : null,
      isapproved: true, // Assuming all cars are approved
      ispopular: false, // Will be calculated separately if needed
      createdAt: car.createdAt.toISOString(),
      updatedAt: car.updatedAt.toISOString(),
    }));

    return res.status(200).json(
      new ApiResponse(200, transformedCars, 'Cars retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching cars:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch cars')
    );
  }
});

// Get car statistics
export const getCarStats = asyncHandler(async (req: Request, res: Response) => {
  try {
    const [totalResult, availableResult, rentedResult, maintenanceResult] = await Promise.all([
      db.select({ count: count() }).from(carModel),
      db.select({ count: count() }).from(carModel).where(and(eq(carModel.isavailable, true), eq(carModel.inmaintainance, false))),
      db.select({ count: count() }).from(carModel).where(and(eq(carModel.isavailable, false), eq(carModel.inmaintainance, false))),
      db.select({ count: count() }).from(carModel).where(eq(carModel.inmaintainance, true))
    ]);

    const stats: CarStats = {
      total: totalResult[0]?.count || 0,
      available: availableResult[0]?.count || 0,
      rented: rentedResult[0]?.count || 0,
      maintenance: maintenanceResult[0]?.count || 0,
      outOfService: 0 // Same as rented for now
    };

    return res.status(200).json(
      new ApiResponse(200, stats, 'Car statistics retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching car stats:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch car statistics')
    );
  }
});

// Get single car details
export const getCarById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const car = await db
      .select({
        // Car fields
        id: carModel.id,
        name: carModel.name,
        number: carModel.number,
        color: carModel.color,
        price: carModel.price,
        discountprice: carModel.discountprice,
        insuranceAmount: carModel.insuranceAmount,
        inmaintainance: carModel.inmaintainance,
        isavailable: carModel.isavailable,
        rcnumber: carModel.rcnumber,
        rcimg: carModel.rcimg,
        pollutionimg: carModel.pollutionimg,
        insuranceimg: carModel.insuranceimg,
        images: carModel.images,
        vendorid: carModel.vendorid,
        parkingid: carModel.parkingid,
        catalogId: carModel.catalogId,
        status: carModel.status,
        createdAt: carModel.createdAt,
        updatedAt: carModel.updatedAt,
        // Catalog fields
        maker: carCatalogTable.carMaker,
        year: carCatalogTable.carModelYear,
        transmission: carCatalogTable.transmission,
        fuel: carCatalogTable.fuelType,
        type: carCatalogTable.category,
        seats: carCatalogTable.seats,
        // Vendor fields
        vendorId: UserTable.id,
        vendorName: UserTable.name,
        vendorAvatar: UserTable.avatar,
        vendorEmail: UserTable.email,
        vendorNumber: UserTable.number,
        // Parking fields
        parkingId: parkingTable.id,
        parkingName: parkingTable.name,
        parkingMainImg: parkingTable.mainimg,
        parkingLocality: parkingTable.locality,
        parkingCity: parkingTable.city,
        parkingCapacity: parkingTable.capacity,
      })
      .from(carModel)
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
      .leftJoin(UserTable, eq(carModel.vendorid, UserTable.id))
      .leftJoin(parkingTable, eq(carModel.parkingid, parkingTable.id))
      .where(eq(carModel.id, Number(id)))
      .limit(1);

    if (car.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Car not found')
      );
    }

    const carData = car[0];
    const transformedCar: CarData = {
      id: carData.id,
      name: carData.name,
      maker: carData.maker || 'Unknown',
      year: carData.year || new Date().getFullYear(),
      carnumber: carData.number,
      price: carData.price,
      insurancePrice: Number(carData.insuranceAmount) || 0,
      discountedprice: carData.discountprice || carData.price,
      color: carData.color || 'Unknown',
      transmission: carData.transmission || 'manual',
      fuel: carData.fuel || 'petrol',
      type: carData.type || 'sedan',
      seats: carData.seats || 5,
      rcnumber: carData.rcnumber || '',
      rcimg: carData.rcimg || '',
      pollutionimg: carData.pollutionimg || '',
      insuranceimg: carData.insuranceimg || '',
      inmaintainance: carData.inmaintainance,
      isavailable: carData.isavailable,
      images: carData.images || null,
      mainimg: carData.images?.[0] || '',
      vendorid: carData.vendorid,
      parkingid: carData.parkingid,
      catalogId: carData.catalogId,
      // Vendor object with complete details
      vendor: carData.vendorId ? {
        id: carData.vendorId,
        name: carData.vendorName || 'Unknown Vendor',
        avatar: carData.vendorAvatar || null,
        email: carData.vendorEmail || null,
        number: carData.vendorNumber || null
      } : null,
      // Parking object with complete details
      parking: carData.parkingId ? {
        id: carData.parkingId,
        name: carData.parkingName || 'Unknown Parking',
        mainimg: carData.parkingMainImg || null,
        locality: carData.parkingLocality || null,
        city: carData.parkingCity || null,
        capacity: carData.parkingCapacity || 0
      } : null,
      isapproved: true,
      ispopular: false,
      createdAt: carData.createdAt.toISOString(),
      updatedAt: carData.updatedAt.toISOString(),
    };

    return res.status(200).json(
      new ApiResponse(200, transformedCar, 'Car details retrieved successfully')
    );
  } catch (error) {
    console.error('Error fetching car details:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to fetch car details')
    );
  }
});

// Update car information (Admin only)
export const updateCar = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    // First, check if the car exists
    const existingCar = await db
      .select()
      .from(carModel)
      .where(eq(carModel.id, Number(id)))
      .limit(1);

    if (existingCar.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Car not found')
      );
    }

    const car = existingCar[0];

    // Prepare update data for car table
    const carUpdateData: any = {};
    
    // Map the incoming data to car model fields
    if (updateData.name !== undefined) carUpdateData.name = updateData.name;
    if (updateData.price !== undefined) carUpdateData.price = updateData.price;
    if (updateData.discountprice !== undefined) carUpdateData.discountprice = updateData.discountprice;
    if (updateData.insuranceAmount !== undefined) carUpdateData.insuranceAmount = updateData.insuranceAmount;
    if (updateData.color !== undefined) carUpdateData.color = updateData.color;
    if (updateData.rcnumber !== undefined) carUpdateData.rcnumber = updateData.rcnumber;
    if (updateData.rcimg !== undefined) carUpdateData.rcimg = updateData.rcimg;
    if (updateData.pollutionimg !== undefined) carUpdateData.pollutionimg = updateData.pollutionimg;
    if (updateData.insuranceimg !== undefined) carUpdateData.insuranceimg = updateData.insuranceimg;
    if (updateData.images !== undefined) carUpdateData.images = updateData.images;
    if (updateData.vendorid !== undefined) carUpdateData.vendorid = updateData.vendorid;
    if (updateData.parkingid !== undefined) carUpdateData.parkingid = updateData.parkingid;
    if (updateData.isavailable !== undefined) carUpdateData.isavailable = updateData.isavailable;
    if (updateData.inmaintainance !== undefined) carUpdateData.inmaintainance = updateData.inmaintainance;
    if (updateData.status !== undefined) carUpdateData.status = updateData.status;

    // Update car number if provided
    if (updateData.carnumber !== undefined) carUpdateData.number = updateData.carnumber;

    // Update car table
    if (Object.keys(carUpdateData).length > 0) {
      await db
        .update(carModel)
        .set(carUpdateData)
        .where(eq(carModel.id, Number(id)));
    }

    // Prepare update data for catalog table
    const catalogUpdateData: any = {};
    
    if (updateData.maker !== undefined) catalogUpdateData.carMaker = updateData.maker;
    if (updateData.year !== undefined) catalogUpdateData.carModelYear = updateData.year;
    if (updateData.transmission !== undefined) catalogUpdateData.transmission = updateData.transmission;
    if (updateData.fuel !== undefined) catalogUpdateData.fuelType = updateData.fuel;
    if (updateData.seats !== undefined) catalogUpdateData.seats = updateData.seats;
    if (updateData.type !== undefined) catalogUpdateData.category = updateData.type;
    if (updateData.engineCapacity !== undefined) catalogUpdateData.engineCapacity = updateData.engineCapacity;
    if (updateData.mileage !== undefined) catalogUpdateData.mileage = updateData.mileage;
    if (updateData.features !== undefined) catalogUpdateData.features = updateData.features;

    // Update catalog table if there's data to update
    if (Object.keys(catalogUpdateData).length > 0 && car.catalogId) {
      await db
        .update(carCatalogTable)
        .set(catalogUpdateData)
        .where(eq(carCatalogTable.id, car.catalogId));
    }

    // Get the updated car with all related data
    const updatedCar = await db
      .select({
        // Car fields
        id: carModel.id,
        name: carModel.name,
        number: carModel.number,
        color: carModel.color,
        price: carModel.price,
        discountprice: carModel.discountprice,
        insuranceAmount: carModel.insuranceAmount,
        inmaintainance: carModel.inmaintainance,
        isavailable: carModel.isavailable,
        rcnumber: carModel.rcnumber,
        rcimg: carModel.rcimg,
        pollutionimg: carModel.pollutionimg,
        insuranceimg: carModel.insuranceimg,
        images: carModel.images,
        vendorid: carModel.vendorid,
        parkingid: carModel.parkingid,
        catalogId: carModel.catalogId,
        status: carModel.status,
        createdAt: carModel.createdAt,
        updatedAt: carModel.updatedAt,
        // Catalog fields
        maker: carCatalogTable.carMaker,
        year: carCatalogTable.carModelYear,
        transmission: carCatalogTable.transmission,
        fuel: carCatalogTable.fuelType,
        type: carCatalogTable.category,
        seats: carCatalogTable.seats,
        // Vendor fields
        vendorId: UserTable.id,
        vendorName: UserTable.name,
        vendorAvatar: UserTable.avatar,
        vendorEmail: UserTable.email,
        vendorNumber: UserTable.number,
        // Parking fields
        parkingId: parkingTable.id,
        parkingName: parkingTable.name,
        parkingMainImg: parkingTable.mainimg,
        parkingLocality: parkingTable.locality,
        parkingCity: parkingTable.city,
        parkingCapacity: parkingTable.capacity,
      })
      .from(carModel)
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
      .leftJoin(UserTable, eq(carModel.vendorid, UserTable.id))
      .leftJoin(parkingTable, eq(carModel.parkingid, parkingTable.id))
      .where(eq(carModel.id, Number(id)))
      .limit(1);

    if (updatedCar.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Car not found after update')
      );
    }

    const carData = updatedCar[0];
    const transformedCar: CarData = {
      id: carData.id,
      name: carData.name,
      maker: carData.maker || 'Unknown',
      year: carData.year || new Date().getFullYear(),
      carnumber: carData.number,
      price: carData.price,
      insurancePrice: Number(carData.insuranceAmount) || 0,
      discountedprice: carData.discountprice || carData.price,
      color: carData.color || 'Unknown',
      transmission: carData.transmission || 'manual',
      fuel: carData.fuel || 'petrol',
      type: carData.type || 'sedan',
      seats: carData.seats || 5,
      rcnumber: carData.rcnumber || '',
      rcimg: carData.rcimg || '',
      pollutionimg: carData.pollutionimg || '',
      insuranceimg: carData.insuranceimg || '',
      inmaintainance: carData.inmaintainance,
      isavailable: carData.isavailable,
      images: carData.images || null,
      mainimg: carData.images?.[0] || '',
      vendorid: carData.vendorid,
      parkingid: carData.parkingid,
      catalogId: carData.catalogId,
      // Vendor object with complete details
      vendor: carData.vendorId ? {
        id: carData.vendorId,
        name: carData.vendorName || 'Unknown Vendor',
        avatar: carData.vendorAvatar || null,
        email: carData.vendorEmail || null,
        number: carData.vendorNumber || null
      } : null,
      // Parking object with complete details
      parking: carData.parkingId ? {
        id: carData.parkingId,
        name: carData.parkingName || 'Unknown Parking',
        mainimg: carData.parkingMainImg || null,
        locality: carData.parkingLocality || null,
        city: carData.parkingCity || null,
        capacity: carData.parkingCapacity || 0
      } : null,
      isapproved: true,
      ispopular: false,
      createdAt: carData.createdAt.toISOString(),
      updatedAt: carData.updatedAt.toISOString(),
    };

    return res.status(200).json(
      new ApiResponse(200, transformedCar, 'Car updated successfully')
    );
  } catch (error) {
    console.error('Error updating car:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to update car')
    );
  }
});

// Update car status
export const updateCarStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    let updateData: any = {};
    
    if (status === 'available') {
      updateData = { isavailable: true, inmaintainance: false };
    } else if (status === 'rented') {
      updateData = { isavailable: false, inmaintainance: false };
    } else if (status === 'maintenance') {
      updateData = { inmaintainance: true, isavailable: false };
    } else if (status === 'out_of_service') {
      updateData = { isavailable: false, inmaintainance: false };
    }

    const updatedCar = await db
      .update(carModel)
      .set(updateData)
      .where(eq(carModel.id, Number(id)))
      .returning();

    if (updatedCar.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Car not found')
      );
    }

    return res.status(200).json(
      new ApiResponse(200, updatedCar[0], 'Car status updated successfully')
    );
  } catch (error) {
    console.error('Error updating car status:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to update car status')
    );
  }
});

// Delete car
export const deleteCar = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deletedCar = await db
      .delete(carModel)
      .where(eq(carModel.id, Number(id)))
      .returning();

    if (deletedCar.length === 0) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Car not found')
      );
    }

    return res.status(200).json(
      new ApiResponse(200, null, 'Car deleted successfully')
    );
  } catch (error) {
    console.error('Error deleting car:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to delete car')
    );
  }
});

// Get cars by booking date range
export const getCarsByBookingDateRange = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.body;

  try {
    if (!startDate || !endDate) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Start date and end date are required')
      );
    }

    const bookingCarIds = await db
      .select({ carId: bookingsTable.carId })
      .from(bookingsTable)
      .where(
        and(
          gte(bookingsTable.createdAt, new Date(startDate)),
          lte(bookingsTable.createdAt, new Date(endDate))
        )
      );

    const carIds = bookingCarIds.map(item => item.carId);

    if (carIds.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, [], 'No cars found for the specified date range')
      );
    }

    // Get car details for the filtered car IDs
    const cars = await db
      .select({
        id: carModel.id,
        name: carModel.name,
        number: carModel.number,
        color: carModel.color,
        price: carModel.price,
        discountprice: carModel.discountprice,
        insuranceAmount: carModel.insuranceAmount,
        inmaintainance: carModel.inmaintainance,
        isavailable: carModel.isavailable,
        rcnumber: carModel.rcnumber,
        rcimg: carModel.rcimg,
        pollutionimg: carModel.pollutionimg,
        insuranceimg: carModel.insuranceimg,
        images: carModel.images,
        vendorid: carModel.vendorid,
        parkingid: carModel.parkingid,
        catalogId: carModel.catalogId,
        status: carModel.status,
        createdAt: carModel.createdAt,
        updatedAt: carModel.updatedAt,
        // Catalog fields
        maker: carCatalogTable.carMaker,
        year: carCatalogTable.carModelYear,
        transmission: carCatalogTable.transmission,
        fuel: carCatalogTable.fuelType,
        type: carCatalogTable.category,
        seats: carCatalogTable.seats,
        // Vendor fields
        vendorName: UserTable.name,
        // Parking fields
        parkingName: parkingTable.name,
      })
      .from(carModel)
      .leftJoin(carCatalogTable, eq(carModel.catalogId, carCatalogTable.id))
      .leftJoin(UserTable, eq(carModel.vendorid, UserTable.id))
      .leftJoin(parkingTable, eq(carModel.parkingid, parkingTable.id))
      .where(sql`${carModel.id} = ANY(${carIds})`);

    // Transform the data
    const transformedCars: CarData[] = cars.map(car => ({
      id: car.id,
      name: car.name,
      maker: car.maker || 'Unknown',
      year: car.year || new Date().getFullYear(),
      carnumber: car.number,
      price: car.price,
      insurancePrice: Number(car.insuranceAmount) || 0,
      discountedprice: car.discountprice || car.price,
      color: car.color || 'Unknown',
      transmission: car.transmission || 'manual',
      fuel: car.fuel || 'petrol',
      type: car.type || 'sedan',
      seats: car.seats || 5,
      rcnumber: car.rcnumber || '',
      rcimg: car.rcimg || '',
      pollutionimg: car.pollutionimg || '',
      insuranceimg: car.insuranceimg || '',
      inmaintainance: car.inmaintainance,
      isavailable: car.isavailable,
      images: car.images || null,
      mainimg: car.images?.[0] || '',
      vendorid: car.vendorid,
      parkingid: car.parkingid,
      catalogId: car.catalogId,
      isapproved: true,
      ispopular: false,
      createdAt: car.createdAt.toISOString(),
      updatedAt: car.updatedAt.toISOString(),
    }));

    return res.status(200).json(
      new ApiResponse(200, transformedCars, 'Cars filtered by booking date range successfully')
    );
  } catch (error) {
    console.error('Error filtering cars by booking date range:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Failed to filter cars by booking date range')
    );
  }
});
