ALTER TABLE "bookings" DROP CONSTRAINT "bookings_advance_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_final_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_late_fees_payment_id_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payment_type";--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('advance', 'final', 'topup', 'refund', 'penalty');--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "type" SET DATA TYPE "public"."payment_type" USING "type"::"public"."payment_type";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "late_fees";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "late_fees_payment_id";--> statement-breakpoint
ALTER TABLE "car_catalog" DROP COLUMN "late_fee_rate";