CREATE TYPE "public"."coupon_status" AS ENUM('active', 'inactive', 'expired');--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"discount_amount" numeric(10, 2) NOT NULL,
	"discount_type" varchar(20) DEFAULT 'fixed' NOT NULL,
	"min_booking_amount" numeric(10, 2) DEFAULT '0',
	"max_discount_amount" numeric(10, 2),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" "coupon_status" DEFAULT 'active' NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"per_user_limit" integer DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "coupon_id" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_amount" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "insurance_amount" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "car" ADD COLUMN "insurance_amount" numeric(10, 2) DEFAULT '500' NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;