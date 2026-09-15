import {
  uploadBanners as uploadBannersLegacy,
  uploadProductImages as uploadImagesLegacy,
} from '@workspace/api-client-react';

export interface UploadedImage {
  name: string;
  url: string;
  storagePath?: string;
}

const MAX_IMAGE_DIMENSION = 1600;
const MAX_OPTIMIZED_SIZE = 1.5 * 1024 * 1024;
const MIN_SIZE_TO_OPTIMIZE = 350 * 1024;
const OPTIMIZABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`No se pudo leer la imagen "${file.name}".`));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
}

/** Optimiza imágenes grandes en el navegador antes de enviarlas al servidor. */
export async function optimizeImageForUpload(file: File): Promise<File> {
  if (!OPTIMIZABLE_TYPES.has(file.type) || file.size < MIN_SIZE_TO_OPTIMIZE) {
    return file;
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / image.naturalWidth,
      MAX_IMAGE_DIMENSION / image.naturalHeight,
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    if (scale === 1 && file.size <= MAX_OPTIMIZED_SIZE) return file;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'imagen';
    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
  } catch {
    // Si el navegador no puede decodificar el formato, el servidor lo valida.
    return file;
  }
}

export async function uploadProductImages(files: File[]): Promise<UploadedImage[]> {
  const optimizedFiles = await Promise.all(files.map(optimizeImageForUpload));
  return uploadImagesWithStorage('product', optimizedFiles);
}

type StorageKind = 'product' | 'banner';
type SignedUploadResponse = {
  mode: 'signed';
  storagePath: string;
  uploadUrl: string;
  publicUrl: string;
} | { mode: 'legacy' };

async function readApiError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Use the status below when the API did not return JSON.
  }
  return `HTTP ${response.status} ${response.statusText}`;
}

async function requestSignedUpload(kind: StorageKind, file: File): Promise<SignedUploadResponse> {
  const response = await fetch('/api/uploads/sign', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      name: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<SignedUploadResponse>;
}

async function completeSignedUpload(kind: StorageKind, file: File, storagePath: string): Promise<UploadedImage> {
  const response = await fetch('/api/uploads/complete', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      name: file.name,
      contentType: file.type,
      size: file.size,
      storagePath,
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const completed = await response.json() as { name: string; url: string; storagePath: string };
  return completed;
}

async function uploadImagesWithStorage(kind: StorageKind, files: File[]): Promise<UploadedImage[]> {
  if (files.length === 0) return [];
  const first = await requestSignedUpload(kind, files[0]);
  if (first.mode === 'legacy') {
    if (kind === 'product') {
      const response = await uploadImagesLegacy({ images: files });
      return response.images;
    }
    await uploadBannersLegacy({ images: files });
    return [];
  }

  const signed = [first, ...(await Promise.all(files.slice(1).map((file) => requestSignedUpload(kind, file))))];
  const completed: UploadedImage[] = [];
  try {
    for (const [index, upload] of signed.entries()) {
      if (upload.mode !== 'signed') throw new Error('El modo de almacenamiento cambió durante la carga.');
      const file = files[index];
      const uploadResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-upsert': 'false',
        },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error(`No se pudo cargar "${file.name}" en Storage.`);
      completed.push(await completeSignedUpload(kind, file, upload.storagePath));
    }
  } catch (error) {
    throw error;
  }
  return completed;
}

export async function uploadBannerImages(files: File[]): Promise<void> {
  const optimizedFiles = await Promise.all(files.map(optimizeImageForUpload));
  const uploaded = await uploadImagesWithStorage('banner', optimizedFiles);
  if (uploaded.length === 0) return;

  const response = await fetch('/api/banners/from-storage', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploads: uploaded.map((image, index) => ({
        storagePath: image.storagePath,
        name: optimizedFiles[index].name,
        contentType: optimizedFiles[index].type,
        size: optimizedFiles[index].size,
      })),
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}
