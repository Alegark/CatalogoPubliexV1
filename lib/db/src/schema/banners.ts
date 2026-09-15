import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products.ts";

export const bannersTable = pgTable(
  "banners",
  {
    id: serial("id").primaryKey(),
    storagePath: text("storage_path").notNull().unique(),
    productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdx: index("banners_product_idx").on(table.productId),
    positionIdx: index("banners_position_idx").on(table.position),
  }),
);

export const insertBannerSchema = createInsertSchema(bannersTable).omit({
  id: true,
  createdAt: true,
});

export const bannerOrderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(10),
});

export const bannerLinkSchema = z.object({
  productId: z.number().int().positive().nullable(),
});

export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof bannersTable.$inferSelect;
