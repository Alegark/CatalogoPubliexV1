import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

type StockIndicatorProps = {
  stockQuantity?: number | null;
  deliveryTime: string;
  compact?: boolean;
};

export function StockIndicator({ stockQuantity = 0, deliveryTime, compact = false }: StockIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const available = Number.isFinite(stockQuantity) && (stockQuantity ?? 0) > 0;
  const tooltipId = useId();
  const message = available
    ? 'Fabricamos más bajo por encargo.'
    : `Tiempo estimado: ${deliveryTime || 'por confirmar'}.`;
  const isVisible = isHovered || isOpen;

  useEffect(() => {
    if (!isVisible) {
      setTooltipPosition(null);
      return;
    }

    const updateTooltipPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const viewportPadding = 12;
      const width = Math.min(224, Math.max(0, window.innerWidth - viewportPadding * 2));
      const triggerRect = trigger.getBoundingClientRect();
      const centeredLeft = triggerRect.left + triggerRect.width / 2 - width / 2;
      const left = Math.min(
        Math.max(viewportPadding, centeredLeft),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
      );

      setTooltipPosition({ top: triggerRect.bottom + 8, left, width });
    };

    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);
    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className={`relative flex items-center gap-1.5 text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
      <span>{available ? `+${stockQuantity} disponibles` : 'Por encargo'}</span>
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label={available ? 'Información sobre fabricación bajo encargo' : 'Información sobre tiempo de fabricación'}
          aria-expanded={isOpen}
          aria-describedby={isVisible ? tooltipId : undefined}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setIsOpen(false);
          }}
          onClick={() => setIsOpen((current) => !current)}
          onFocus={() => setIsOpen(true)}
          onBlur={(event) => {
            if (!containerRef.current?.contains(event.relatedTarget)) setIsOpen(false);
          }}
          className="grid h-5 w-5 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
        <span
          id={tooltipId}
          role="tooltip"
          style={tooltipPosition ? { top: tooltipPosition.top, left: tooltipPosition.left, width: tooltipPosition.width } : undefined}
          className={`pointer-events-none fixed z-50 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-xs font-medium leading-5 text-gray-700 shadow-lg transition duration-150 ${
            isVisible && tooltipPosition ? 'visible opacity-100' : 'invisible opacity-0'
          }`}
        >
          {message}
        </span>
      </div>
    </div>
  );
}
