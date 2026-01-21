import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";

// ===== Models & Relations =====
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

// ===== PostgreSQL Pool (TCP – production safe) =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, // ⬅️ important
  idleTimeoutMillis: 30000,
  max: 10
});

// ===== Drizzle Schema =====
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

  // Relations
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

// ===== Drizzle DB Instance =====
export const db = drizzle(pool, { schema });
