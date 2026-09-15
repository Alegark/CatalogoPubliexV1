import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWhatsAppMessage,
  calculateOrder,
  createCartLineId,
  formatBs,
  formatCurrency,
  formatCurrencyFromUsdCents,
  getApplicableDiscountAmountUsd,
  normalizeDiscountTiers,
  normalizeQuantity,
  type PriceableCartItem,
} from './commerce.ts';

const item: PriceableCartItem = {
  lineId: createCartLineId(7, 'Carta'),
  productId: 7,
  productName: 'Porta retrato',
  sizeName: 'Carta',
  sizePrice: 10,
  quantity: 1,
  discountTiers: [{ threshold: 5, amountOffUsd: 1 }],
  discountThreshold: null,
  discountPercent: null,
  deliveryTime: '3 días',
};

test('normaliza cantidades inválidas y respeta el máximo', () => {
  assert.equal(normalizeQuantity(''), 1);
  assert.equal(normalizeQuantity('-2'), 1);
  assert.equal(normalizeQuantity('3.8'), 3);
  assert.equal(normalizeQuantity('200', 12), 12);
});

test('mantiene separadas las variantes del mismo producto', () => {
  assert.notEqual(createCartLineId(7, 'Carta'), createCartLineId(7, 'Oficio'));
  assert.equal(createCartLineId(7, 'Carta'), createCartLineId(7, 'carta'));
});

test('calcula descuento fijo e IVA una sola vez y redondea en centavos', () => {
  const summary = calculateOrder([{ ...item, sizePrice: 10.01, quantity: 5 }], true);
  assert.equal(summary.subtotalCents, 5005);
  assert.equal(summary.discountCents, 500);
  assert.equal(summary.taxableBaseCents, 4505);
  assert.equal(summary.ivaCents, 721);
  assert.equal(summary.totalCents, 5226);
});

test('no aplica IVA cuando no se solicita factura', () => {
  const summary = calculateOrder([item], false);
  assert.equal(summary.discountCents, 0);
  assert.equal(summary.ivaCents, 0);
  assert.equal(summary.totalCents, 1000);
});

test('WhatsApp usa exactamente el resumen calculado', () => {
  const summary = calculateOrder([{ ...item, quantity: 5 }], true);
  const message = buildWhatsAppMessage(summary, 40, 'USD');
  assert.match(message, /5 uds .* \$10\.00 = \$50\.00/);
  assert.match(message, /Desc\. -\$1\.00 c\/u aplicado: \$45\.00/);
  assert.match(message, /- IVA \(16%\): \$7\.20/);
  assert.match(message, new RegExp(`${String.fromCodePoint(0x1f4e6)} PRODUCTOS:`));
  assert.match(message, new RegExp(`${String.fromCodePoint(0x1f4cb)} DATOS DE ENTREGA Y FACTURA:`));
  assert.match(message, new RegExp(`${String.fromCodePoint(0x1f4b0)} RESUMEN DE PAGO:`));
  assert.doesNotMatch(message, /TOTAL A PAGAR/);
  assert.doesNotMatch(message, /�/);
  assert.match(message, /- TOTAL EN BS: Bs\. 2\.088,00/);
  assert.match(message, /- Factura Fiscal: Sí/);
});

test('WhatsApp usa la moneda seleccionada y parte del precio USD base', () => {
  const summary = calculateOrder([{ ...item, quantity: 5 }], true);
  const message = buildWhatsAppMessage(summary, 40, 'Bs');
  assert.match(message, /5 uds .* Bs\. 400,00 = Bs\. 2\.000,00/);
  assert.match(message, /- TOTAL EN USD: \$52\.20/);
  assert.doesNotMatch(message, /TOTAL A PAGAR/);
  assert.doesNotMatch(message, /5 uds .* \$/);
});

test('formatea bolívares con una sola representación de moneda', () => {
  assert.equal(formatBs(310.25), 'Bs. 310,25');
});

test('muestra variantes gratuitas sin depender de la tasa de cambio', () => {
  assert.equal(formatCurrency(0, 'USD', 0), 'Gratis');
  assert.equal(formatCurrency(0, 'Bs', 0), 'Gratis');
  assert.equal(formatCurrencyFromUsdCents(0, 'USD', 0), 'Gratis');
  assert.equal(formatCurrencyFromUsdCents(0, 'Bs', 0), 'Gratis');
});

test('calcula una variante gratuita sin valores inválidos', () => {
  const summary = calculateOrder([{ ...item, sizePrice: 0, quantity: 3, discountTiers: [] }], true);
  assert.equal(summary.lines[0].unitPriceCents, 0);
  assert.equal(summary.lines[0].subtotalCents, 0);
  assert.equal(summary.totalCents, 0);
  assert.match(buildWhatsAppMessage(summary, 0, 'Bs'), /3 uds .* Gratis = Gratis/);
});

test('aplica solamente el nivel de oferta más alto alcanzado', () => {
  const tiers = normalizeDiscountTiers([
    { threshold: 100, amountOffUsd: 1.5 },
    { threshold: 10, amountOffUsd: 0.5 },
    { threshold: 50, amountOffUsd: 1 },
  ]);

  assert.deepEqual(tiers, [
    { threshold: 10, amountOffUsd: 0.5 },
    { threshold: 50, amountOffUsd: 1 },
    { threshold: 100, amountOffUsd: 1.5 },
  ]);
  assert.equal(getApplicableDiscountAmountUsd(tiers, 9), 0);
  assert.equal(getApplicableDiscountAmountUsd(tiers, 10), 0.5);
  assert.equal(getApplicableDiscountAmountUsd(tiers, 75), 1);
  assert.equal(getApplicableDiscountAmountUsd(tiers, 120), 1.5);
});

test('interpreta productos antiguos de un solo umbral', () => {
  assert.equal(getApplicableDiscountAmountUsd(undefined, 12, 10, 5, 10), 0.5);
  assert.equal(getApplicableDiscountAmountUsd([], 12, 10, 5, 10), 0.5);
});
