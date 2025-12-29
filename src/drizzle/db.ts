import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { Pool } from "pg";
import dotenv from "dotenv";
import {
  carModel,
  carRelations,
  carCatalogTable,
  carCatalogRelations,
} from "../modules/car/carmodel";
import { reviewModel, reviewRelations } from "../modules/review/reviewmodel";
import { UserTable, vendorRelations } from "../modules/user/usermodel";
import {
  parkingTable,
  parkingRelations,
} from "../modules/parking/parkingmodel";
import {
  bookingsTable,
  bookingRelations,
} from "../modules/booking/bookingmodel";
import {
  advertisementTable,
  advertisementRelations,
} from "../modules/advertisement/advertisementmodel";
import {
  couponTable,
  couponRelations,
} from "../modules/coupon/couponmodel";
import {
  topupTable,
  topupRelations,
  bookingTopupTable,
  bookingTopupRelations,
} from "../modules/booking/topupmodel";
import {
  picVerificationTable,
  picVerificationRelations,
} from "../modules/parking/picmodel";
import {
  paymentsTable,
  paymentSummaryTable,
  paymentRelations,
  paymentSummaryRelations,
  bookingPaymentRelations,
} from "../modules/payment/paymentmodel";

dotenv.config();

// For Drizzle Studio and migrations
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const schema = {
  carModel,
  carCatalogTable,
  reviewModel,
  UserTable,
  parkingTable,
  bookingsTable,
  advertisementTable,
  couponTable,
  topupTable,
  bookingTopupTable,
  picVerificationTable,
  paymentsTable,
  paymentSummaryTable,
  // Include all relations
  carRelations,
  carCatalogRelations,
  reviewRelations,
  vendorRelations,
  parkingRelations,
  bookingRelations,
  advertisementRelations,
  couponRelations,
  topupRelations,
  bookingTopupRelations,
  picVerificationRelations,
  paymentRelations,
  paymentSummaryRelations,
  bookingPaymentRelations,
};

// For serverless operations
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });

// Export pool for Drizzle Studio
export { pool };
