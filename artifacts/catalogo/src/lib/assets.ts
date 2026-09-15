import portaTarjetas from '@assets/Porta-Tarjetas_1784777305367.png';
import portaRetrato1 from '@assets/Sin-título-2_1784777305367.png';
import escalera from '@assets/Escalera_Acrilica_1784777305367.png';
import cubos from '@assets/Cubos_Acrilicos_1784777305367.png';
import habladorPared from '@assets/HabladorPared_1784777305368.png';
import habladorT from '@assets/Hablador_t_1784777305368.png';
import habladorL from '@assets/Hablador_L_1784777305369.png';
import portaRetrato2 from '@assets/Porta_Retrato_1784777305368.png';

// Fallback images in case the API doesn't provide real URLs
export const fallbackImages = [
  portaTarjetas,
  portaRetrato1,
  escalera,
  cubos,
  habladorPared,
  habladorT,
  habladorL,
  portaRetrato2
];

function isUsableImageSource(value: string): boolean {
  return value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/') ||
    value.startsWith('data:image/');
}

// Helper to safely get an image source. Supports remote URLs and local API uploads.
export function getProductImage(images: string[], productId: number) {
  if (images && images.length > 0 && isUsableImageSource(images[0])) {
    return images[0];
  }
  // Deterministic fallback based on ID
  return fallbackImages[productId % fallbackImages.length];
}

export function getAllProductImages(images: string[], productId: number) {
  if (images && images.length > 0 && images.every(isUsableImageSource)) {
    return images;
  }
  // Return a couple of fallbacks
  return [
    fallbackImages[productId % fallbackImages.length],
    fallbackImages[(productId + 1) % fallbackImages.length],
  ];
}
