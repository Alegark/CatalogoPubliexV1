import { pgTable, text, serial, timestamp, numeric, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories.ts";

export const productSizeSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  measurements: z.string().trim().min(1).max(120).optional(),
  acrylicThicknessCm: z.number().nonnegative().max(100).multipleOf(0.01).optional(),
  acrylicColor: z.string().trim().min(1).max(60).optional(),
});

export type ProductSize = z.infer<typeof productSizeSchema>;

export const discountTierSchema = z.object({
  threshold: z.number().int().positive(),
  amountOffUsd: z.number().min(0).max(1_000_000).multipleOf(0.01),
});

export const legacyDiscountTierSchema = z.object({
  threshold: z.number().int().positive(),
  percent: z.number().min(0).max(100).multipleOf(0.01),
});

export type DiscountTier = z.infer<typeof discountTierSchema>;export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  keywords: text("keywords").array().notNull().default([]),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "restrict" }),
  images: text("images").array().notNull().default([]),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  deliveryTime: text("delivery_time").notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  sizes: jsonb("sizes").notNull().default([]),
  discountTiers: jsonb("discount_tiers").$type<DiscountTier[]>().notNull().default([]),
  discountThreshold: integer("discount_threshold"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
