CREATE TABLE "booking_topups" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"topup_id" integer NOT NULL,
	"applied_at" timestamp NOT NULL,
	"original_end_date" timestamp NOT NULL,
	"new_end_date" timestamp NOT NULL,
	"amount" double precision NOT NULL,
	"payment_status" varchar(50) DEFAULT 'pending',
	"payment_reference_id" varchar(100),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "topups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"duration" integer NOT NULL,
	"price" double precision NOT NULL,
	"category" varchar(50) DEFAULT 'extension',
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pic_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"car_id" integer NOT NULL,
	"parking_id" integer NOT NULL,
	"pic_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"verification_type" varchar(50) NOT NULL,
	"engine_condition" varchar(50),
	"body_condition" varchar(50),
	"interior_condition" varchar(50),
	"tire_condition" varchar(50),
	"rc_verified" boolean DEFAULT false,
	"insurance_verified" boolean DEFAULT false,
	"pollution_verified" boolean DEFAULT false,
	"verification_images" varchar(500)[] DEFAULT '{}',
	"pic_comments" text,
	"vendor_feedback" text,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "total_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "extension_price" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "car_catalog" ALTER COLUMN "features" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "base_price" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "advance_amount" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "remaining_amount" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "extension_till" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "extension_time" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "confirmation_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "advance_payment_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "final_payment_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "advance_payment_reference_id" varchar(100);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "final_payment_reference_id" varchar(100);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "car_condition_images" varchar(500)[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "tool_images" varchar(500)[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "tools" varchar(500)[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pic_approved" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pic_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pic_approved_by" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pic_comments" varchar(500);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "user_confirmed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "user_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "delivery_type" varchar(50) DEFAULT 'pickup';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "delivery_address" varchar(500);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "delivery_charges" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint

ALTER TABLE "booking_topups" ADD CONSTRAINT "booking_topups_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_topups" ADD CONSTRAINT "booking_topups_topup_id_topups_id_fk" FOREIGN KEY ("topup_id") REFERENCES "public"."topups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pic_verifications" ADD CONSTRAINT "pic_verifications_car_id_car_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."car"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pic_verifications" ADD CONSTRAINT "pic_verifications_parking_id_parkings_id_fk" FOREIGN KEY ("parking_id") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pic_verifications" ADD CONSTRAINT "pic_verifications_pic_id_users_id_fk" FOREIGN KEY ("pic_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pic_approved_by_users_id_fk" FOREIGN KEY ("pic_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "insurance_price";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "extention_till";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "extention_time";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "tool";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "trip_starting_car_images";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "payment_status";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "payment_reference_id";