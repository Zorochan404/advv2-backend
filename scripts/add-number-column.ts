// Script to add missing number column and fix duplicates
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function addNumberColumnAndFixDuplicates() {
    try {
        console.log('Step 1: Adding number column to car table...');

        // Add the number column without unique constraint first
        await sql`
      ALTER TABLE car 
      ADD COLUMN IF NOT EXISTS number VARCHAR(20)
    `;

        console.log('✅ Number column added!');

        console.log('Step 2: Updating existing rows with unique car numbers...');

        // Update all rows to have unique numbers based on their ID
        await sql`
      UPDATE car 
      SET number = CONCAT('CAR-', LPAD(id::text, 5, '0'))
      WHERE number IS NULL OR number = 'CAR-001'
    `;

        console.log('✅ Updated existing rows with unique numbers!');

        console.log('Step 3: Setting NOT NULL constraint...');

        await sql`
      ALTER TABLE car 
      ALTER COLUMN number SET NOT NULL
    `;

        console.log('✅ Set NOT NULL constraint!');

        console.log('Step 4: Adding unique constraint...');

        await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'car_number_unique'
        ) THEN
          ALTER TABLE car ADD CONSTRAINT car_number_unique UNIQUE (number);
        END IF;
      END $$
    `;

        console.log('✅ Successfully added unique constraint!');

        // Show sample of updated data
        const cars = await sql`SELECT id, name, number FROM car LIMIT 5`;
        console.log('\nSample car data:');
        console.table(cars);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addNumberColumnAndFixDuplicates();
