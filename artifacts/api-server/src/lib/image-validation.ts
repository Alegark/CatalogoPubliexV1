export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type SupportedImageMime =
  | "image/avif"
  | "image/gif"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

const MIME_BY_EXTENSION: Record<string, SupportedImageMime> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const SUPPORTED_IMAGE_MIMES = new Set<SupportedImageMime>(Object.values(MIME_BY_EXTENSION));

export function extensionForMime(mime: string): string | null {
  const entry = Object.entries(MIME_BY_EXTENSION).find(([, value]) => value === mime);
  return entry ? `.${entry[0] === "jpeg" ? "jpg" : entry[0]}` : null;
}

export function isSupportedImageMime(value: string): value is SupportedImageMime {
  return SUPPORTED_IMAGE_MIMES.has(value as SupportedImageMime);
}

function startsWithBytes(buffer: Uint8Array, bytes: number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function detectImageMime(buffer: Uint8Array): SupportedImageMime | null {
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";

  const header = new TextDecoder("ascii").decode(buffer.subarray(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif";
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp";
  if (header.slice(4, 8) === "ftyp" && /^(avif|avis|av01)$/u.test(header.slice(8, 12))) {
    return "image/avif";
  }
  return null;
}

export function validateImageBytes(
  buffer: Uint8Array,
  declaredMime: string,
  name = "La imagen",
): string | null {
  if (!isSupportedImageMime(declaredMime)) {
    return `"${name}" no es una imagen compatible. Usa JPG, PNG, WEBP, GIF o AVIF.`;
  }
  if (buffer.byteLength <= 0) return `"${name}" está vacío.`;
  if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) return `"${name}" supera el límite de 5 MB.`;

  const detectedMime = detectImageMime(buffer);
  if (!detectedMime) return `"${name}" no contiene una imagen válida.`;
  if (detectedMime !== declaredMime) {
    return `"${name}" no coincide con el formato declarado.`;
  }
  return null;
}

export function validateImageMetadata(
  name: string,
  mime: string,
  size: number,
): string | null {
  if (!isSupportedImageMime(mime)) {
    return `"${name}" no es una imagen compatible. Usa JPG, PNG, WEBP, GIF o AVIF.`;
  }
  if (!Number.isInteger(size) || size <= 0) return `"${name}" está vacío.`;
  if (size > MAX_IMAGE_SIZE_BYTES) return `"${name}" supera el límite de 5 MB.`;
  return null;
}
