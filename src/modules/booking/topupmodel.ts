import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { UserTable } from "../user/usermodel";
import { bookingsTable } from "./bookingmodel";

export const topupTable = pgTable("topups", {
  id: serial("id").primaryKey(),

  // Topup details
  name: varchar("name", { length: 100 }).notNull(), // e.g., "2 Hour Extension", "1 Day Extension"
  description: varchar("description", { length: 500 }),
  duration: integer("duration").notNull(), // Duration in hours
  price: doublePrecision("price").notNull(),

  // Topup categories
  category: varchar("category", { length: 50 }).default("extension"), // extension, emergency, premium
  isActive: boolean("is_active").default(true),

  // Admin control
  createdBy: integer("created_by").references(() => UserTable.id),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const topupRelations = relations(topupTable, ({ one, many }) => ({
  creator: one(UserTable, {
    fields: [topupTable.createdBy],
    references: [UserTable.id],
  }),
  bookings: many(bookingsTable),
}));

// Booking topup usage tracking
export const bookingTopupTable = pgTable("booking_topups", {
  id: serial("id").primaryKey(),

  // Foreign keys
  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  topupId: integer("topup_id")
    .notNull()
    .references(() => topupTable.id, { onDelete: "cascade" }),

  // Usage details
  appliedAt: timestamp("applied_at").notNull(),
  originalEndDate: timestamp("original_end_date").notNull(),
  newEndDate: timestamp("new_end_date").notNull(),
  amount: doublePrecision("amount").notNull(),

  // Payment
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending"),
  paymentReferenceId: varchar("payment_reference_id", { length: 100 }),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookingTopupRelations = relations(
  bookingTopupTable,
  ({ one }) => ({
    booking: one(bookingsTable, {
      fields: [bookingTopupTable.bookingId],
      references: [bookingsTable.id],
    }),
    topup: one(topupTable, {
      fields: [bookingTopupTable.topupId],
      references: [topupTable.id],
    }),
  })
);
