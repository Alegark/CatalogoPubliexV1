import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getUploadDirectory } from "./image-storage.ts";
import { validateImageBytes, validateImageMetadata } from "./image-validation.ts";

export const MAX_BANNER_COUNT = 10;
export const MAX_BANNER_SIZE_BYTES = 5 * 1024 * 1024;

const imageExtensions: Record<string, string> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const LOCAL_BANNER_PREFIX = "local-banners/";
const LOCAL_BANNER_DIRECTORY = "banners";

export type BannerUploadFile = File;

export type StoredBannerImage = {
  storagePath: string;
  url: string;
};

type SupabaseStorageConfig = {
  projectUrl: string;
  serviceRoleKey: string;
  bucket: string;
};

function getStorageConfig(): SupabaseStorageConfig | null {
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/u, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "banners";

  // Development can use local disk. If only one Supabase variable is present,
  // fail instead of silently using a different storage backend.
  if (!projectUrl && !serviceRoleKey && process.env.NODE_ENV !== "production") {
    return null;
  }

  if (!projectUrl || !serviceRoleKey) {
    throw new Error("Supabase Storage no est\u00e1 configurado en la API.");
  }

  return { projectUrl, serviceRoleKey, bucket };
}

function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function publicUrl(config: SupabaseStorageConfig, storagePath: string): string {
  return `${config.projectUrl}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodePath(storagePath)}`;
}

function isLocalBannerPath(storagePath: string): boolean {
  return storagePath.startsWith(LOCAL_BANNER_PREFIX);
}

function getLocalBannerPath(storagePath: string): string {
  const filename = storagePath.slice(LOCAL_BANNER_PREFIX.length);
  if (!filename || filename.includes("/") || filename.includes("\\") || filename !== path.basename(filename)) {
    throw new Error("La ruta local del banner no es v\u00e1lida.");
  }

  return path.join(getUploadDirectory(), LOCAL_BANNER_DIRECTORY, filename);
}

function getLocalBannerUrl(storagePath: string): string {
  const filename = storagePath.slice(LOCAL_BANNER_PREFIX.length);
  return `/api/uploads/${encodeURIComponent(LOCAL_BANNER_DIRECTORY)}/${encodeURIComponent(filename)}`;
}

export function getBannerImageUrl(storagePath: string): string {
  if (isLocalBannerPath(storagePath)) return getLocalBannerUrl(storagePath);

  const config = getStorageConfig();
  if (!config) {
    throw new Error("Supabase Storage no est\u00e1 configurado en la API.");
  }

  return publicUrl(config, storagePath);
}

export function getBannerValidationError(file: BannerUploadFile): string | null {
  return validateImageMetadata(file.name, file.type, file.size);
}

export async function uploadBannerImage(file: BannerUploadFile): Promise<StoredBannerImage> {
  const validationError = getBannerValidationError(file);
  if (validationError) throw new Error(validationError);
  const contents = Buffer.from(await file.arrayBuffer());
  const contentError = validateImageBytes(contents, file.type, file.name);
  if (contentError) throw new Error(contentError);

  const config = getStorageConfig();
  if (!config) {
    const directory = path.join(getUploadDirectory(), LOCAL_BANNER_DIRECTORY);
    await mkdir(directory, { recursive: true });

    const filename = `${randomUUID()}${imageExtensions[file.type]}`;
    const storagePath = `${LOCAL_BANNER_PREFIX}${filename}`;
    await writeFile(path.join(directory, filename), contents, { flag: "wx" });

    return { storagePath, url: getLocalBannerUrl(storagePath) };
  }

  const storagePath = `catalog-banners/${randomUUID()}${imageExtensions[file.type]}`;
  const response = await fetch(
    `${config.projectUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
        "Content-Type": file.type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-upsert": "false",
      },
      body: contents,
    },
  );

  if (!response.ok) {
    await response.text();
    throw new Error(`Supabase Storage rechaz\u00f3 la imagen (${response.status}).`);
  }

  return { storagePath, url: publicUrl(config, storagePath) };
}

export async function removeBannerImage(storagePath: string): Promise<void> {
  if (isLocalBannerPath(storagePath)) {
    await unlink(getLocalBannerPath(storagePath)).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
    return;
  }

  const config = getStorageConfig();
  if (!config) {
    throw new Error("Supabase Storage no est\u00e1 configurado en la API.");
  }

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

  if (!response.ok) {
    await response.text();
    throw new Error(`Supabase Storage no pudo eliminar la imagen (${response.status}).`);
  }
}
