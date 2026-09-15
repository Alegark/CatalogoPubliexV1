import { integer, index, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products.ts";

export const analyticsEventsTable = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  productSlug: text("product_slug"),
  productName: text("product_name"),
  categoryName: text("category_name"),
  source: text("source"),
  sizeName: text("size_name"),
  quantity: integer("quantity"),
  itemCount: integer("item_count"),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }),
}, (table) => ({
  occurredAtIdx: index("analytics_events_occurred_at_idx").on(table.occurredAt),
  eventTypeOccurredAtIdx: index("analytics_events_type_occurred_at_idx").on(table.eventType, table.occurredAt),
}));

export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEventsTable.$inferInsert;
