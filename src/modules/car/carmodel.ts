import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { reviewModel } from "../review/reviewmodel";
import { UserTable } from "../user/usermodel";
import { parkingTable } from "../parking/parkingmodel";
import { bookingsTable } from "../booking/bookingmodel";
import { array } from "zod";

export const carStatusEnum = pgEnum("car_status", [
  "available",
  "booked",
  "maintenance",
  "unavailable",
  "out_of_service",

]);

export const transmissionEnum = pgEnum("transmission", ["manual", "automatic"]);
export const fuelTypeEnum = pgEnum("fuel_type", [
  "petrol",
  "diesel",
  "electric",
  "hybrid",
]);

// New car catalog table for predefined car models
export const carCatalogTable = pgTable("car_catalog", {
  id: serial("id").primaryKey(),
  carName: varchar("car_name", { length: 255 }).notNull(),
  carMaker: varchar("car_maker", { length: 255 }).notNull(),
  carModelYear: integer("car_model_year").notNull(),
  carVendorPrice: decimal("car_vendor_price", {
    precision: 10,
    scale: 2,
  }).notNull(), // Daily rental price vendor gets
  carPlatformPrice: decimal("car_platform_price", {
    precision: 10,
    scale: 2,
  }).notNull(), // Price customers pay
  transmission: transmissionEnum("transmission").notNull().default("manual"),
  fuelType: fuelTypeEnum("fuel_type").notNull().default("petrol"),
  seats: integer("seats").notNull().default(5),
  engineCapacity: varchar("engine_capacity", { length: 50 }), // e.g., "1.5L", "2.0L"
  mileage: varchar("mileage", { length: 50 }), // e.g., "15 kmpl", "20 kmpl"
  features: varchar("features", { length: 1000 }), // JSON string of features like AC, GPS, etc.
  imageUrl: varchar("image_url", { length: 500 }),
  isActive: boolean("is_active").notNull().default(true),
  category: varchar("category", { length: 100 }).default("sedan"), // sedan, suv, hatchback, luxury, etc.
  estimation: jsonb("estimation")
    .$type<{ location: string; estimatedPrice: number }[]>()
    .notNull()
    .default([]),

  createdBy: integer("created_by").references(() => UserTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const carModel = pgTable("car", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  number: varchar("number", { length: 20 }).notNull().unique(),
  vendorid: integer("vendorid")
    .references(() => UserTable.id, { onDelete: "cascade" })
    .notNull(),
  parkingid: integer("parkingid")
    .references(() => parkingTable.id, { onDelete: "cascade" })
    .notNull(),
  color: varchar("color", { length: 255 }),
  price: integer("price"),
  discountprice: integer("discountprice"),
  halfdayprice: integer("halfdayprice").default(0),
  fineperhour: integer("fineperhour").default(0),
  extensionperhour: integer("extensionperhour").default(0),
  // Insurance amount for the car (default 500)  
  insuranceAmount: decimal("insurance_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  // Restored critical fields
  rcnumber: varchar("rcnumber", { length: 255 }),
  rcimg: varchar("rcimg", { length: 255 }),
  pollutionimg: varchar("pollutionimg", { length: 255 }),
  insuranceimg: varchar("insuranceimg", { length: 255 }),
  // Fixed images to be native PostgreSQL array of strings
  images: varchar("images", { length: 255 }).array(),
  // Reference to car catalog
  catalogId: integer("catalog_id").references(() => carCatalogTable.id, {
    onDelete: "cascade",
  }),
  status: carStatusEnum("status").notNull().default("available"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const carRelations = relations(carModel, ({ one, many }) => ({
  vendor: one(UserTable, {
    fields: [carModel.vendorid],
    references: [UserTable.id],
    relationName: "vendor_cars"
  }),
  parking: one(parkingTable, {
    fields: [carModel.parkingid],
    references: [parkingTable.id],
  }),
  catalog: one(carCatalogTable, {
    fields: [carModel.catalogId],
    references: [carCatalogTable.id],
  }),
  // Add reverse relation for bookings
  bookings: many(bookingsTable),
  // Add reverse relation for reviews
  reviews: many(reviewModel),
}));

export const carCatalogRelations = relations(
  carCatalogTable,
  ({ one, many }) => ({
    creator: one(UserTable, {
      fields: [carCatalogTable.createdBy],
      references: [UserTable.id],
    }),
    cars: many(carModel),
  })
);
