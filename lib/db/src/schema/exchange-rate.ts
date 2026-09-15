import { pgTable, serial, numeric, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exchangeRateTable = pgTable(
  "exchange_rate",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().default("default"),
    usdToBs: numeric("usd_to_bs", { precision: 12, scale: 4 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({ keyUnique: uniqueIndex("exchange_rate_key_unique").on(table.key) }),
);

export const insertExchangeRateSchema = createInsertSchema(exchangeRateTable).omit({
  id: true,
  updatedAt: true,
});

export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRateTable.$inferSelect;
