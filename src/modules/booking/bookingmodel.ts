import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { UserTable } from "../user/usermodel";
import { carModel } from "../car/carmodel";
import { parkingTable } from "../parking/parkingmodel";
import { couponTable } from "../coupon/couponmodel";
// Note: paymentsTable import removed to avoid circular dependency

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),

  // Foreign key to users
  userId: integer("user_id")
    .notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),

  // Foreign key to cars
  carId: integer("car_id")
    .notNull()
    .references(() => carModel.id, { onDelete: "cascade" }),
    
  // Foreign key to coupon
  couponId: integer("coupon_id").references(() => couponTable.id),

  // Booking details
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  pickupDate: timestamp("pickup_date"), // Specific pickup date/time
  actualPickupDate: timestamp("actual_pickup_date"), // When user actually picked up
  actualDropoffDate: timestamp("actual_dropoff_date"), // When user actually returned the car

  // Rescheduling
  originalPickupDate: timestamp("original_pickup_date"), // Original pickup date for rescheduling
  rescheduleCount: integer("reschedule_count").default(0), // Number of times rescheduled
  maxRescheduleCount: integer("max_reschedule_count").default(3), // Maximum allowed reschedules

  // Pricing breakdown
  basePrice: doublePrecision("base_price").notNull(),
  advanceAmount: doublePrecision("advance_amount").notNull(),
  remainingAmount: doublePrecision("remaining_amount").notNull(),
  totalPrice: doublePrecision("total_price").notNull(),
  
  // Coupon and insurance
  discountAmount: doublePrecision("discount_amount").default(0),
  insuranceAmount: doublePrecision("insurance_amount").default(0),

  // Extension/Topup
  extensionPrice: doublePrecision("extension_price").default(0),
  extensionTill: timestamp("extension_till"),
  extensionTime: integer("extension_time"), // in hours

  // Late fees removed - users can use topup instead

  // Car return details
  returnCondition: varchar("return_condition", { length: 50 }).default("good"), // good, fair, poor
  returnImages: varchar("return_images", { length: 500 }).array().default([]), // Array of return condition image URLs
  returnComments: varchar("return_comments", { length: 500 }), // Comments from PIC about return condition

  // Booking status flow
  status: varchar("status", { length: 50 }).default("pending"), // pending, advance_paid, confirmed, active, completed, cancelled
  confirmationStatus: varchar("confirmation_status", { length: 50 }).default(
    "pending"
  ), // pending, approved, rejected

  // Payment tracking - now references payments table
  advancePaymentId: integer("advance_payment_id"),
  finalPaymentId: integer("final_payment_id"),

  // Car condition verification
  carConditionImages: varchar("car_condition_images", { length: 500 })
    .array()
    .default([]), // Array of image URLs
  toolImages: varchar("tool_images", { length: 500 }).array().default([]), // Array of image URLs
  tools: jsonb("tools").default([]), // Array of tool objects with name and imageUrl

  // PIC (Parking In Charge) verification
  picApproved: boolean("pic_approved").default(false),
  picApprovedAt: timestamp("pic_approved_at"),
  picApprovedBy: integer("pic_approved_by").references(() => UserTable.id),
  picComments: varchar("pic_comments", { length: 500 }),

  // OTP Verification System
  otpCode: varchar("otp_code", { length: 4 }), // 4-digit OTP
  otpExpiresAt: timestamp("otp_expires_at"), // OTP expiration time
  otpVerified: boolean("otp_verified").default(false), // Whether OTP was verified
  otpVerifiedAt: timestamp("otp_verified_at"), // When OTP was verified
  otpVerifiedBy: integer("otp_verified_by").references(() => UserTable.id), // Who verified the OTP

  // User confirmation
  userConfirmed: boolean("user_confirmed").default(false),
  userConfirmedAt: timestamp("user_confirmed_at"),

  // Location details
  pickupParkingId: integer("pickup_parking_id").references(
    () => parkingTable.id,
    { onDelete: "cascade" }
  ),
  dropoffParkingId: integer("dropoff_parking_id").references(
    () => parkingTable.id,
    { onDelete: "cascade" }
  ),

  // Delivery options
  deliveryType: varchar("delivery_type", { length: 50 }).default("pickup"), // pickup, delivery
  deliveryAddress: varchar("delivery_address", { length: 500 }),
  deliveryCharges: doublePrecision("delivery_charges").default(0),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relations for bookings table
export const bookingRelations = relations(bookingsTable, ({ one, many }) => ({
  user: one(UserTable, {
    fields: [bookingsTable.userId],
    references: [UserTable.id],
  }),
  car: one(carModel, {
    fields: [bookingsTable.carId],
    references: [carModel.id],
  }),
  coupon: one(couponTable, {
    fields: [bookingsTable.couponId],
    references: [couponTable.id],
  }),
  pickupParking: one(parkingTable, {
    fields: [bookingsTable.pickupParkingId],
    references: [parkingTable.id],
  }),
  dropoffParking: one(parkingTable, {
    fields: [bookingsTable.dropoffParkingId],
    references: [parkingTable.id],
  }),
  picApprover: one(UserTable, {
    fields: [bookingsTable.picApprovedBy],
    references: [UserTable.id],
  }),
  // Payment relations - will be defined in payment model to avoid circular dependency
}));
