CREATE TYPE "public"."status" AS ENUM('PENDING_ADMIN_ASSIGNMENT', 'PARKING_ASSIGNED', 'APPROVED', 'DENIED');--> statement-breakpoint
CREATE TABLE "car_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendorid" integer NOT NULL,
	"carcatalogid" integer NOT NULL,
	"parkingid" integer,
	"denialreason" varchar(255),
	"status" "status",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "car_request" ADD CONSTRAINT "car_request_vendorid_users_id_fk" FOREIGN KEY ("vendorid") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_request" ADD CONSTRAINT "car_request_carcatalogid_car_catalog_id_fk" FOREIGN KEY ("carcatalogid") REFERENCES "public"."car_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_request" ADD CONSTRAINT "car_request_parkingid_parkings_id_fk" FOREIGN KEY ("parkingid") REFERENCES "public"."parkings"("id") ON DELETE cascade ON UPDATE no action;