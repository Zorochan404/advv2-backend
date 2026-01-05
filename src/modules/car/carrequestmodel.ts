
import { pgTable, serial, integer, varchar, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { UserTable } from "../user/usermodel";
import { carCatalogTable, carModel } from "./carmodel";
import { parkingTable } from "../parking/parkingmodel";

export const carRequestStatusEnum = pgEnum("status", ['PENDING_ADMIN_ASSIGNMENT', 'PARKING_ASSIGNED', 'APPROVED', 'DENIED']);

export const carRequestTable = pgTable("car_request", {
    id: serial("id").primaryKey(),
    vendorid: integer("vendorid").references(() => UserTable.id, { onDelete: "cascade" }).notNull(),
    carcatalogid: integer("carcatalogid").references(() => carCatalogTable.id, { onDelete: "cascade" }).notNull(),
    parkingid: integer("parkingid").references(() => parkingTable.id, { onDelete: "cascade" }),
    denialreason: varchar("denialreason", { length: 255 }),
    status: carRequestStatusEnum("status"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})