import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const loginAttemptsTable = pgTable("login_attempts", {
  keyHash: text("key_hash").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
