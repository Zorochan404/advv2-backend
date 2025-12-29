import { integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { UserTable } from "../user/usermodel";
import { relations } from "drizzle-orm";

export const reviewModel = pgTable("review", {
    id: serial("id").primaryKey(),
    carid: integer("carid").notNull(),
    userid: integer("userid").notNull().references(() => UserTable.id, { onDelete: "cascade" }),
    rating: integer("rating"),
    comment: varchar("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Note: The relation to car is defined in the car model to avoid circular imports
export const reviewRelations = relations(reviewModel, ({ one }) => ({
    user: one(UserTable, {
      fields: [reviewModel.userid],
      references: [UserTable.id],
    }),
}));