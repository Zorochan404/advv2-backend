CREATE TYPE "public"."payment_method" AS ENUM('razorpay', 'stripe', 'paypal', 'upi', 'card', 'netbanking', 'wallet', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('advance', 'final', 'late_fees', 'topup', 'refund', 'penalty');--> statement-breakpoint
CREATE TABLE "payment_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"booking_id" integer,
	"total_paid" double precision DEFAULT 0,
	"total_refunded" double precision DEFAULT 0,
	"net_amount" double precision DEFAULT 0,
	"total_payments" integer DEFAULT 0,
	"successful_payments" integer DEFAULT 0,
	"failed_payments" integer DEFAULT 0,
	"last_payment_at" timestamp,
	"last_payment_amount" double precision,
	"last_payment_status" "payment_status",
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" varchar(100) NOT NULL,
	"reference_id" varchar(100),
	"type" "payment_type" NOT NULL,
	"status" "payment_status" DEFAULT 'pending',
	"method" "payment_method" NOT NULL,
	"amount" double precision NOT NULL,
	"currency" varchar(3) DEFAULT 'INR',
	"fees" double precision DEFAULT 0,
	"net_amount" double precision NOT NULL,
	"user_id" integer NOT NULL,
	"booking_id" integer,
	"topup_id" integer,
	"gateway_transaction_id" varchar(200),
	"gateway_response" varchar(1000),
	"gateway_status" varchar(50),
	"initiated_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" varchar(500),
	"retry_count" integer DEFAULT 0,
	"refund_amount" double precision DEFAULT 0,
	"refund_reason" varchar(500),
	"refunded_at" timestamp,
	"refund_reference_id" varchar(100),
	"metadata" varchar(1000),
	"notes" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payments_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "advance_payment_id" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "final_payment_id" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "late_fees_payment_id" integer;--> statement-breakpoint
ALTER TABLE "payment_summary" ADD CONSTRAINT "payment_summary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_summary" ADD CONSTRAINT "payment_summary_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_topup_id_topups_id_fk" FOREIGN KEY ("topup_id") REFERENCES "public"."topups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_advance_payment_id_payments_id_fk" FOREIGN KEY ("advance_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_final_payment_id_payments_id_fk" FOREIGN KEY ("final_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_late_fees_payment_id_payments_id_fk" FOREIGN KEY ("late_fees_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "late_fees_paid";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "late_fees_payment_reference_id";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "late_fees_paid_at";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "advance_payment_status";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "final_payment_status";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "advance_payment_reference_id";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "final_payment_reference_id";