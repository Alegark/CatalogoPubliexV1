import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createCartLineId,
  normalizeDiscountTiers,
  normalizeQuantity,
  type DiscountTier,
} from '@/lib/commerce';

export interface CartItem {
  lineId: string;
  productId: number;
  productName: string;
  sizeName: string;
  sizePrice: number; // in USD
  quantity: number;
  discountTiers: DiscountTier[];
  discountThreshold: number | null;
  discountPercent: number | null;
  image?: string;
  deliveryTime?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'lineId'>) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  cartCount: number;
  cartAddVersion: number;
  lastAddedItem: Pick<CartItem, 'productName' | 'sizeName' | 'quantity'> | null;
  needsInvoice: boolean;
  setNeedsInvoice: (needsInvoice: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const STORAGE_KEY = 'pm_cart';

interface PersistedCart {
  version: 2;
  items: CartItem[];
  needsInvoice: boolean;
}

function normalizeStoredItem(value: unknown): CartItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<CartItem>;
  if (
    typeof item.productId !== 'number'
    || typeof item.productName !== 'string'
    || typeof item.sizeName !== 'string'
    || typeof item.sizePrice !== 'number'
  ) {
    return null;
  }

  return {
    lineId: createCartLineId(item.productId, item.sizeName),
    productId: item.productId,
    productName: item.productName,
    sizeName: item.sizeName,
    sizePrice: item.sizePrice,
    quantity: normalizeQuantity(item.quantity),
    discountTiers: normalizeDiscountTiers(
      item.discountTiers,
      item.discountThreshold ?? null,
      item.discountPercent ?? null,
          item.sizePrice,
    ),
    discountThreshold: item.discountThreshold ?? null,
    discountPercent: item.discountPercent ?? null,
    image: item.image,
    deliveryTime: item.deliveryTime,
  };
}

function loadCart(): PersistedCart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 2, items: [], needsInvoice: false };
    const parsed: unknown = JSON.parse(raw);
    const legacyItems = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as PersistedCart).items)
        ? (parsed as PersistedCart).items
        : [];
    const items = legacyItems
      .map(normalizeStoredItem)
      .filter((item): item is CartItem => item !== null);
    const needsInvoice = !Array.isArray(parsed)
      && Boolean((parsed as Partial<PersistedCart>).needsInvoice);
    return { version: 2, items, needsInvoice };
  } catch {
    return { version: 2, items: [], needsInvoice: false };
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<PersistedCart>(loadCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartAddVersion, setCartAddVersion] = useState(0);
  const [lastAddedItem, setLastAddedItem] = useState<CartContextType['lastAddedItem']>(null);
  const { items, needsInvoice } = cart;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const addItem = (newItem: Omit<CartItem, 'lineId'>) => {
    const lineId = createCartLineId(newItem.productId, newItem.sizeName);
    setCart(current => {
      const existing = current.items.find(item => item.lineId === lineId);
      const items = existing
        ? current.items.map(item => item.lineId === lineId
          ? { ...item, quantity: normalizeQuantity(item.quantity + newItem.quantity) }
          : item)
        : [...current.items, {
          ...newItem,
          discountTiers: normalizeDiscountTiers(
            newItem.discountTiers,
            newItem.discountThreshold,
            newItem.discountPercent,
                      newItem.sizePrice,
          ),
          lineId,
          quantity: normalizeQuantity(newItem.quantity),
        }];
      return { ...current, items };
    });
    setLastAddedItem({
      productName: newItem.productName,
      sizeName: newItem.sizeName,
      quantity: newItem.quantity,
    });
    setCartAddVersion(version => version + 1);
  };

  const removeItem = (lineId: string) => {
    setCart(current => ({
      ...current,
      items: current.items.filter(item => item.lineId !== lineId),
    }));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    setCart(current => ({
      ...current,
      items: current.items.map(item => item.lineId === lineId
        ? { ...item, quantity: normalizeQuantity(quantity) }
        : item),
    }));
  };

  const clearCart = () => setCart(current => ({ ...current, items: [] }));
  const setNeedsInvoice = (value: boolean) => {
    setCart(current => ({ ...current, needsInvoice: value }));
  };

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isCartOpen,
      setIsCartOpen,
      cartCount,
      cartAddVersion,
      lastAddedItem,
      needsInvoice,
      setNeedsInvoice,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
