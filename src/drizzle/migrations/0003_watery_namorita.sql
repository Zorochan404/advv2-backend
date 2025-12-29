ALTER TABLE "bookings" ADD COLUMN "late_fees_paid" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "late_fees_payment_reference_id" varchar(100);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "late_fees_paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "car_catalog" ADD COLUMN "late_fee_rate" numeric(10, 2) DEFAULT '0.10' NOT NULL;