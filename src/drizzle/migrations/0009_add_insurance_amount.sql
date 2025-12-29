-- Add insurance_amount column to car table
ALTER TABLE car 
ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(10, 2) NOT NULL DEFAULT 500;
