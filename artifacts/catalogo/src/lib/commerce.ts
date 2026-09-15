export const IVA_PERCENT = 16;
export const FREE_PRICE_LABEL = 'Gratis';
export type Currency = 'USD' | 'Bs';

const whatsappSymbols = {
  products: String.fromCodePoint(0x1f4e6),
  delivery: String.fromCodePoint(0x1f4cb),
  payment: String.fromCodePoint(0x1f4b0),
  separator: String.fromCodePoint(0x2500),
  branch: String.fromCodePoint(0x2514),
  multiply: String.fromCodePoint(0x00d7),
} as const;

export interface DiscountTier {
  threshold: number;
  amountOffUsd: number;
}

export interface PriceableCartItem {
  lineId: string;
  productId: number;
  productName: string;
  sizeName: string;
  sizePrice: number;
  quantity: number;
  discountTiers: DiscountTier[];
  /** Legacy single-tier fields kept for persisted carts from previous versions. */
  discountThreshold: number | null;
  discountPercent: number | null;
  image?: string;
  deliveryTime?: string;
}

export interface OrderLineSummary {
  item: PriceableCartItem;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  appliedDiscountAmountUsd: number;
}

export interface OrderSummary {
  lines: OrderLineSummary[];
  subtotalCents: number;
  discountCents: number;
  taxableBaseCents: number;
  ivaCents: number;
  totalCents: number;
  needsInvoice: boolean;
}

function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function percentToAmount(priceUsd: number, percent: number): number {
  if (!Number.isFinite(priceUsd) || !Number.isFinite(percent)) return 0;
  return roundMoney(priceUsd * Math.max(0, Math.min(100, percent)) / 100);
}

export function normalizeDiscountTiers(
  tiers: unknown,
  legacyThreshold: number | null = null,
  legacyPercent: number | null = null,
  referencePriceUsd = 0,
): DiscountTier[] {
  const normalized = Array.isArray(tiers)
    ? tiers.flatMap((tier) => {
        if (!tier || typeof tier !== 'object') return [];
        const candidate = tier as { threshold?: unknown; amountOffUsd?: unknown; percent?: unknown };
        const threshold = Number(candidate.threshold);
        if (!Number.isInteger(threshold) || threshold <= 0) return [];
        const amount = Number(candidate.amountOffUsd);
        if (Number.isFinite(amount) && amount >= 0) {
          return [{ threshold, amountOffUsd: roundMoney(amount) }];
        }
        const legacyTierPercent = Number(candidate.percent);
        if (Number.isFinite(legacyTierPercent) && legacyTierPercent >= 0 && legacyTierPercent <= 100) {
          return [{ threshold, amountOffUsd: percentToAmount(referencePriceUsd, legacyTierPercent) }];
        }
        return [];
      })
    : [];

  if (
    normalized.length === 0
    && legacyThreshold !== null
    && Number.isInteger(legacyThreshold)
    && legacyThreshold > 0
    && legacyPercent !== null
    && Number.isFinite(legacyPercent)
    && legacyPercent >= 0
    && legacyPercent <= 100
  ) {
    normalized.push({ threshold: legacyThreshold, amountOffUsd: percentToAmount(referencePriceUsd, legacyPercent) });
  }

  const unique = new Map<number, DiscountTier>();
  for (const tier of normalized) unique.set(tier.threshold, tier);
  return [...unique.values()].sort((a, b) => a.threshold - b.threshold);
}

export function getApplicableDiscountAmountUsd(
  tiers: unknown,
  quantity: number,
  legacyThreshold: number | null = null,
  legacyPercent: number | null = null,
  referencePriceUsd = 0,
): number {
  const normalizedQuantity = normalizeQuantity(quantity);
  const applicable = normalizeDiscountTiers(
    tiers,
    legacyThreshold,
    legacyPercent,
    referencePriceUsd,
  ).filter((tier) => normalizedQuantity >= tier.threshold).at(-1);
  return applicable?.amountOffUsd ?? 0;
}

export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function normalizeQuantity(value: unknown, maximum?: number): number {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value).trim(), 10);
  const whole = Number.isFinite(parsed) ? Math.floor(parsed) : 1;
  const upperBound = maximum && maximum > 0 ? Math.floor(maximum) : Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(whole, 1), upperBound);
}

export function createCartLineId(productId: number, variantName: string): string {
  return `${productId}:${encodeURIComponent(variantName.trim().toLocaleLowerCase('es'))}`;
}

export function calculateOrderLine(item: PriceableCartItem): OrderLineSummary {
  const quantity = normalizeQuantity(item.quantity);
  const unitPriceCents = toCents(item.sizePrice);
  const subtotalCents = unitPriceCents * quantity;
  const appliedDiscountAmountUsd = getApplicableDiscountAmountUsd(
    item.discountTiers,
    quantity,
    item.discountThreshold,
    item.discountPercent,
    item.sizePrice,
  );
  const discountCents = Math.min(
    subtotalCents,
    toCents(appliedDiscountAmountUsd) * quantity,
  );

  return {
    item: { ...item, quantity },
    unitPriceCents,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    appliedDiscountAmountUsd,
  };
}

export function calculateOrder(
  items: PriceableCartItem[],
  needsInvoice: boolean,
): OrderSummary {
  const lines = items.map(calculateOrderLine);
  const subtotalCents = lines.reduce((total, line) => total + line.subtotalCents, 0);
  const discountCents = lines.reduce((total, line) => total + line.discountCents, 0);
  const taxableBaseCents = subtotalCents - discountCents;
  const ivaCents = needsInvoice
    ? Math.round(taxableBaseCents * IVA_PERCENT / 100)
    : 0;

  return {
    lines,
    subtotalCents,
    discountCents,
    taxableBaseCents,
    ivaCents,
    totalCents: taxableBaseCents + ivaCents,
    needsInvoice,
  };
}

export function convertUsdCentsToBsCents(
  usdCents: number,
  exchangeRate: number,
): number {
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return 0;
  return Math.round(usdCents * exchangeRate);
}

export function convertPrice(
  usdPrice: number,
  currency: Currency,
  exchangeRate: number,
): number | null {
  if (!Number.isFinite(usdPrice)) return null;
  if (currency === 'USD') return usdPrice;
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return null;
  return usdPrice * exchangeRate;
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatBs(value: number): string {
  const amount = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `Bs. ${amount}`;
}

export function formatUsdCents(cents: number): string {
  return formatUSD(cents / 100);
}

export function formatCurrency(
  usdPrice: number,
  currency: Currency,
  exchangeRate: number,
): string {
  if (usdPrice === 0) return FREE_PRICE_LABEL;
  const convertedPrice = convertPrice(usdPrice, currency, exchangeRate);
  if (convertedPrice === null) return '\u2014';
  return currency === 'USD' ? formatUSD(convertedPrice) : formatBs(convertedPrice);
}

export function formatCurrencyFromUsdCents(
  cents: number,
  currency: Currency,
  exchangeRate: number,
): string {
  if (cents === 0) return FREE_PRICE_LABEL;
  const convertedCents = currency === 'USD'
    ? cents
    : convertUsdCentsToBsCents(cents, exchangeRate);
  if (currency === 'Bs' && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) return '\u2014';
  return currency === 'USD' ? formatUsdCents(convertedCents) : formatBs(convertedCents / 100);
}

export function buildWhatsAppMessage(
  summary: OrderSummary,
  exchangeRate: number,
  currency: Currency,
): string {
  const formatSelected = (cents: number) => formatCurrencyFromUsdCents(cents, currency, exchangeRate);
  const formatUsd = (cents: number) => formatCurrencyFromUsdCents(cents, 'USD', exchangeRate);
  const formatBsAmount = (cents: number) => formatCurrencyFromUsdCents(cents, 'Bs', exchangeRate);
  const formatDiscount = (amountUsd: number) => formatCurrency(amountUsd, currency, exchangeRate);
  const deliveryTimes = [...new Set(
    summary.lines
      .map(({ item }) => item.deliveryTime?.trim())
      .filter((value): value is string => Boolean(value)),
  )];
  const deliveryLabel = deliveryTimes.length > 0 ? deliveryTimes.join(' / ') : 'Por confirmar';
  const lines: string[] = [
    'Hola, deseo realizar el siguiente pedido:',
    '',
    `${whatsappSymbols.products} PRODUCTOS:`,
  ];

  for (const line of summary.lines) {
    lines.push(`- ${line.item.productName} [${line.item.sizeName}]`);
    lines.push(`  ${line.item.quantity} uds ${whatsappSymbols.multiply} ${formatSelected(line.unitPriceCents)} = ${formatSelected(line.subtotalCents)}`);
    if (line.appliedDiscountAmountUsd > 0) {
      lines.push(`  ${whatsappSymbols.branch} Desc. -${formatDiscount(line.appliedDiscountAmountUsd)} c/u aplicado: ${formatSelected(line.totalCents)}`);
    }
    lines.push('');
  }

  lines.push(whatsappSymbols.separator.repeat(15));
  lines.push(`${whatsappSymbols.delivery} DATOS DE ENTREGA Y FACTURA:`);
  lines.push(`- Tiempo estimado: ${deliveryLabel}`);
  lines.push(`- Factura Fiscal: ${summary.needsInvoice ? 'Sí' : 'No'}`);
  lines.push('');
  lines.push(`${whatsappSymbols.payment} RESUMEN DE PAGO:`);
  lines.push(`- Subtotal: ${formatSelected(summary.subtotalCents)}`);
  if (summary.discountCents > 0) {
    lines.push(`- Descuentos: -${formatSelected(summary.discountCents)}`);
  }
  if (summary.needsInvoice) {
    lines.push(`- IVA (${IVA_PERCENT}%): ${formatSelected(summary.ivaCents)}`);
  }
  lines.push(`- TOTAL EN USD: ${formatUsd(summary.totalCents)}`);
  lines.push(`- TOTAL EN BS: ${formatBsAmount(summary.totalCents)}`);

  return lines.join('\n');
}
