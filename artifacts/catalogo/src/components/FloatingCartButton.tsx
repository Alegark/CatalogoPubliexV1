import { useEffect, useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

export function FloatingCartButton() {
  const { cartCount, cartAddVersion, lastAddedItem, isCartOpen, setIsCartOpen } = useCart();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (cartAddVersion === 0) return;
    setIsAnimating(true);
    setShowConfirmation(true);
    const animationTimer = window.setTimeout(() => setIsAnimating(false), 500);
    const confirmationTimer = window.setTimeout(() => setShowConfirmation(false), 2400);
    return () => {
      window.clearTimeout(animationTimer);
      window.clearTimeout(confirmationTimer);
    };
  }, [cartAddVersion]);

  if (isCartOpen) return null;

  const visibleCount = cartCount > 99 ? '99+' : String(cartCount);
  const label = cartCount > 0
    ? `Abrir carrito, ${cartCount} productos`
    : 'Abrir carrito vacío';

  return (
    <div
      className="fixed right-3 z-[60] sm:right-6"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {showConfirmation && lastAddedItem && (
        <div
          role="status"
          aria-live="polite"
          className="cart-confirmation absolute bottom-full right-0 mb-3 w-52 rounded-xl border border-primary/10 bg-white p-3 text-left shadow-xl shadow-primary/15"
        >
          <span className="absolute -bottom-1.5 right-5 h-3 w-3 rotate-45 border-b border-r border-primary/10 bg-white" aria-hidden="true" />
          <div className="relative flex gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green-100 text-green-700">
              <Check className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900">Agregado al carrito</p>
              <p className="mt-0.5 truncate text-xs text-gray-600">{lastAddedItem.productName}</p>
              <p className="text-[11px] text-gray-500">{lastAddedItem.sizeName} · {lastAddedItem.quantity} und.</p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        aria-label={label}
        className={`relative grid aspect-square h-12 min-h-12 max-h-12 w-12 min-w-12 max-w-12 shrink-0 place-items-center rounded-full bg-primary p-0 text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-14 sm:min-h-14 sm:max-h-14 sm:w-14 sm:min-w-14 sm:max-w-14${isAnimating ? ' cart-bubble-feedback' : ''}`}
      >
        <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        {cartCount > 0 && (
          <span
            aria-hidden="true"
            className={`absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-secondary px-1 text-[10px] font-black text-primary-foreground sm:min-h-6 sm:min-w-6 sm:text-xs${isAnimating ? ' cart-count-feedback' : ''}`}
          >
            {visibleCount}
          </span>
        )}
      </button>
    </div>
  );
}
