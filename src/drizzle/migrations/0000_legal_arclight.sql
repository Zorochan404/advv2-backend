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
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;