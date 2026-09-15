import { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { normalizeQuantity } from '@/lib/commerce';

interface QuantitySelectorProps {
  value: number;
  onChange: (quantity: number) => void;
  maximum?: number;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function QuantitySelector({
  value,
  onChange,
  maximum,
  label = 'Cantidad',
  compact = false,
  className = '',
}: QuantitySelectorProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const next = normalizeQuantity(draft, maximum);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const setQuantity = (next: number) => {
    const normalized = normalizeQuantity(next, maximum);
    setDraft(String(normalized));
    onChange(normalized);
  };

  return (
    <div className={`grid h-11 grid-cols-[44px_minmax(36px,1fr)_44px] items-center rounded-lg border border-gray-200 bg-white ${className}`}>
      <button
        type="button"
        className="grid h-11 w-full place-items-center text-gray-600 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => setQuantity(value - 1)}
        disabled={value <= 1}
        aria-label={`Disminuir ${label.toLocaleLowerCase('es')}`}
      >
        <Minus className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
      </button>
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className={`h-11 min-w-0 w-full bg-transparent text-center font-semibold outline-none ${compact ? 'text-sm' : 'text-base'}`}
        aria-label={label}
      />
      <button
        type="button"
        className="grid h-11 w-full place-items-center text-gray-600 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => setQuantity(value + 1)}
        disabled={maximum !== undefined && value >= maximum}
        aria-label={`Aumentar ${label.toLocaleLowerCase('es')}`}
      >
        <Plus className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
      </button>
    </div>
  );
}
