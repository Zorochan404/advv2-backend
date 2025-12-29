ALTER TABLE "bookings" ADD COLUMN "actual_dropoff_date" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "late_fees" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "return_condition" varchar(50) DEFAULT 'good';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "return_images" varchar(500)[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "return_comments" varchar(500);