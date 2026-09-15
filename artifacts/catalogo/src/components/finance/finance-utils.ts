import { getProductImage } from '@/lib/assets';
import type { Product } from '@workspace/api-client-react';
import type { QuoteCurrency, QuoteLine, QuoteLineCalculation, QuoteTotals } from './types';

export const BUDGET_COUNTER_KEY = 'publiex:finance:last-budget-number';
export const MAX_LOCAL_IMAGE_BYTES = 5 * 1024 * 1024;

export function createLineId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function getSuggestedBudgetNumber(): string {
  if (typeof window === 'undefined') return '00001';
  const previous = Number.parseInt(window.localStorage.getItem(BUDGET_COUNTER_KEY) ?? '', 10);
  const next = Number.isInteger(previous) && previous > 0 ? previous + 1 : 1;
  return String(next).padStart(5, '0');
}

export function rememberBudgetNumber(value: string): void {
  const numeric = Number.parseInt(value, 10);
  if (typeof window !== 'undefined' && Number.isInteger(numeric) && numeric > 0) {
    window.localStorage.setItem(BUDGET_COUNTER_KEY, String(numeric));
  }
}

export function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

export function convertUsdPrice(priceUsd: number, currency: QuoteCurrency, exchangeRate: number): number {
  if (currency === 'USD') return roundMoney(priceUsd);
  return roundMoney(priceUsd * exchangeRate);
}

export function formatQuoteAmount(value: number, currency: QuoteCurrency): string {
  const amount = new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
  return currency === 'USD' ? `${amount} USD` : `${amount} Bs`;
}

export function formatQuoteAmountShort(value: number, currency: QuoteCurrency): string {
  const amount = new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-VE', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'VES',
    currencyDisplay: currency === 'USD' ? 'symbol' : 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
  return currency === 'Bs' ? amount.replace('VES', 'Bs') : amount;
}

export function calculateLine(
  line: QuoteLine,
  currency: QuoteCurrency = 'USD',
  exchangeRate = 1,
): QuoteLineCalculation {
  const quantity = Math.max(1, Math.floor(line.quantity || 1));
  const subtotal = roundMoney(Math.max(0, line.unitPrice) * quantity);
  const automaticDiscountPerUnit = line.sourceUnitPriceUsd === null
    ? 0
    : convertUsdPrice(line.discountAmountUsd, currency, exchangeRate);
  const automaticDiscount = roundMoney(automaticDiscountPerUnit * quantity);
  const computedTotal = roundMoney(Math.max(0, subtotal - Math.min(subtotal, automaticDiscount)));
  const total = line.manualTotal === null ? computedTotal : roundMoney(line.manualTotal);
  return {
    subtotal,
    discount: roundMoney(Math.max(0, subtotal - total)),
    total,
    computedTotal,
  };
}

export function calculateTotals(
  lines: QuoteLine[],
  ivaEnabled: boolean,
  ivaPercent: number,
  currency: QuoteCurrency = 'USD',
  exchangeRate = 1,
): QuoteTotals {
  const calculated = lines.map((line) => calculateLine(line, currency, exchangeRate));
  const subtotal = roundMoney(calculated.reduce((sum, line) => sum + line.subtotal, 0));
  const discount = roundMoney(calculated.reduce((sum, line) => sum + line.discount, 0));
  const taxableBase = roundMoney(calculated.reduce((sum, line) => sum + line.total, 0));
  const iva = ivaEnabled ? roundMoney(taxableBase * Math.min(100, Math.max(0, ivaPercent)) / 100) : 0;
  return { subtotal, discount, taxableBase, iva, total: roundMoney(taxableBase + iva) };
}

export function getProductUnitPrice(product: Product, sizeIndex: number): { name: string; priceUsd: number } {
  const size = product.sizes?.[sizeIndex] ?? product.sizes?.[0];
  return {
    name: size?.name ?? 'Estándar',
    priceUsd: Number(size?.price ?? product.basePrice ?? 0),
  };
}

export function getProductImages(product: Product): string[] {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  return images.length > 0 ? images : [getProductImage(images, product.id)];
}

export function isAllowedLocalImage(file: File): boolean {
  return ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    && file.size > 0
    && file.size <= MAX_LOCAL_IMAGE_BYTES;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer la imagen.'));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

export async function imageToDataUrl(source: string | null): Promise<string | null> {
  if (!source) return null;
  if (source.startsWith('data:image/')) return source;
  try {
    const response = await fetch(source, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await readFileAsDataUrl(new File([blob], 'image', { type: blob.type }));
  } catch {
    return null;
  }
}
