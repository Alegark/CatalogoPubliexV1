import { useEffect, useMemo, useRef } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useGetExchangeRate } from '@workspace/api-client-react';
import {
  IVA_PERCENT,
  buildWhatsAppMessage,
  calculateOrder,
  formatCurrency,
  formatCurrencyFromUsdCents,
} from '@/lib/commerce';
import { Button } from './ui/button';
import { Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { QuantitySelector } from './QuantitySelector';
import { trackCommerceEvent } from '@/lib/analytics';

export function CartDrawer() {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart,
    needsInvoice,
    setNeedsInvoice,
  } = useCart();
  const { currency } = useCurrency();
  const { data: exchangeRate } = useGetExchangeRate();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const summary = useMemo(
    () => calculateOrder(items, needsInvoice),
    [items, needsInvoice],
  );
  const rate = exchangeRate?.usdToBs ?? 0;

  useEffect(() => {
    if (!isCartOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCartOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isCartOpen, setIsCartOpen]);

  const handleClearCart = () => {
    if (window.confirm('¿Deseas vaciar todos los productos del carrito?')) {
      clearCart();
    }
  };

  const onCheckout = () => {
    if (!exchangeRate || items.length === 0) return;
    void trackCommerceEvent({
      eventType: 'whatsapp_checkout',
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      amountUsd: summary.totalCents / 100,
    });
    const message = buildWhatsAppMessage(summary, exchangeRate.usdToBs, currency);
    const url = `https://api.whatsapp.com/send/?phone=584146453876&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsCartOpen(false)}
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <div className="flex items-center justify-between border-b p-4">
              <h2 id="cart-title" className="text-xl font-semibold text-primary">
                Carrito de compras
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearCart}
                  disabled={items.length === 0}
                  aria-label="Vaciar carrito"
                  className="h-11 w-11 text-gray-700 transition-colors hover:bg-red-50 hover:text-destructive active:bg-red-100 focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  ref={closeButtonRef}
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCartOpen(false)}
                  aria-label="Cerrar carrito"
                  className="h-11 w-11 text-destructive transition-colors hover:bg-red-50 hover:text-destructive active:bg-red-100 focus-visible:ring-2 focus-visible:ring-destructive"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                  <p>Tu carrito está vacío</p>
                </div>
              ) : (
                summary.lines.map((line) => (
                  <article key={line.item.lineId} className="flex gap-3 rounded-lg bg-gray-50 p-3">
                    {line.item.image && (
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-white">
                        <img
                          src={line.item.image}
                          alt=""
                          className="h-full w-full object-contain p-1"
                          width="64"
                          height="64"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold leading-tight text-gray-900">
                            {line.item.productName}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Tamaño: {line.item.sizeName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(line.item.lineId)}
                          className="grid min-h-11 min-w-11 place-items-center rounded-md text-gray-500 hover:bg-white hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Eliminar ${line.item.productName} del carrito`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      {line.appliedDiscountAmountUsd > 0 && (
                        <p className="mt-2 text-xs font-semibold text-green-700">
                          Descuento de {formatCurrency(line.appliedDiscountAmountUsd, currency, rate)} c/u aplicado
                        </p>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <QuantitySelector
                          value={line.item.quantity}
                          onChange={(quantity) => updateQuantity(line.item.lineId, quantity)}
                          label={`Cantidad de ${line.item.productName}, tamaño ${line.item.sizeName}`}
                          compact
                          className="w-full max-w-[132px]"
                        />
                        <div className="shrink-0 text-right">
                          {line.discountCents > 0 && (
                            <p className="text-xs text-gray-400 line-through">
                              {formatCurrencyFromUsdCents(line.subtotalCents, currency, rate)}
                            </p>
                          )}
                          <p className="font-semibold text-primary">
                            {formatCurrencyFromUsdCents(line.totalCents, currency, rate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div
                className="space-y-4 border-t bg-gray-50 p-4"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3">
                  <span className="text-sm font-semibold text-gray-800">
                    ¿Necesita factura fiscal?
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={needsInvoice}
                    onChange={(event) => setNeedsInvoice(event.target.checked)}
                    className="h-5 w-5 accent-primary"
                  />
                </label>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-semibold">{formatCurrencyFromUsdCents(summary.subtotalCents, currency, rate)}</dd>
                  </div>
                  {summary.discountCents > 0 && (
                    <div className="flex justify-between text-green-700">
                      <dt>Descuentos</dt>
                      <dd className="font-semibold">-{formatCurrencyFromUsdCents(summary.discountCents, currency, rate)}</dd>
                    </div>
                  )}
                  {needsInvoice && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">IVA ({IVA_PERCENT}%)</dt>
                      <dd className="font-semibold">{formatCurrencyFromUsdCents(summary.ivaCents, currency, rate)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base">
                    <dt className="font-bold">Total {currency}</dt>
                    <dd className="font-bold">{formatCurrencyFromUsdCents(summary.totalCents, currency, rate)}</dd>
                  </div>
                </dl>

                <Button
                  className="w-full bg-[#25D366] text-white hover:bg-[#20bd5a]"
                  size="lg"
                  disabled={!exchangeRate}
                  onClick={onCheckout}
                >
                  Enviar pedido al WhatsApp
                </Button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
