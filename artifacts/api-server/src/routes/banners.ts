import { Router, type IRouter, type Request } from "express";
import { asc, count, eq } from "drizzle-orm";
import {
  bannerLinkSchema,
  bannerOrderSchema,
  bannersTable,
  db,
  productsTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { hasActiveProductOffer } from "../lib/banner-link";
import {
  getBannerImageUrl,
  MAX_BANNER_COUNT,
  MAX_BANNER_SIZE_BYTES,
  removeBannerImage,
  uploadBannerImage,
  type BannerUploadFile,
  type StoredBannerImage,
} from "../lib/banner-storage";
import { completeSignedUpload, removeStorageObject } from "../lib/storage.ts";

const router: IRouter = Router();
const MAX_REQUEST_SIZE = MAX_BANNER_COUNT * MAX_BANNER_SIZE_BYTES + 1024 * 1024;

type BannerProduct = typeof productsTable.$inferSelect | null;

function serializeBanner(banner: typeof bannersTable.$inferSelect, product: BannerProduct = null) {
  const productHasOffer = product ? hasActiveProductOffer(product) : false;
  return {
    id: banner.id,
    url: getBannerImageUrl(banner.storagePath),
    position: banner.position,
    createdAt: banner.createdAt,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    link: productHasOffer && product?.slug ? `/producto/${product.slug}` : null,
  };
}

async function selectBanners() {
  return db
    .select({ banner: bannersTable, product: productsTable })
    .from(bannersTable)
    .leftJoin(productsTable, eq(bannersTable.productId, productsTable.id))
    .orderBy(asc(bannersTable.position), asc(bannersTable.id));
}

async function getMultipartImages(request: Request): Promise<BannerUploadFile[]> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }

  const multipartRequest = new globalThis.Request("http://localhost/api/banners", {
    method: "POST",
    headers,
    body: request as unknown as RequestInit["body"],
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const formData = await multipartRequest.formData();
  return formData.getAll("images").filter((entry): entry is BannerUploadFile => (
    typeof entry !== "string" &&
    typeof entry.name === "string" &&
    typeof entry.type === "string" &&
    typeof entry.size === "number" &&
    typeof entry.arrayBuffer === "function"
  ));
}

router.get("/banners", async (_request, response): Promise<void> => {
  const banners = await selectBanners();

  response.json(banners.map(({ banner, product }) => serializeBanner(banner, product)));
});

router.post("/banners", requireAdmin, async (request, response): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    response.status(400).json({ error: "En producci?n las im?genes se cargan directamente en Storage." });
    return;
  }

  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (contentLength > MAX_REQUEST_SIZE) {
    response.status(413).json({ error: "El tama?o total de los banners supera el l?mite permitido." });
    return;
  }

  try {
    const files = await getMultipartImages(request);
    if (files.length === 0) {
      response.status(400).json({ error: "Selecciona al menos una imagen para el carrusel." });
      return;
    }
    if (files.length > MAX_BANNER_COUNT) {
      response.status(400).json({ error: `Puedes subir hasta ${MAX_BANNER_COUNT} banners.` });
      return;
    }

    const [{ total }] = await db.select({ total: count() }).from(bannersTable);
    if (total + files.length > MAX_BANNER_COUNT) {
      response.status(400).json({
        error: `El carrusel admite hasta ${MAX_BANNER_COUNT} banners. Ya tienes ${total}.`,
      });
      return;
    }

    const uploaded: StoredBannerImage[] = [];
    try {
      for (const file of files) uploaded.push(await uploadBannerImage(file));
    } catch (error) {
      await Promise.allSettled(uploaded.map(({ storagePath }) => removeBannerImage(storagePath)));
      const message = error instanceof Error ? error.message : "No se pudieron guardar los banners.";
      response.status(400).json({ error: message });
      return;
    }

    try {
      const created = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(bannersTable)
          .values(uploaded.map(({ storagePath }, index) => ({
            storagePath,
            position: total + index,
          })))
          .returning();
        return rows;
      });
      response.status(201).json(created.map((banner) => serializeBanner(banner)));
    } catch (error) {
      await Promise.allSettled(uploaded.map(({ storagePath }) => removeBannerImage(storagePath)));
      throw error;
    }
  } catch (error) {
    request.log?.error({ err: error }, "Banner upload failed");
    response.status(503).json({ error: "No se pudieron guardar los banners." });
  }
});

router.post("/banners/from-storage", requireAdmin, async (request, response): Promise<void> => {
  const body = request.body as { uploads?: unknown };
  const uploads = Array.isArray(body?.uploads) ? body.uploads : [];
  if (uploads.length < 1 || uploads.length > MAX_BANNER_COUNT) {
    response.status(400).json({ error: `Debes enviar entre 1 y ${MAX_BANNER_COUNT} banners.` });
    return;
  }

  const [{ total }] = await db.select({ total: count() }).from(bannersTable);
  if (total + uploads.length > MAX_BANNER_COUNT) {
    response.status(400).json({
      error: `El carrusel admite hasta ${MAX_BANNER_COUNT} banners. Ya tienes ${total}.`,
    });
    return;
  }

  const completed: Array<{ storagePath: string }> = [];
  try {
    for (const upload of uploads) {
      if (!upload || typeof upload !== "object") throw new Error("Datos de imagen inv?lidos.");
      const item = upload as Record<string, unknown>;
      const storagePath = typeof item.storagePath === "string" ? item.storagePath : "";
      const name = typeof item.name === "string" ? item.name : "banner";
      const contentType = typeof item.contentType === "string" ? item.contentType : "";
      const size = typeof item.size === "number" ? item.size : Number(item.size);
      if (!storagePath || !contentType || !Number.isInteger(size)) throw new Error("Datos de imagen inv?lidos.");
      await completeSignedUpload({ kind: "banner", storagePath, name, contentType, size });
      completed.push({ storagePath });
    }

    const created = await db.transaction(async (tx) => tx
      .insert(bannersTable)
      .values(completed.map(({ storagePath }, index) => ({ storagePath, position: total + index })))
      .returning());
    response.status(201).json(created.map((banner) => serializeBanner(banner)));
  } catch (error) {
    await Promise.allSettled(completed.map(({ storagePath }) => removeStorageObject("banner", storagePath)));
    request.log?.error({ err: error }, "Storage banner finalization failed");
    response.status(400).json({ error: "No se pudieron registrar los banners cargados." });
  }
});

router.patch("/banners/:id", requireAdmin, async (request, response, next): Promise<void> => {
  // Let the static /banners/order route below handle its own path.
  if (request.params.id === "order") {
    next();
    return;
  }
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    response.status(400).json({ error: "Identificador de banner inv?lido." });
    return;
  }

  const parsed = bannerLinkSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "El producto vinculado no es v?lido." });
    return;
  }

  const [banner] = await db.select().from(bannersTable).where(eq(bannersTable.id, id)).limit(1);
  if (!banner) {
    response.status(404).json({ error: "Banner no encontrado." });
    return;
  }

  let product: BannerProduct = null;
  if (parsed.data.productId !== null) {
    const [productRecord] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, parsed.data.productId))
      .limit(1);

    if (!productRecord) {
      response.status(400).json({ error: "El producto seleccionado no existe." });
      return;
    }
    if (!hasActiveProductOffer(productRecord)) {
      response.status(400).json({ error: "El producto seleccionado no tiene una oferta activa." });
      return;
    }
    product = productRecord;
  }

  const [updated] = await db
    .update(bannersTable)
    .set({ productId: parsed.data.productId })
    .where(eq(bannersTable.id, id))
    .returning();

  response.json(serializeBanner(updated, product));
});

router.patch("/banners/order", requireAdmin, async (request, response): Promise<void> => {
  const parsed = bannerOrderSchema.safeParse(request.body);
  if (!parsed.success || new Set(parsed.data.ids).size !== parsed.data.ids.length) {
    response.status(400).json({ error: "El orden de banners no es v?lido." });
    return;
  }

  const banners = await db.select({ id: bannersTable.id }).from(bannersTable);
  const currentIds = new Set(banners.map(({ id }) => id));
  if (currentIds.size !== parsed.data.ids.length || parsed.data.ids.some((id) => !currentIds.has(id))) {
    response.status(400).json({ error: "El orden no coincide con los banners actuales." });
    return;
  }

  await db.transaction(async (tx) => {
    for (const [position, id] of parsed.data.ids.entries()) {
      await tx.update(bannersTable).set({ position }).where(eq(bannersTable.id, id));
    }
  });

  const updated = await selectBanners();
  response.json(updated.map(({ banner, product }) => serializeBanner(banner, product)));
});

router.delete("/banners/:id", requireAdmin, async (request, response): Promise<void> => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    response.status(400).json({ error: "Identificador de banner inv?lido." });
    return;
  }

  const [banner] = await db.select().from(bannersTable).where(eq(bannersTable.id, id)).limit(1);
  if (!banner) {
    response.status(404).json({ error: "Banner no encontrado." });
    return;
  }

  try {
    await removeBannerImage(banner.storagePath);
  } catch (error) {
    request.log?.error({ err: error, bannerId: id }, "Banner storage deletion failed");
    response.status(503).json({ error: "No se pudo eliminar la imagen del banner." });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(bannersTable).where(eq(bannersTable.id, id));
    const remaining = await tx
      .select({ id: bannersTable.id })
      .from(bannersTable)
      .orderBy(asc(bannersTable.position), asc(bannersTable.id));
    for (const [position, remainingBanner] of remaining.entries()) {
      await tx.update(bannersTable).set({ position }).where(eq(bannersTable.id, remainingBanner.id));
    }
  });

  response.sendStatus(204);
});

export default router;
