import {
  pgTable,
  serial,
  varchar,
  integer,
  bigint,
  timestamp,
  pgEnum,
  boolean,
  text,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { parkingTable } from "../parking/parkingmodel";
import { bookingsTable } from "../booking/bookingmodel";
import { carModel } from "../car/carmodel";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "admin",
  "vendor",
  "parkingincharge",
]);

export const UserTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name"),
  avatar: varchar("avatar"),
  age: integer("age"),
  number: bigint("number", { mode: "number" }),
  email: varchar("email"),
  password: varchar("password").default("123456"),
  aadharNumber: varchar("aadhar_number"),
  aadharimg: varchar("aadhar_img"),
  dlNumber: varchar("dl_number"),
  dlimg: varchar("dl_img"),
  passportNumber: varchar("passport_number"),
  passportimg: varchar("passport_img"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locality: varchar("locality"),
  city: varchar("city"),
  state: varchar("state"),
  country: varchar("country"),
  pincode: integer("pincode"),
  role: userRoleEnum("role").default("user"),
  isverified: boolean("is_verified").default(false),
  parkingid: integer("parkingid").references(() => parkingTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Note: The relation to cars is defined in the car model to avoid circular imports
export const vendorRelations = relations(UserTable, ({ one, many }) => ({
  parking: one(parkingTable, {
    fields: [UserTable.parkingid],
    references: [parkingTable.id],
  }),
  // Add reverse relation for bookings
  bookings: many(bookingsTable),
  // Add relation to cars - users who have created cars
  cars: many(carModel, {
    relationName: "vendor_cars"
  }),
}));
