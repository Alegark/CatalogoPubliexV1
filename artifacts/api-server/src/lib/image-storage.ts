import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  validateImageBytes,
  validateImageMetadata,
} from "./image-validation.ts";
export { MAX_IMAGE_SIZE_BYTES } from "./image-validation.ts";

export const MAX_IMAGE_COUNT = 10;

const imageExtensions: Record<string, string> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export type UploadFileLike = File;

export interface StoredImage {
  filePath: string;
  originalName: string;
  url: string;
}

export function getUploadDirectory(): string {
  return path.resolve(process.cwd(), "uploads");
}

export function getImageValidationError(file: UploadFileLike): string | null {
  return validateImageMetadata(file.name, file.type, file.size);
}

export async function storeImage(file: UploadFileLike): Promise<StoredImage> {
  const validationError = getImageValidationError(file);
  if (validationError) throw new Error(validationError);

  const directory = getUploadDirectory();
  await mkdir(directory, { recursive: true });

  const filename = `${randomUUID()}${imageExtensions[file.type]}`;
  const filePath = path.join(directory, filename);
  const contents = Buffer.from(await file.arrayBuffer());
  const contentError = validateImageBytes(contents, file.type, file.name);
  if (contentError) throw new Error(contentError);
  await writeFile(filePath, contents, { flag: "wx" });

  return {
    filePath,
    originalName: file.name,
    url: `/api/uploads/${filename}`,
  };
}

export async function removeStoredImage(image: StoredImage): Promise<void> {
  await unlink(image.filePath).catch(() => undefined);
}
