ALTER TYPE "public"."car_status" ADD VALUE 'out_of_service';--> statement-breakpoint
ALTER TABLE "car" DROP COLUMN "inmaintainance";--> statement-breakpoint
ALTER TABLE "car" DROP COLUMN "isavailable";