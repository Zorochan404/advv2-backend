ALTER TABLE "car" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "car" ADD COLUMN "fineperhour" integer;--> statement-breakpoint
ALTER TABLE "car" ADD COLUMN "extensionperhour" integer;