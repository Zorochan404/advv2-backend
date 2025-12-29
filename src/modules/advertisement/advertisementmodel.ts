import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";
import { UserTable } from "../user/usermodel";

export const adStatusEnum = pgEnum("ad_status", [
  "active",
  "inactive",
  "pending",
  "expired",
]);
export const adTypeEnum = pgEnum("ad_type", [
  "banner",
  "carousel",
  "popup",
  "sidebar",
]);

export const advertisementTable = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  videoUrl: varchar("video_url", { length: 500 }),
  linkUrl: varchar("link_url", { length: 500 }),
  adType: adTypeEnum("ad_type").notNull().default("banner"),
  status: adStatusEnum("status").notNull().default("pending"),
  priority: integer("priority").notNull().default(1), // Higher number = higher priority
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  clickCount: integer("click_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  targetAudience: varchar("target_audience", { length: 100 }), // e.g., "all", "premium", "new_users"
  location: varchar("location", { length: 100 }), // e.g., "homepage", "search_results", "car_details"
  createdBy: integer("created_by").references(() => UserTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const advertisementRelations = relations(
  advertisementTable,
  ({ one }) => ({
    creator: one(UserTable, {
      fields: [advertisementTable.createdBy],
      references: [UserTable.id],
    }),
  })
);
