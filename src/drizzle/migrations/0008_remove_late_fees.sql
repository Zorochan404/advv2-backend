-- Remove late fee fields from bookings table
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "late_fees";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "late_fees_payment_id";

-- Remove late fee rate from car catalog table
ALTER TABLE "car_catalog" DROP COLUMN IF EXISTS "late_fee_rate";

-- Remove late_fees from payment type enum
-- Note: We need to create a new enum without late_fees and update the payments table
CREATE TYPE "payment_type_new" AS ENUM('advance', 'final', 'topup', 'refund', 'penalty');

-- Update payments table to use new enum
ALTER TABLE "payments" ALTER COLUMN "type" TYPE "payment_type_new" USING "type"::text::"payment_type_new";

-- Drop old enum and rename new one
DROP TYPE "payment_type";
ALTER TYPE "payment_type_new" RENAME TO "payment_type";

-- Drop foreign key constraint for late_fees_payment_id if it exists
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_late_fees_payment_id_payments_id_fk";

