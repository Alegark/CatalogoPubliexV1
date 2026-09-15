import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Info, X } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import logoMark from "@assets/Mesa_de_trabajo_2_1784777295126.png";

const CURRENCY_HINT_KEY = "publiex:currency-hint-dismissed";

export function Header() {
  const [location] = useLocation();
  const { currency, setCurrency } = useCurrency();
  const [showCurrencyHint, setShowCurrencyHint] = useState(false);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (/^\/admin(?:\/|$)/i.test(location)) {
      setShowCurrencyHint(false);
      return;
    }
    if (localStorage.getItem(CURRENCY_HINT_KEY) === "1") return;
    const timer = window.setTimeout(() => setShowCurrencyHint(true), 650);
    return () => window.clearTimeout(timer);
  }, [location]);

  useEffect(() => {
    if (!showCurrencyHint) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !hintRef.current?.contains(event.target)
      ) {
        dismissCurrencyHint();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissCurrencyHint();
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showCurrencyHint]);

  const dismissCurrencyHint = () => {
    localStorage.setItem(CURRENCY_HINT_KEY, "1");
    setShowCurrencyHint(false);
  };

  const changeCurrency = (nextCurrency: "USD" | "Bs") => {
    setCurrency(nextCurrency);
    dismissCurrencyHint();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src={logoMark} alt="Publiex Maracaibo" className="h-8" />
          </Link>

          <div className="flex items-center justify-end gap-4">
            <div ref={hintRef} className="relative">
              <div
                className={`flex items-center rounded-lg bg-gray-100 p-1 ${showCurrencyHint ? "currency-switch-hint-target" : ""}`}
              >
                <button
                  className={`min-h-11 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    currency === "USD"
                      ? "bg-primary text-white shadow-sm"
                      : "text-gray-500 hover:bg-white hover:text-gray-900"
                  }`}
                  onClick={() => changeCurrency("USD")}
                  aria-pressed={currency === "USD"}
                >
                  USD
                </button>
                <button
                  className={`min-h-11 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    currency === "Bs"
                      ? "bg-primary text-white shadow-sm"
                      : "text-gray-500 hover:bg-white hover:text-gray-900"
                  }`}
                  onClick={() => changeCurrency("Bs")}
                  aria-pressed={currency === "Bs"}
                >
                  Bs
                </button>
              </div>

              {showCurrencyHint && (
                <div
                  role="dialog"
                  aria-label="Selector de moneda"
                  className="currency-hint-popover absolute right-0 top-full z-50 mt-3 w-64 rounded-xl border border-primary/15 bg-white p-3 text-left shadow-xl shadow-primary/10"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 right-7 h-3 w-3 rotate-45 border-l border-t border-primary/15 bg-white"
                  />
                  <div className="relative flex gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Info className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        Elige tu moneda
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-600">
                        Puedes alternar los precios entre USD y Bs desde este
                        botón.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={dismissCurrencyHint}
                      aria-label="Cerrar aviso de moneda"
                      className="-mr-1 -mt-1 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
