CREATE TYPE "public"."ad_status" AS ENUM('active', 'inactive', 'pending', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ad_type" AS ENUM('banner', 'carousel', 'popup', 'sidebar');--> statement-breakpoint
CREATE TABLE "advertisements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"image_url" varchar(500) NOT NULL,
	"video_url" varchar(500),
	"link_url" varchar(500),
	"ad_type" "ad_type" DEFAULT 'banner' NOT NULL,
	"status" "ad_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"target_audience" varchar(100),
	"location" varchar(100),
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"car_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"price" double precision,
	"insurance_price" double precision DEFAULT 0,
	"total_price" double precision,
	"extension_price" double precision,
	"extention_till" timestamp,
	"extention_time" integer,
	"status" varchar(50) DEFAULT 'pending',
	"tool" varchar(500)[] DEFAULT '{}',
	"trip_starting_car_images" jsonb,
	"payment_status" varchar(50) DEFAULT 'pending',
	"payment_reference_id" varchar(50),
	"pickup_parking_id" integer,
	"dropoff_parking_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "car" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"maker" varchar(255) NOT NULL,
	"year" integer NOT NULL,
	"carnumber" varchar(255) NOT NULL,
	"price" integer NOT NULL,
	"discountedprice" integer DEFAULT 0 NOT NULL,
	"color" varchar(255) NOT NULL,
	"transmission" varchar(255) NOT NULL,
	"fuel" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"seats" integer NOT NULL,
	"rcnumber" varchar(255),
	"rcimg" varchar(255),
	"pollutionimg" varchar(255),
	"insuranceimg" varchar(255),
	"inmaintainance" boolean DEFAULT false NOT NULL,
	"isavailable" boolean DEFAULT true NOT NULL,
	"images" jsonb,
	"mainimg" varchar(255) NOT NULL,
	"vendorid" integer NOT NULL,
	"parkingid" integer,
	"isapproved" boolean DEFAULT false NOT NULL,
	"ispopular" boolean DEFAULT false NOT NULL,
	"insuranceprice" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parkings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"locality" varchar,
	"city" varchar,
	"state" varchar,
	"country" varchar,
	"pincode" integer,
	"capacity" integer NOT NULL,
	"mainimg" varchar(255) NOT NULL,
	"images" jsonb NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" serial PRIMARY KEY NOT NULL,
	"carid" integer NOT NULL,
	"userid" integer NOT NULL,
	"rating" integer,
	"comment" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar,
	"avatar" varchar,
	"age" integer,
	"number" bigint,
	"email" varchar,
	"password" varchar DEFAULT '123456',
	"aadhar_number" varchar,
	"aadhar_img" varchar,
	"dl_number" varchar,
	"dl_img" varchar,
	"passport_number" varchar,
	"passport_img" varchar,
	"lat" double precision,
	"lng" double precision,
	"locality" varchar,
	"city" varchar,
	"state" varchar,
	"country" varchar,
	"pincode" integer,
	"role" "user_role" DEFAULT 'user',
	"is_verified" boolean DEFAULT false,
	"parkingid" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_car_id_car_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."car"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_parking_id_parkings_id_fk" FOREIGN KEY ("pickup_parking_id") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dropoff_parking_id_parkings_id_fk" FOREIGN KEY ("dropoff_parking_id") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car" ADD CONSTRAINT "car_vendorid_users_id_fk" FOREIGN KEY ("vendorid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car" ADD CONSTRAINT "car_parkingid_parkings_id_fk" FOREIGN KEY ("parkingid") REFERENCES "public"."parkings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_parkingid_parkings_id_fk" FOREIGN KEY ("parkingid") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;