-- Convert tools column from varchar array to jsonb
ALTER TABLE "bookings" ALTER COLUMN "tools" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "tools" TYPE jsonb USING CASE 
  WHEN tools IS NULL THEN '[]'::jsonb
  WHEN array_length(tools, 1) IS NULL THEN '[]'::jsonb
  ELSE array_to_json(tools)::jsonb
END;
ALTER TABLE "bookings" ALTER COLUMN "tools" SET DEFAULT '[]'::jsonb;