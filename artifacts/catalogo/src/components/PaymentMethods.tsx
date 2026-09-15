import { useEffect, useRef, useState } from 'react';

const paymentMethods = [
  { name: 'Pago móvil', src: '/metodos-pago/pago-movil.png' },
  { name: 'Mercantil (Bs)', src: '/metodos-pago/mercantil.png' },
  { name: 'Banesco (Bs)', src: '/metodos-pago/banesco.png' },
  { name: 'Dólares físicos', src: '/metodos-pago/dolares.png' },
  { name: 'Binance', src: '/metodos-pago/binance.png' },
  { name: 'Zelle (+50$)', src: '/metodos-pago/zelle.png' },
] as const;

export function PaymentMethods() {
  const sectionRef = useRef<HTMLElement>(null);
  const [openMethod, setOpenMethod] = useState<string | null>(null);
  const touchInteractionRef = useRef(false);

  useEffect(() => {
    if (!openMethod) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!sectionRef.current?.contains(event.target as Node)) setOpenMethod(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMethod(null);
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMethod]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="payment-methods-title"
      className="border-t border-gray-100 pt-6"
    >
      <div>
        <h2 id="payment-methods-title" className="text-base font-bold text-gray-900">
          Métodos de pago
        </h2>
      </div>

      <ul className="mt-5 grid grid-cols-6 gap-1 sm:gap-4">
        {paymentMethods.map((method) => {
          const isOpen = openMethod === method.name;
          const tooltipId = `payment-method-${method.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
          return (
            <li key={method.name} className="relative flex min-w-0 items-center justify-center">
              <button
                type="button"
                className="group relative grid min-h-10 min-w-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={method.name}
                aria-expanded={isOpen}
                aria-describedby={isOpen ? tooltipId : undefined}
                onClick={() => {
                  if (touchInteractionRef.current) {
                    touchInteractionRef.current = false;
                    return;
                  }
                  setOpenMethod(method.name);
                }}
                onPointerDown={(event) => {
                  touchInteractionRef.current = event.pointerType === 'touch';
                  if (event.pointerType === 'touch') setOpenMethod(method.name);
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setOpenMethod(method.name);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') setOpenMethod(null);
                }}
                onFocus={() => setOpenMethod(method.name)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenMethod(null);
                }}
              >
                  <span className="grid h-9 w-9 overflow-hidden rounded-full ring-1 ring-black/5 transition-transform duration-150 group-hover:scale-105 group-active:scale-95 sm:h-12 sm:w-12">
                  <img
                    src={method.src}
                    alt=""
                    className="h-full w-full object-cover"
                    width="48"
                    height="48"
                    loading="lazy"
                  />
                </span>
                {isOpen && (
                  <span
                    id={tooltipId}
                    role="tooltip"
                    className="absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-center text-xs font-semibold text-white shadow-lg"
                  >
                    {method.name}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
