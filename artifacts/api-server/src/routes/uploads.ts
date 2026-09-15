import express, { Router, type IRouter, type Response } from "express";
import { getUploadDirectory, MAX_IMAGE_COUNT, MAX_IMAGE_SIZE_BYTES, removeStoredImage, storeImage, type UploadFileLike } from "../lib/image-storage";
import { requireAdmin } from "../lib/auth";
import {
  completeSignedUpload,
  createSignedUpload,
  STORAGE_KINDS,
  StorageOperationError,
  type StorageKind,
} from "../lib/storage.ts";

const router: IRouter = Router();
const MAX_REQUEST_SIZE = MAX_IMAGE_COUNT * MAX_IMAGE_SIZE_BYTES + 1024 * 1024;

if (process.env.NODE_ENV !== "production") {
  router.use("/uploads", express.static(getUploadDirectory(), {
    fallthrough: true,
    maxAge: "1h",
  }));
}

function parseStorageKind(value: unknown): StorageKind | null {
  return typeof value === "string" && (STORAGE_KINDS as readonly string[]).includes(value)
    ? value as StorageKind
    : null;
}

function parseUploadMetadata(body: unknown): {
  kind: StorageKind;
  name: string;
  contentType: string;
  size: number;
} | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const kind = parseStorageKind(input.kind);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const contentType = typeof input.contentType === "string" ? input.contentType.trim().toLowerCase() : "";
  const size = typeof input.size === "number" ? input.size : Number(input.size);
  if (!kind || !name || name.length > 255 || !contentType || !Number.isInteger(size)) return null;
  return { kind, name, contentType, size };
}

function sendStorageError(response: Response, error: unknown): void {
  if (error instanceof StorageOperationError) {
    response.status(error.httpStatus).json({
      code: error.code,
      error: error.message,
    });
    return;
  }
  response.status(503).json({
    code: "storage_unavailable",
    error: "No se pudo preparar el almacenamiento de la imagen. Verifica la configuración de Supabase Storage.",
  });
}

router.post("/uploads/sign", requireAdmin, async (request, response): Promise<void> => {
  const metadata = parseUploadMetadata(request.body);
  if (!metadata) {
    response.status(400).json({ error: "Los datos de la imagen no son válidos." });
    return;
  }

  try {
    response.json(await createSignedUpload(metadata));
  } catch (error) {
    request.log?.error({ err: error, kind: metadata.kind }, "Signed upload preparation failed");
    sendStorageError(response, error);
  }
});

router.post("/uploads/complete", requireAdmin, async (request, response): Promise<void> => {
  const metadata = parseUploadMetadata(request.body);
  const storagePath = request.body && typeof request.body === "object" && typeof (request.body as Record<string, unknown>).storagePath === "string"
    ? (request.body as Record<string, string>).storagePath
    : "";
  if (!metadata || !storagePath || storagePath.length > 300) {
    response.status(400).json({ error: "Los datos de la imagen no son válidos." });
    return;
  }

  try {
    response.json(await completeSignedUpload({ ...metadata, storagePath }));
  } catch (error) {
    request.log?.error({ err: error, kind: metadata.kind }, "Signed upload completion failed");
    if (error instanceof StorageOperationError) {
      sendStorageError(response, error);
      return;
    }
    response.status(400).json({ error: "No se pudo verificar la imagen cargada." });
  }
});

router.post("/uploads", requireAdmin, async (request, response): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    response.status(400).json({ error: "En producción las imágenes se cargan directamente en Storage." });
    return;
  }
  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (contentLength > MAX_REQUEST_SIZE) {
    response.status(413).json({ error: "El tamaño total de las imágenes supera el límite permitido." });
    return;
  }

  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }

    const multipartRequest = new globalThis.Request("http://localhost/api/uploads", {
      method: "POST",
      headers,
      body: request as unknown as RequestInit["body"],
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const formData = await multipartRequest.formData();
    const entries = formData.getAll("images");
    const files = entries.filter((entry): entry is UploadFileLike => (
      typeof entry !== "string" &&
      typeof entry.name === "string" &&
      typeof entry.type === "string" &&
      typeof entry.size === "number" &&
      typeof entry.arrayBuffer === "function"
    ));

    if (files.length === 0) {
      response.status(400).json({ error: "Selecciona al menos una imagen." });
      return;
    }
    if (files.length > MAX_IMAGE_COUNT) {
      response.status(400).json({ error: `Puedes subir hasta ${MAX_IMAGE_COUNT} imágenes por producto.` });
      return;
    }

    const storedImages = [];
    try {
      for (const file of files) storedImages.push(await storeImage(file));
    } catch (error) {
      await Promise.all(storedImages.map(removeStoredImage));
      const message = error instanceof Error ? error.message : "No se pudo validar una imagen.";
      response.status(400).json({ error: message });
      return;
    }

    response.status(201).json({
      images: storedImages.map(({ originalName, url }) => ({ name: originalName, url })),
    });
  } catch (error) {
    request.log?.error({ err: error }, "Image upload failed");
    response.status(503).json({ error: "No se pudieron guardar las imágenes localmente." });
  }
});

export default router;
