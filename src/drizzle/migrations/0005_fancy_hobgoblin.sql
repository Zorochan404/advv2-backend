CREATE TABLE "parking_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"parking_name" varchar(255) NOT NULL,
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
	"status" varchar(50) DEFAULT 'pending',
	"admin_comments" text,
	"approved_by" integer,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "parkings" DROP CONSTRAINT "parkings_requested_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "parkings" DROP CONSTRAINT "parkings_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "parking_approvals" ADD CONSTRAINT "parking_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parking_approvals" ADD CONSTRAINT "parking_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parkings" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "parkings" DROP COLUMN "requested_by";--> statement-breakpoint
ALTER TABLE "parkings" DROP COLUMN "approved_by";--> statement-breakpoint
DROP TYPE "public"."parking_status";