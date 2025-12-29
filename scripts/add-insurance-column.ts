// Script to manually add insurance_amount column to car table
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function addInsuranceColumn() {
    try {
        console.log('Adding insurance_amount column to car table...');

        await sql`
      ALTER TABLE car 
      ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(10, 2) NOT NULL DEFAULT 500
    `;

        console.log('✅ Successfully added insurance_amount column!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding column:', error);
        process.exit(1);
    }
}

addInsuranceColumn();
