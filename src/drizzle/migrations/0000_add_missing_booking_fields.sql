-- Add missing fields to bookings table
ALTER TABLE "bookings" ADD COLUMN "pickup_date" timestamp;
ALTER TABLE "bookings" ADD COLUMN "actual_pickup_date" timestamp;
ALTER TABLE "bookings" ADD COLUMN "original_pickup_date" timestamp;
ALTER TABLE "bookings" ADD COLUMN "reschedule_count" integer DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "max_reschedule_count" integer DEFAULT 3;
ALTER TABLE "bookings" ADD COLUMN "otp_code" varchar(4);
ALTER TABLE "bookings" ADD COLUMN "otp_expires_at" timestamp;
ALTER TABLE "bookings" ADD COLUMN "otp_verified" boolean DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN "otp_verified_at" timestamp;
ALTER TABLE "bookings" ADD COLUMN "otp_verified_by" integer;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_otp_verified_by_users_id_fk" FOREIGN KEY ("otp_verified_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action; 