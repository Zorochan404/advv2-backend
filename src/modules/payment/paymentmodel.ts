import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { UserTable } from "../user/usermodel";
import { bookingsTable } from "../booking/bookingmodel";
import { topupTable } from "../booking/topupmodel";

// Payment types enum
export const paymentTypeEnum = pgEnum("payment_type", [
  "advance",      // Advance payment for booking
  "final",        // Final payment for booking
  "topup",        // Topup/extension payment
  "refund",       // Refund payment
  "penalty",      // Penalty payment
]);

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",      // Payment initiated but not confirmed
  "processing",   // Payment being processed
  "completed",    // Payment successful
  "failed",       // Payment failed
  "cancelled",    // Payment cancelled
  "refunded",     // Payment refunded
]);

// Payment method enum
export const paymentMethodEnum = pgEnum("payment_method", [
  "razorpay",     // Razorpay gateway
  "stripe",       // Stripe gateway
  "paypal",       // PayPal gateway
  "upi",          // UPI payment
  "card",         // Credit/Debit card
  "netbanking",   // Net banking
  "wallet",       // Digital wallet
  "cash",         // Cash payment (for offline)
]);

// Main payments table
export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  
  // Payment identification
  paymentId: varchar("payment_id", { length: 100 }).notNull().unique(), // External payment gateway ID
  referenceId: varchar("reference_id", { length: 100 }), // Internal reference ID
  
  // Payment details
  type: paymentTypeEnum("type").notNull(),
  status: paymentStatusEnum("status").default("pending"),
  method: paymentMethodEnum("method").notNull(),
  
  // Amount details
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("INR"),
  fees: doublePrecision("fees").default(0), // Gateway fees
  netAmount: doublePrecision("net_amount").notNull(), // Amount after fees
  
  // Foreign key relationships
  userId: integer("user_id")
    .notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  
  bookingId: integer("booking_id")
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  
  topupId: integer("topup_id")
    .references(() => topupTable.id, { onDelete: "cascade" }),
  
  // Payment gateway details
  gatewayTransactionId: varchar("gateway_transaction_id", { length: 200 }),
  gatewayResponse: varchar("gateway_response", { length: 1000 }), // JSON response from gateway
  gatewayStatus: varchar("gateway_status", { length: 50 }),
  
  // Payment timing
  initiatedAt: timestamp("initiated_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  
  // Failure details
  failureReason: varchar("failure_reason", { length: 500 }),
  retryCount: integer("retry_count").default(0),
  
  // Refund details
  refundAmount: doublePrecision("refund_amount").default(0),
  refundReason: varchar("refund_reason", { length: 500 }),
  refundedAt: timestamp("refunded_at"),
  refundReferenceId: varchar("refund_reference_id", { length: 100 }),
  
  // Metadata
  metadata: varchar("metadata", { length: 1000 }), // JSON for additional data
  notes: varchar("notes", { length: 500 }),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relations
export const paymentRelations = relations(paymentsTable, ({ one }) => ({
  user: one(UserTable, {
    fields: [paymentsTable.userId],
    references: [UserTable.id],
  }),
  booking: one(bookingsTable, {
    fields: [paymentsTable.bookingId],
    references: [bookingsTable.id],
  }),
  topup: one(topupTable, {
    fields: [paymentsTable.topupId],
    references: [topupTable.id],
  }),
}));

// Payment summary view for easy querying
export const paymentSummaryTable = pgTable("payment_summary", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  bookingId: integer("booking_id")
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  
  // Summary amounts
  totalPaid: doublePrecision("total_paid").default(0),
  totalRefunded: doublePrecision("total_refunded").default(0),
  netAmount: doublePrecision("net_amount").default(0),
  
  // Payment counts
  totalPayments: integer("total_payments").default(0),
  successfulPayments: integer("successful_payments").default(0),
  failedPayments: integer("failed_payments").default(0),
  
  // Last payment details
  lastPaymentAt: timestamp("last_payment_at"),
  lastPaymentAmount: doublePrecision("last_payment_amount"),
  lastPaymentStatus: paymentStatusEnum("last_payment_status"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentSummaryRelations = relations(paymentSummaryTable, ({ one }) => ({
  user: one(UserTable, {
    fields: [paymentSummaryTable.userId],
    references: [UserTable.id],
  }),
  booking: one(bookingsTable, {
    fields: [paymentSummaryTable.bookingId],
    references: [bookingsTable.id],
  }),
}));

// Add booking relations to payments (reverse relations)
export const bookingPaymentRelations = relations(bookingsTable, ({ one, many }) => ({
  advancePayment: one(paymentsTable, {
    fields: [bookingsTable.advancePaymentId],
    references: [paymentsTable.id],
  }),
  finalPayment: one(paymentsTable, {
    fields: [bookingsTable.finalPaymentId],
    references: [paymentsTable.id],
  }),
  // Late fees payment relation removed
  payments: many(paymentsTable),
}));
