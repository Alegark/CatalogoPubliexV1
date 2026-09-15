import { Router, type IRouter, type Request } from "express";
import { eq, ilike, and, or, sql } from "drizzle-orm";
import {
  db,
  discountTierSchema,
  legacyDiscountTierSchema,
  categoriesTable,
  productsTable,
  type DiscountTier,
} from "@workspace/db";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  DeleteProductKeywordBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";
import { categorySlug } from "../lib/category-utils";
import { collectProductKeywords, normalizeProductKeywords, removeProductKeyword } from "../lib/product-keywords";
import { extractStoragePath, removeStorageObject } from "../lib/storage.ts";

const router: IRouter = Router();

function roundDiscountAmount(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function normalizeDiscountTiers(
  value: unknown,
  legacyThreshold: number | null = null,
  legacyPercent: number | string | null = null,
  referencePriceUsd = 0,
): DiscountTier[] {
  const parsed = Array.isArray(value)
    ? value.flatMap((tier) => {
        const current = discountTierSchema.safeParse(tier);
        if (current.success) return [current.data];
        const legacy = legacyDiscountTierSchema.safeParse(tier);
        if (!legacy.success) return [];
        return [{
          threshold: legacy.data.threshold,
          amountOffUsd: roundDiscountAmount(referencePriceUsd * legacy.data.percent / 100),
        }];
      })
    : [];

  if (
    parsed.length === 0
    && legacyThreshold !== null
    && Number.isInteger(legacyThreshold)
    && legacyThreshold > 0
    && legacyPercent !== null
  ) {
    const percent = Number(legacyPercent);
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      parsed.push({
        threshold: legacyThreshold,
        amountOffUsd: roundDiscountAmount(referencePriceUsd * percent / 100),
      });
    }
  }

  const unique = new Map<number, DiscountTier>();
  for (const tier of parsed) unique.set(tier.threshold, tier);
  return [...unique.values()].sort((a, b) => a.threshold - b.threshold);
}

function legacyDiscountFields(tiers: DiscountTier[]) {
  const first = tiers[0];
  return {
    discountThreshold: first?.threshold ?? null,
    discountPercent: null,
  };
}

async function resolveCategory(categoryName: string) {
  const slug = categorySlug(categoryName);
  if (!slug) return null;

  const [category] = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug))
    .limit(1);
  return category ?? null;
}

function serializeProduct(product: typeof productsTable.$inferSelect, categoryName: string) {
  const discountTiers = normalizeDiscountTiers(
    product.discountTiers,
    product.discountThreshold,
    product.discountPercent,
    parseFloat(product.basePrice),
  );

  const { categoryId: _categoryId, ...publicProduct } = product;
  return {
    ...publicProduct,
    category: categoryName,
    basePrice: parseFloat(product.basePrice),
    discountPercent: product.discountPercent != null ? parseFloat(product.discountPercent) : null,
    discountTiers,
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    keywords: normalizeProductKeywords(product.keywords),
    images: Array.isArray(product.images) ? product.images : [],
  };
}

function productImageUrls(product: typeof productsTable.$inferSelect | undefined): string[] {
  return product && Array.isArray(product.images)
    ? product.images.filter((value): value is string => typeof value === "string")
    : [];
}

// GET /product-keywords — reusable values for the admin product editor.
router.get("/product-keywords", requireAdmin, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.slice(0, 60) : "";
  const rows = await db
    .select({ keyword: sql<string>`unnest(${productsTable.keywords})` })
    .from(productsTable);

  res.json(collectProductKeywords(rows.map(({ keyword }) => keyword), search));
});

// DELETE /product-keywords — remove the value from every product that uses it.
router.delete("/product-keywords", requireAdmin, async (req, res): Promise<void> => {
  const parsed = DeleteProductKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const keyword = parsed.data.keyword.trim();
  if (!keyword) {
    res.status(400).json({ error: "La palabra clave no puede estar vacía." });
    return;
  }

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: productsTable.id, keywords: productsTable.keywords })
      .from(productsTable);

    for (const product of rows) {
      const currentKeywords = normalizeProductKeywords(product.keywords);
      const keywords = removeProductKeyword(currentKeywords, keyword);
      if (keywords.length === currentKeywords.length) continue;
      await tx
        .update(productsTable)
        .set({ keywords })
        .where(eq(productsTable.id, product.id));
    }
  });

  res.sendStatus(204);
});

async function removeProductStorageImages(
  images: string[],
  request: Request,
): Promise<void> {
  const paths = images
    .map((image) => extractStoragePath("product", image))
    .filter((path): path is string => Boolean(path));
  const results = await Promise.allSettled(paths.map((path) => removeStorageObject("product", path)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      request.log?.error({ err: result.reason, storagePath: paths[index] }, "Product storage deletion failed");
    }
  });
}

// GET /products
router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search, category, slug } = query.data;

  const conditions = [];
  if (search) {
    const searchPattern = `%${search.trim()}%`;
    conditions.push(or(
      ilike(productsTable.name, searchPattern),
      sql`EXISTS (
        SELECT 1
        FROM unnest(${productsTable.keywords}) AS keyword
        WHERE keyword ILIKE ${searchPattern}
      )`,
    )!);
  }
  if (category) conditions.push(eq(categoriesTable.name, category));
  if (slug) conditions.push(eq(productsTable.slug, slug));

  const rows = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.createdAt);

  const products = rows.map(({ product, categoryName }) => serializeProduct(product, categoryName));

  res.json(products);
});

// POST /products
router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    category,
    keywords,
    sizes,
    discountTiers,
    discountPercent,
    discountThreshold,
    basePrice,
    ...rest
  } = parsed.data;

  const categoryRecord = await resolveCategory(category);
  if (!categoryRecord) {
    res.status(400).json({ error: "La categoría seleccionada no existe." });
    return;
  }
  const tiers = normalizeDiscountTiers(
    discountTiers,
    discountThreshold ?? null,
    discountPercent ?? null,
    Number(basePrice),
  );

  const [product] = await db
    .insert(productsTable)
    .values({
      ...rest,
      categoryId: categoryRecord.id,
      keywords: normalizeProductKeywords(keywords),
      basePrice: String(basePrice),
      sizes: (sizes ?? []) as unknown as typeof productsTable.$inferInsert["sizes"],
      discountTiers: tiers,
      ...legacyDiscountFields(tiers),
    })
    .returning();

  res.status(201).json(serializeProduct(product, categoryRecord.name));
});

// GET /products/stats — must come before /:id
router.get("/products/stats", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      category: categoriesTable.name,
      count: sql<number>`count(*)::int`,
    })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.name);

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  res.json({ total, byCategory: rows });
});

// GET /products/:id
router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(serializeProduct(row.product, row.categoryName));
});

// PATCH /products/:id
router.patch("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    category,
    keywords,
    sizes,
    discountTiers,
    discountPercent,
    discountThreshold,
    ...rest
  } = parsed.data;

  const [previousProduct] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .limit(1);

  const updateData: Record<string, unknown> = { ...rest };
  if (category !== undefined) {
    const categoryRecord = await resolveCategory(category);
    if (!categoryRecord) {
      res.status(400).json({ error: "La categoría seleccionada no existe." });
      return;
    }
    updateData.categoryId = categoryRecord.id;
  }
  if (sizes !== undefined) updateData.sizes = sizes;
  if (keywords !== undefined) updateData.keywords = normalizeProductKeywords(keywords);
  if (discountTiers !== undefined) {
    const tiers = normalizeDiscountTiers(discountTiers, null, null, previousProduct ? parseFloat(previousProduct.basePrice) : 0);
    updateData.discountTiers = tiers;
    Object.assign(updateData, legacyDiscountFields(tiers));
  } else if (discountThreshold !== undefined || discountPercent !== undefined) {
    const tiers = normalizeDiscountTiers(
      undefined,
      discountThreshold ?? null,
      discountPercent ?? null,
      previousProduct ? parseFloat(previousProduct.basePrice) : 0,
    );
    updateData.discountTiers = tiers;
    Object.assign(updateData, legacyDiscountFields(tiers));
  }

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const previousImages = new Set(productImageUrls(previousProduct));
  const currentImages = new Set(productImageUrls(product));
  await removeProductStorageImages(
    [...previousImages].filter((image) => !currentImages.has(image)),
    req,
  );

  const [categoryRecord] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, product.categoryId))
    .limit(1);
  res.json(serializeProduct(product, categoryRecord?.name ?? ""));
});

// DELETE /products/:id
router.delete("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await removeProductStorageImages(productImageUrls(product), req);

  res.sendStatus(204);
});

export default router;
