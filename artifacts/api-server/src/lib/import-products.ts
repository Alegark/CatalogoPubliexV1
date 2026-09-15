import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  discountTierSchema,
  pool,
  productSizeSchema,
  productsTable,
  type DiscountTier,
  type ProductSize,
} from "@workspace/db";
import { categorySlug } from "./category-utils.ts";

type ImportProduct = {
  slug: string;
  name: string;
  category: string;
  description?: string;
  basePrice: number;
  deliveryTime: string;
  keywords?: string[];
};

type ImportVariant = {
  productSlug: string;
  name: string;
  price: number;
  measurements?: string;
  acrylicThicknessCm?: number;
  acrylicColor?: string;
};

type ImportOffer = {
  productSlug: string;
  threshold: number;
  amountOffUsd?: number;
  percent?: number;
};

type ImportImage = {
  productSlug: string;
  url: string;
  order?: number;
};

type ImportFile = {
  products: ImportProduct[];
  variants?: ImportVariant[];
  offers?: ImportOffer[];
  images?: ImportImage[];
};

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireOption(name: string): string {
  const value = readOption(name);
  if (!value) throw new Error(`Falta el argumento ${name}.`);
  return value;
}

function uniqueTiers(rows: ImportOffer[], basePriceUsd: number): DiscountTier[] {
  const byThreshold = new Map<number, DiscountTier>();
  for (const row of rows) {
    const amountOffUsd = row.amountOffUsd !== undefined
      ? row.amountOffUsd
      : Math.round(basePriceUsd * (row.percent ?? 0) / 100 * 100) / 100;
    byThreshold.set(row.threshold, {
      threshold: row.threshold,
      amountOffUsd,
    });
  }
  return [...byThreshold.values()].sort((a, b) => a.threshold - b.threshold);
}

function textValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} debe ser un texto no vacío.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${field} supera el máximo de ${maxLength} caracteres.`);
  }
  return normalized;
}

function numberValue(value: unknown, field: string, maximum: number, allowZero = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    const minimumDescription = allowZero ? "mayor o igual que 0" : "mayor que 0";
    throw new Error(`${field} debe ser un número ${minimumDescription} y menor o igual que ${maximum}.`);
  }
  const isBelowMinimum = allowZero ? value < 0 : value <= 0;
  if (isBelowMinimum || value > maximum) {
    const minimumDescription = allowZero ? "mayor o igual que 0" : "mayor que 0";
    throw new Error(`${field} debe ser un número ${minimumDescription} y menor o igual que ${maximum}.`);
  }
  return value;
}

function normalizeProduct(
  product: ImportProduct,
  sizes: Array<Pick<ImportVariant, "name" | "price" | "measurements" | "acrylicThicknessCm" | "acrylicColor">>,
  tiers: DiscountTier[],
  images: string[],
) {
  const normalizedSizes = sizes.map((size) => {
    const parsed = productSizeSchema.safeParse({
      name: textValue(size.name, "nombre de variante", 80),
      price: numberValue(size.price, "precio de variante", 1_000_000, true),
      ...(size.measurements?.trim()
        ? { measurements: textValue(size.measurements, "medidas", 120) }
        : {}),
      ...(size.acrylicThicknessCm !== undefined
        ? { acrylicThicknessCm: numberValue(size.acrylicThicknessCm, "grosor del acrílico", 100, true) }
        : {}),
      ...(size.acrylicColor?.trim()
        ? { acrylicColor: textValue(size.acrylicColor, "color del acrílico", 60) }
        : {}),
    });
    if (!parsed.success) throw new Error(`Variante inválida en ${product.slug}.`);
    return parsed.data;
  });
  if (normalizedSizes.length > 20) throw new Error(`El producto ${product.slug} supera 20 variantes.`);

  const normalizedTiers = tiers.map((tier) => {
    const parsed = discountTierSchema.safeParse(tier);
    if (!parsed.success) throw new Error(`Oferta inválida en ${product.slug}.`);
    return parsed.data;
  });
  if (normalizedTiers.length > 20) throw new Error(`El producto ${product.slug} supera 20 ofertas.`);
  if (images.length > 10) throw new Error(`El producto ${product.slug} supera 10 imágenes.`);

  return {
    name: textValue(product.name, "nombre", 120),
    slug: textValue(product.slug, "slug", 160),
    category: textValue(product.category, "categoría", 80),
    description: product.description ? textValue(product.description, "descripción", 4_000) : undefined,
    basePrice: numberValue(product.basePrice, "precio base", 1_000_000, true),
    deliveryTime: textValue(product.deliveryTime, "tiempo de entrega", 120),
    keywords: product.keywords ?? [],
    images,
    sizes: normalizedSizes,
    discountTiers: normalizedTiers,
  };
}

function buildImportRows(input: ImportFile) {
  if (!Array.isArray(input.products) || input.products.length === 0) {
    throw new Error("El archivo debe incluir al menos un producto.");
  }

  const slugs = new Set<string>();
  const variantsBySlug = new Map<string, ImportVariant[]>();
  const offersBySlug = new Map<string, ImportOffer[]>();
  const imagesBySlug = new Map<string, ImportImage[]>();

  for (const product of input.products) {
    if (slugs.has(product.slug)) throw new Error(`Slug duplicado: ${product.slug}`);
    slugs.add(product.slug);
  }

  for (const variant of input.variants ?? []) {
    if (!slugs.has(variant.productSlug)) {
      throw new Error(`La variante apunta a un slug inexistente: ${variant.productSlug}`);
    }
    const rows = variantsBySlug.get(variant.productSlug) ?? [];
    rows.push(variant);
    variantsBySlug.set(variant.productSlug, rows);
  }

  for (const offer of input.offers ?? []) {
    if (!slugs.has(offer.productSlug)) {
      throw new Error(`La oferta apunta a un slug inexistente: ${offer.productSlug}`);
    }
    const rows = offersBySlug.get(offer.productSlug) ?? [];
    rows.push(offer);
    offersBySlug.set(offer.productSlug, rows);
  }

  for (const image of input.images ?? []) {
    if (!slugs.has(image.productSlug)) {
      throw new Error(`La imagen apunta a un slug inexistente: ${image.productSlug}`);
    }
    const rows = imagesBySlug.get(image.productSlug) ?? [];
    rows.push(image);
    imagesBySlug.set(image.productSlug, rows);
  }

  return input.products.map((product) => {
    const sizes = (variantsBySlug.get(product.slug) ?? []).map<ProductSize>((variant) => ({
      name: variant.name,
      price: variant.price,
      ...(variant.measurements?.trim() ? { measurements: variant.measurements } : {}),
      ...(variant.acrylicThicknessCm !== undefined ? { acrylicThicknessCm: variant.acrylicThicknessCm } : {}),
      ...(variant.acrylicColor?.trim() ? { acrylicColor: variant.acrylicColor } : {}),
    }));
    const discountTiers = uniqueTiers(offersBySlug.get(product.slug) ?? [], product.basePrice);
    const images = (imagesBySlug.get(product.slug) ?? [])
      .sort((a, b) => (a.order ?? 1) - (b.order ?? 1))
      .map((image) => image.url);
    const parsed = normalizeProduct(product, sizes, discountTiers, images);

    const firstTier = discountTiers[0];
    const { category: categoryName, ...productFields } = parsed;
    return {
      ...productFields,
      categoryName,
      basePrice: String(productFields.basePrice),
      sizes: productFields.sizes as unknown as typeof productsTable.$inferInsert["sizes"],
      discountTiers,
      discountThreshold: firstTier?.threshold ?? null,
      discountPercent: null,
    };
  });
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log("Uso: pnpm run db:import -- --file ruta/catalogo.json [--replace]");
    console.log("--replace requiere CONFIRM_REPLACE=YES y elimina solo la tabla products.");
    return;
  }

  const filePath = path.resolve(process.cwd(), requireOption("--file"));
  const replace = process.argv.includes("--replace");
  if (replace && process.env.CONFIRM_REPLACE !== "YES") {
    throw new Error("Para reemplazar productos define CONFIRM_REPLACE=YES explícitamente.");
  }

  const input = JSON.parse(await readFile(filePath, "utf8")) as ImportFile;
  const rows = buildImportRows(input);

  await db.transaction(async (tx) => {
    const categoryIds = new Map<string, number>();
    for (const row of rows) {
      const slug = categorySlug(row.categoryName);
      if (categoryIds.has(slug)) continue;

      const [existing] = await tx
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(eq(categoriesTable.slug, slug))
        .limit(1);
      const [category] = existing
        ? [existing]
        : await tx.insert(categoriesTable).values({ name: row.categoryName, slug }).returning({ id: categoriesTable.id });
      categoryIds.set(slug, category.id);
    }
    if (replace) await tx.delete(productsTable);
    await tx.insert(productsTable).values(rows.map(({ categoryName, ...row }) => ({
      ...row,
      categoryId: categoryIds.get(categorySlug(categoryName))!,
    })));
  });

  console.log(`${rows.length} productos importados correctamente.`);
}

try {
  await main();
} finally {
  await pool.end();
}
