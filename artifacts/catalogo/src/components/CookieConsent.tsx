import { useEffect, useState } from "react";

const COOKIE_CONSENT_KEY = "pm_cookie_consent_v1";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted");
  }, []);

  const acceptCookies = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="dialog"
      aria-label="Aviso de cookies"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[70] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl shadow-black/15 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-md"
    >
      <h2 className="text-sm font-bold text-gray-900">Usamos cookies</h2>
      <p className="mt-1 text-xs leading-5 text-gray-600">
        Utilizamos cookies técnicas y almacenamiento local para recordar tus
        preferencias, mantener tu carrito y mejorar tu experiencia en el
        catálogo.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={acceptCookies}
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Aceptar
        </button>
      </div>
    </aside>
  );
}
