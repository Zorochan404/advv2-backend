import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
  pgEnum,
  decimal,
} from "drizzle-orm/pg-core";
import { UserTable } from "../user/usermodel";

export const couponStatusEnum = pgEnum("coupon_status", [
  "active",
  "inactive",
  "expired",
]);

export const couponTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  discountType: varchar("discount_type", { length: 20 }).notNull().default("fixed"), // fixed or percentage
  minBookingAmount: decimal("min_booking_amount", { precision: 10, scale: 2 }).default("0"),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }), // Only applicable for percentage discounts
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: couponStatusEnum("status").notNull().default("active"),
  usageLimit: integer("usage_limit"), // Total number of times this coupon can be used
  usageCount: integer("usage_count").notNull().default(0), // Number of times this coupon has been used
  perUserLimit: integer("per_user_limit").default(1), // Number of times a single user can use this coupon
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => UserTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const couponRelations = relations(couponTable, ({ one }) => ({
  creator: one(UserTable, {
    fields: [couponTable.createdBy],
    references: [UserTable.id],
  }),
}));
