import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  jsonb,
  doublePrecision,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { UserTable } from "../user/usermodel";
import { bookingsTable } from "../booking/bookingmodel";

export const parkingTable = pgTable("parkings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  locality: varchar("locality"),
  city: varchar("city"),
  state: varchar("state"),
  country: varchar("country"),
  pincode: integer("pincode"),
  capacity: integer("capacity").notNull(),
  mainimg: varchar("mainimg", { length: 255 }).notNull(),
  images: jsonb("images").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New table for parking approval requests
export const parkingApprovalTable = pgTable("parking_approvals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => UserTable.id, { onDelete: "cascade" })
    .notNull(),
  parkingName: varchar("parking_name", { length: 255 }).notNull(),
  locality: varchar("locality"),
  city: varchar("city"),
  state: varchar("state"),
  country: varchar("country"),
  pincode: integer("pincode"),
  capacity: integer("capacity").notNull(),
  mainimg: varchar("mainimg", { length: 255 }).notNull(),
  images: jsonb("images").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  status: varchar("status", { length: 50 }).default("pending"), // pending, approved, rejected
  adminComments: text("admin_comments"),
  approvedBy: integer("approved_by").references(() => UserTable.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relations for parking table
export const parkingRelations = relations(parkingTable, ({ many }) => ({
  // Add reverse relations for bookings
  pickupBookings: many(bookingsTable, {
    relationName: "pickupParking",
  }),
  dropoffBookings: many(bookingsTable, {
    relationName: "dropoffParking",
  }),
}));

// Define relations for parking approval table
export const parkingApprovalRelations = relations(
  parkingApprovalTable,
  ({ one }) => ({
    user: one(UserTable, {
      fields: [parkingApprovalTable.userId],
      references: [UserTable.id],
    }),
    approvedByAdmin: one(UserTable, {
      fields: [parkingApprovalTable.approvedBy],
      references: [UserTable.id],
    }),
  })
);
