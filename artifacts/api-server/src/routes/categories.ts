import { Router, type IRouter } from "express";
import { db, categoriesTable, categoryNameSchema, productsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { CreateCategoryBody, DeleteCategoryBody, DeleteCategoryParams } from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";
import { categorySlug } from "../lib/category-utils";
import { validateCategoryDeletion } from "../lib/category-deletion";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(categoriesTable)
    .orderBy(asc(categoriesTable.name));

  res.json(rows);
});

router.post("/categories", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = categoryNameSchema.parse(parsed.data.name);
  const slug = categorySlug(name);
  if (!slug) {
    res.status(400).json({ error: "La categor?a debe incluir letras o n?meros." });
    return;
  }

  const [existing] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "La categor?a ya existe." });
    return;
  }

  try {
    const [category] = await db
      .insert(categoriesTable)
      .values({ name, slug })
      .returning();

    res.status(201).json(category);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "La categor?a ya existe." });
      return;
    }
    throw error;
  }
});

router.delete("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = DeleteCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [category] = await tx
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, params.data.id))
      .limit(1);

    if (!category) return { kind: "not-found" as const };

    const products = await tx
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.categoryId, category.id));
    const replacementCategoryId = parsed.data.replacementCategoryId;
    let replacementExists = false;

    if (replacementCategoryId !== null) {
      const [replacement] = await tx
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, replacementCategoryId))
        .limit(1);
      replacementExists = Boolean(replacement);
    }

    const validationError = validateCategoryDeletion({
      categoryId: category.id,
      productCount: products.length,
      replacementCategoryId,
      replacementExists,
    });
    if (validationError) {
      return { kind: "invalid" as const, message: validationError.message };
    }

    if (products.length > 0 && replacementCategoryId !== null) {
      await tx
        .update(productsTable)
        .set({ categoryId: replacementCategoryId })
        .where(eq(productsTable.categoryId, category.id));
    }

    await tx.delete(categoriesTable).where(eq(categoriesTable.id, category.id));
    return {
      kind: "deleted" as const,
      deletedCategoryId: category.id,
      replacementCategoryId,
      movedProductCount: products.length,
    };
  });

  if (result.kind === "not-found") {
    res.status(404).json({ error: "La categor?a no existe." });
    return;
  }
  if (result.kind === "invalid") {
    res.status(400).json({ error: result.message });
    return;
  }

  res.json({
    deletedCategoryId: result.deletedCategoryId,
    replacementCategoryId: result.replacementCategoryId,
    movedProductCount: result.movedProductCount,
  });
});

export default router;
