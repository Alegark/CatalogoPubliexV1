import type { Product } from '@workspace/api-client-react';

export type QuoteCurrency = 'USD' | 'Bs';

export interface QuoteLine {
  id: string;
  kind: 'product' | 'custom';
  productId: number | null;
  productName: string;
  category: string;
  sizeName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sourceUnitPriceUsd: number | null;
  unitPriceEdited: boolean;
  discountAmountUsd: number;
  manualTotal: number | null;
  image: string | null;
  imageOptions: string[];
  imageIsCustom: boolean;
}

export interface QuoteSettings {
  clientName: string;
  rifCedula: string;
  city: string;
  issueDate: string;
  quoteNumber: string;
  currency: QuoteCurrency;
  ivaEnabled: boolean;
  ivaPercent: number;
  deliveryTime: string;
  paymentMethod: string;
  advance: string;
  notes: string;
}

export interface QuoteLineCalculation {
  subtotal: number;
  discount: number;
  total: number;
  computedTotal: number;
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  taxableBase: number;
  iva: number;
  total: number;
}

export interface ProductOption {
  product: Product;
  image: string;
}
