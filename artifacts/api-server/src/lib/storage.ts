import { randomUUID } from "node:crypto";
import { extensionForMime, validateImageBytes, validateImageMetadata, type SupportedImageMime } from "./image-validation.ts";

export const STORAGE_KINDS = ["product", "banner"] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

type StorageConfig = {
  projectUrl: string;
  serviceRoleKey: string;
  bucket: string;
  prefix: string;
};

export type SignedUpload = {
  mode: "signed";
  kind: StorageKind;
  bucket: string;
  storagePath: string;
  uploadUrl: string;
  publicUrl: string;
};

export type LegacyUpload = { mode: "legacy" };

export type CompletedUpload = {
  kind: StorageKind;
  storagePath: string;
  url: string;
  name: string;
};

export type StorageFailureCode =
  | "not_configured"
  | "invalid_credentials"
  | "bucket_missing"
  | "unavailable";

export class StorageOperationError extends Error {
  constructor(
    public readonly code: StorageFailureCode,
    message: string,
    public readonly httpStatus = 503,
  ) {
    super(message);
    this.name = "StorageOperationError";
  }
}

const BUCKET_ENV: Record<StorageKind, string> = {
  product: "SUPABASE_PRODUCT_STORAGE_BUCKET",
  banner: "SUPABASE_STORAGE_BUCKET",
};

const DEFAULT_BUCKET: Record<StorageKind, string> = {
  product: "products",
  banner: "banners",
};

const PREFIX: Record<StorageKind, string> = {
  product: "catalog-products",
  banner: "catalog-banners",
};

function getStorageConfig(kind: StorageKind): StorageConfig | null {
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/u, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env[BUCKET_ENV[kind]] ?? DEFAULT_BUCKET[kind];

  if (!projectUrl && !serviceRoleKey && process.env.NODE_ENV !== "production") return null;
  if (!projectUrl || !serviceRoleKey) {
    throw new StorageOperationError(
      "not_configured",
      "Supabase Storage no está configurado completamente en la API.",
    );
  }
  return { projectUrl, serviceRoleKey, bucket, prefix: PREFIX[kind] };
}

export function isStorageConfigured(kind: StorageKind): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && (
    process.env[BUCKET_ENV[kind]] || DEFAULT_BUCKET[kind]
  ));
}

function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function publicUrl(config: StorageConfig, storagePath: string): string {
  return `${config.projectUrl}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodePath(storagePath)}`;
}

function isSafeStoragePath(config: StorageConfig, storagePath: string): boolean {
  return storagePath.startsWith(`${config.prefix}/`)
    && !storagePath.includes("\\")
    && !storagePath.includes("..")
    && !storagePath.includes("//");
}

function absoluteStorageUrl(config: StorageConfig, value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return new URL(`/storage/v1${value.startsWith("/") ? value : `/${value}`}`, config.projectUrl).toString();
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string; error?: string; statusCode?: number };
    return body.message ?? body.error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function createSignedUpload(input: {
  kind: StorageKind;
  name: string;
  contentType: string;
  size: number;
}): Promise<SignedUpload | LegacyUpload> {
  const metadataError = validateImageMetadata(input.name, input.contentType, input.size);
  if (metadataError) throw new Error(metadataError);

  const config = getStorageConfig(input.kind);
  if (!config) return { mode: "legacy" };

  const extension = extensionForMime(input.contentType as SupportedImageMime);
  if (!extension) throw new Error("Formato de imagen no permitido.");

  const storagePath = `${config.prefix}/${randomUUID()}${extension}`;
  const response = await fetch(
    `${config.projectUrl}/storage/v1/object/upload/sign/${encodeURIComponent(config.bucket)}/${encodePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (!response.ok) {
    const details = await readError(response);
    if (
      response.status === 401
      || response.status === 403
      || /jwt|token|api.?key|authorization|malformed|invalid key/i.test(details)
    ) {
      throw new StorageOperationError(
        "invalid_credentials",
        "Las credenciales de Supabase Storage no son válidas o no tienen permisos suficientes.",
        503,
      );
    }
    if (response.status === 404 || /bucket|not found|no existe/i.test(details)) {
      throw new StorageOperationError(
        "bucket_missing",
        `No existe el bucket de imágenes configurado para ${input.kind === "product" ? "productos" : "banners"}.`,
        503,
      );
    }
    throw new StorageOperationError(
      "unavailable",
      "Supabase Storage no pudo preparar la imagen en este momento.",
      503,
    );
  }

  const payload = await response.json() as { url?: string; signedURL?: string; signedUrl?: string };
  const rawUrl = payload.signedUrl ?? payload.signedURL ?? payload.url;
  if (!rawUrl) {
    throw new StorageOperationError(
      "unavailable",
      "Supabase Storage no devolvió una URL firmada.",
      503,
    );
  }

  return {
    mode: "signed",
    kind: input.kind,
    bucket: config.bucket,
    storagePath,
    uploadUrl: absoluteStorageUrl(config, rawUrl),
    publicUrl: publicUrl(config, storagePath),
  };
}

export async function completeSignedUpload(input: {
  kind: StorageKind;
  storagePath: string;
  name: string;
  contentType: string;
  size: number;
}): Promise<CompletedUpload> {
  const metadataError = validateImageMetadata(input.name, input.contentType, input.size);
  if (metadataError) throw new Error(metadataError);

  const config = getStorageConfig(input.kind);
  if (!config) {
    throw new StorageOperationError(
      "not_configured",
      "Supabase Storage no está configurado en la API.",
    );
  }
  if (!isSafeStoragePath(config, input.storagePath)) throw new Error("La ruta de Storage no es válida.");

  const response = await fetch(publicUrl(config, input.storagePath));
  if (!response.ok) throw new Error("La imagen no se encontró en Supabase Storage.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentError = validateImageBytes(bytes, input.contentType, input.name);
  if (contentError) throw new Error(contentError);
  if (bytes.byteLength !== input.size) throw new Error("El tamaño de la imagen no coincide con el archivo enviado.");

  return {
    kind: input.kind,
    storagePath: input.storagePath,
    url: publicUrl(config, input.storagePath),
    name: input.name,
  };
}

export async function removeStorageObject(kind: StorageKind, storagePath: string): Promise<void> {
  const config = getStorageConfig(kind);
  if (!config) return;
  if (!isSafeStoragePath(config, storagePath)) throw new Error("La ruta de Storage no es válida.");

  const response = await fetch(
    `${config.projectUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodePath(storagePath)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
      },
    },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase Storage no pudo eliminar la imagen (${response.status}).`);
  }
}

export function getStoragePublicUrl(kind: StorageKind, storagePath: string): string {
  const config = getStorageConfig(kind);
  if (!config) {
    throw new StorageOperationError(
      "not_configured",
      "Supabase Storage no está configurado en la API.",
    );
  }
  if (!isSafeStoragePath(config, storagePath)) throw new Error("La ruta de Storage no es válida.");
  return publicUrl(config, storagePath);
}

export function extractStoragePath(kind: StorageKind, value: string): string | null {
  const config = getStorageConfig(kind);
  if (!config) return null;
  const prefix = `${config.projectUrl}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/`;
  if (!value.startsWith(prefix)) return null;
  const rawPath = value.slice(prefix.length).split("?")[0];
  try {
    const decoded = rawPath.split("/").map(decodeURIComponent).join("/");
    return isSafeStoragePath(config, decoded) ? decoded : null;
  } catch {
    return null;
  }
}
