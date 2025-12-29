CREATE TYPE "public"."parking_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "parkings" ADD COLUMN "status" "parking_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "parkings" ADD COLUMN "requested_by" integer;--> statement-breakpoint
ALTER TABLE "parkings" ADD COLUMN "approved_by" integer;--> statement-breakpoint
ALTER TABLE "parkings" ADD CONSTRAINT "parkings_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parkings" ADD CONSTRAINT "parkings_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;