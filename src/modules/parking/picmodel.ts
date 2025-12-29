import {
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { UserTable } from "../user/usermodel";
import { carModel } from "../car/carmodel";
import { parkingTable } from "./parkingmodel";

// PIC (Parking In Charge) verification for vendor cars
export const picVerificationTable = pgTable("pic_verifications", {
  id: serial("id").primaryKey(),

  // Foreign keys
  carId: integer("car_id")
    .notNull()
    .references(() => carModel.id, { onDelete: "cascade" }),
  parkingId: integer("parking_id")
    .notNull()
    .references(() => parkingTable.id, { onDelete: "cascade" }),
  picId: integer("pic_id")
    .notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),

  // Verification details
  status: varchar("status", { length: 50 }).default("pending"), // pending, approved, rejected, recheck
  verificationType: varchar("verification_type", { length: 50 }).notNull(), // initial, recheck

  // Health check details
  engineCondition: varchar("engine_condition", { length: 50 }), // excellent, good, fair, poor
  bodyCondition: varchar("body_condition", { length: 50 }), // excellent, good, fair, poor
  interiorCondition: varchar("interior_condition", { length: 50 }), // excellent, good, fair, poor
  tireCondition: varchar("tire_condition", { length: 50 }), // excellent, good, fair, poor

  // Documentation verification
  rcVerified: boolean("rc_verified").default(false),
  insuranceVerified: boolean("insurance_verified").default(false),
  pollutionVerified: boolean("pollution_verified").default(false),

  // Images for verification
  verificationImages: varchar("verification_images", { length: 500 })
    .array()
    .default([]),

  // PIC comments and feedback
  picComments: text("pic_comments"),
  vendorFeedback: text("vendor_feedback"),

  // Timestamps
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const picVerificationRelations = relations(
  picVerificationTable,
  ({ one }) => ({
    car: one(carModel, {
      fields: [picVerificationTable.carId],
      references: [carModel.id],
    }),
    parking: one(parkingTable, {
      fields: [picVerificationTable.parkingId],
      references: [parkingTable.id],
    }),
    pic: one(UserTable, {
      fields: [picVerificationTable.picId],
      references: [UserTable.id],
    }),
  })
);
