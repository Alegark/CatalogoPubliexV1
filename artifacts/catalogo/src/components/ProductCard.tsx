import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ChevronDown, Info, Tag } from 'lucide-react';
import { Product } from '@workspace/api-client-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { trackCommerceEvent } from '@/lib/analytics';
import { useGetExchangeRate } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/commerce';
import { getProductImage } from '@/lib/assets';
import { Button } from './ui/button';
import { QuantitySelector } from './QuantitySelector';
import { getApplicableDiscountAmountUsd, normalizeDiscountTiers } from '@/lib/commerce';
import { StockIndicator } from './StockIndicator';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { currency } = useCurrency();
  const { addItem } = useCart();
  const { data: exchangeRate } = useGetExchangeRate();
  const variants = product.sizes?.length > 0
    ? product.sizes
    : [{ name: 'Estándar', price: product.basePrice }];
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(
    variants.length === 1 ? 0 : null,
  );
  const [quantity, setQuantity] = useState(1);
  const [isVariantOpen, setIsVariantOpen] = useState(false);
  const [areOffersOpen, setAreOffersOpen] = useState(false);
  const [shouldHighlightVariant, setShouldHighlightVariant] = useState(false);
  const variantTriggerRef = useRef<HTMLButtonElement>(null);
  const offersTriggerRef = useRef<HTMLButtonElement>(null);
  const offerCloseTimeoutRef = useRef<number | undefined>(undefined);
  const variantOptionsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedVariant = selectedVariantIndex === null
    ? null
    : variants[selectedVariantIndex];

  const originalPriceUSD = selectedVariant?.price ?? product.basePrice;
  const discountTiers = normalizeDiscountTiers(
    product.discountTiers,
    product.discountThreshold ?? null,
    product.discountPercent ?? null,
    originalPriceUSD,
  );
  const rate = exchangeRate?.usdToBs ?? 0;
  const appliedDiscountAmountUsd = getApplicableDiscountAmountUsd(
    discountTiers,
    quantity,
    product.discountThreshold ?? null,
    product.discountPercent ?? null,
    originalPriceUSD,
  );
  const priceUSD = Math.max(0, originalPriceUSD - appliedDiscountAmountUsd);
  const displayPrice = formatCurrency(priceUSD, currency, rate);
  const displayOriginalPrice = formatCurrency(originalPriceUSD, currency, rate);
  const discountOffers = discountTiers.filter((tier) => tier.amountOffUsd > 0);
  const mainImage = getProductImage(product.images, product.id);
  const variantLabel = selectedVariant?.name ?? 'Elige tamaño';
  const variantListId = `variant-options-${product.id}`;
  const offersListId = `discount-offers-${product.id}`;

  const clearOfferCloseTimeout = () => {
    if (offerCloseTimeoutRef.current !== undefined) {
      window.clearTimeout(offerCloseTimeoutRef.current);
      offerCloseTimeoutRef.current = undefined;
    }
  };

  const openOfferPopover = () => {
    clearOfferCloseTimeout();
    setAreOffersOpen(true);
  };

  const scheduleOfferClose = () => {
    clearOfferCloseTimeout();
    offerCloseTimeoutRef.current = window.setTimeout(() => {
      setAreOffersOpen(false);
      offerCloseTimeoutRef.current = undefined;
    }, 140);
  };

  const handleOfferClick = () => {
    if (window.matchMedia('(hover: hover)').matches) {
      openOfferPopover();
      return;
    }
    setAreOffersOpen((open) => !open);
  };
  const availableVariantIndexes = variants
    .map((_, index) => index)
    .filter((index) => index !== selectedVariantIndex);

  useEffect(() => {
    if (!isVariantOpen) return;
    const selectedOption = variantOptionsRef.current[selectedVariantIndex ?? -1]
      ?? variantOptionsRef.current[availableVariantIndexes[0]];
    selectedOption?.focus();
  }, [availableVariantIndexes, isVariantOpen, selectedVariantIndex]);

  useEffect(() => {
    if (!isVariantOpen && !areOffersOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      const variantContainer = variantTriggerRef.current?.parentElement;
      const offersContainer = offersTriggerRef.current?.parentElement;
      if (!variantContainer?.contains(event.target) && !offersContainer?.contains(event.target)) {
        setIsVariantOpen(false);
        setAreOffersOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsVariantOpen(false);
        setAreOffersOpen(false);
        if (isVariantOpen) variantTriggerRef.current?.focus();
        if (areOffersOpen) offersTriggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      clearOfferCloseTimeout();
    };
  }, [areOffersOpen, isVariantOpen]);

  const selectVariant = (index: number) => {
    setSelectedVariantIndex(index);
    setIsVariantOpen(false);
    variantTriggerRef.current?.focus();
  };

  const handleVariantTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsVariantOpen(true);
      setAreOffersOpen(false);
    }
  };

  const handleVariantOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const currentPosition = availableVariantIndexes.indexOf(index);
      const nextPosition = event.key === 'ArrowDown'
        ? (currentPosition + 1) % availableVariantIndexes.length
        : (currentPosition - 1 + availableVariantIndexes.length) % availableVariantIndexes.length;
      const nextIndex = availableVariantIndexes[nextPosition];
      variantOptionsRef.current[nextIndex]?.focus();
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectVariant(index);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      setShouldHighlightVariant(true);
      window.setTimeout(() => setShouldHighlightVariant(false), 520);
      if (window.matchMedia('(max-width: 767px)').matches) variantTriggerRef.current?.focus();
      return;
    }
    addItem({
      productId: product.id,
      productName: product.name,
      sizeName: selectedVariant.name,
      sizePrice: selectedVariant.price,
      quantity,
      discountTiers,
      discountThreshold: product.discountThreshold ?? null,
      discountPercent: product.discountPercent ?? null,
      image: mainImage,
      deliveryTime: product.deliveryTime,
    });
    await trackCommerceEvent({
      eventType: 'add_to_cart',
      productId: product.id,
      source: 'catalog',
      sizeName: selectedVariant.name,
      quantity,
    });
    setQuantity(1);
  };

  return (
    <article className="group flex h-full flex-col overflow-visible rounded-xl border border-gray-100 bg-white shadow-sm">
      <Link href={`/producto/${product.slug}`} className="block aspect-[4/3] w-full overflow-hidden bg-gray-50 p-2 sm:p-3">
        <img
          src={mainImage}
          alt={product.name}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          width="480"
          height="360"
        />
      </Link>

      <div className="flex flex-1 flex-col p-2 sm:p-5">
        <span className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-secondary-foreground sm:text-xs">
          {product.category}
        </span>

        <h2 className="mb-2 line-clamp-2 text-xs font-bold leading-tight text-gray-900 sm:text-lg">
          <Link href={`/producto/${product.slug}`} className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {product.name}
          </Link>
        </h2>


        <StockIndicator stockQuantity={product.stockQuantity} deliveryTime={product.deliveryTime} compact />

        <div className="mt-3 flex flex-1 flex-col">
          <div className="flex min-h-8 flex-wrap items-center gap-1.5">
            <div className="flex items-baseline gap-2">
              <p className="text-base font-extrabold text-primary sm:text-xl">{displayPrice}</p>
              {appliedDiscountAmountUsd > 0 && (
                <span className="text-xs text-gray-400 line-through">{displayOriginalPrice}</span>
              )}
            </div>

            {discountOffers.length === 1 && (
              <span className="inline-flex w-fit max-w-full items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-semibold leading-tight text-green-800 sm:text-xs">
                <Tag aria-hidden="true" className="h-3 w-3 shrink-0" />
                Oferta desde {discountOffers[0].threshold} uds. · -{formatCurrency(discountOffers[0].amountOffUsd, currency, rate)} c/u
              </span>
            )}

            {discountOffers.length > 1 && (
              <div className="relative">
                <button
                  ref={offersTriggerRef}
                  type="button"
                  aria-label={`Ver ${discountOffers.length} ofertas para ${product.name}`}
                  aria-haspopup="dialog"
                  aria-expanded={areOffersOpen}
                  aria-controls={offersListId}
                  onClick={() => {
                    handleOfferClick();
                    setIsVariantOpen(false);
                  }}
                  onMouseEnter={openOfferPopover}
                  onMouseLeave={scheduleOfferClose}
                  onFocus={openOfferPopover}
                  className="inline-flex min-h-7 w-fit items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-semibold leading-tight text-green-800 transition-colors hover:border-green-300 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 sm:text-xs"
                >
                  <Tag aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span>{discountOffers.length} ofertas</span>
                  <span className="font-medium text-green-700/80">· Ver</span>
                  <Info
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                  />
                </button>

                {areOffersOpen && (
                  <div
                    id={offersListId}
                    role="dialog"
                    aria-label={`Ofertas disponibles para ${product.name}`}
                    onMouseEnter={openOfferPopover}
                    onMouseLeave={scheduleOfferClose}
                    className="offer-popover absolute bottom-full left-0 z-40 mb-2 min-w-44 rounded-lg border border-green-200 bg-white p-2 shadow-xl shadow-primary/10"
                  >
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-green-800">
                      Ofertas disponibles
                    </p>
                    <div className="space-y-1">
                      {discountOffers.map((offer) => (
                        <p
                          key={`${offer.threshold}-${offer.amountOffUsd}`}
                          className="whitespace-nowrap rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-800"
                        >
                          Oferta desde {offer.threshold} uds. · -{formatCurrency(offer.amountOffUsd, currency, rate)} c/u
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {appliedDiscountAmountUsd > 0 && (
            <p className="mt-1 text-xs font-semibold text-green-700">
              Descuento de {formatCurrency(appliedDiscountAmountUsd, currency, rate)} c/u aplicado
            </p>
          )}

          <div className="mt-auto space-y-3 pt-3">
            {variants.length > 1 && (
              <div className="relative">
                <button
                  ref={variantTriggerRef}
                  type="button"
                  aria-label={`Variante de ${product.name}: ${variantLabel}`}
                  aria-haspopup="listbox"
                  aria-expanded={isVariantOpen}
                  aria-controls={variantListId}
                  onClick={() => {
                    setIsVariantOpen((open) => !open);
                    setAreOffersOpen(false);
                  }}
                  onKeyDown={handleVariantTriggerKeyDown}
                  className={`flex h-11 min-h-11 w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-3 pr-9 text-center text-sm font-medium leading-5 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${shouldHighlightVariant ? 'size-selector-attention border-primary ring-2 ring-primary/20' : ''}`}
                >
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{variantLabel}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-3 h-4 w-4 text-gray-700 transition-transform duration-200${isVariantOpen ? ' rotate-180' : ''}`}
                  />
                </button>
                {isVariantOpen && (
                  <div
                    id={variantListId}
                    role="listbox"
                    aria-label={`Opciones de variante de ${product.name}`}
                    className="variant-menu-popover absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl shadow-primary/10"
                  >
                    {variants.map((variant, index) => index === selectedVariantIndex ? null : (
                      <button
                        key={`${variant.name}-${index}`}
                        ref={(element) => { variantOptionsRef.current[index] = element; }}
                        type="button"
                        role="option"
                        aria-selected={false}
                        tabIndex={index === availableVariantIndexes[0] ? 0 : -1}
                        onClick={() => selectVariant(index)}
                        onKeyDown={(event) => handleVariantOptionKeyDown(event, index)}
                        className="flex min-h-10 w-full items-center justify-center rounded-md bg-white px-3 text-center text-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {variant.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                label={`Cantidad de ${product.name}`}
                compact
                className="w-full xl:w-auto"
              />
              <Button
                size="sm"
                onClick={handleAddToCart}
                className={selectedVariant ? 'min-h-11 w-full bg-primary text-white hover:bg-primary/90 xl:flex-1' : 'min-h-11 w-full cursor-not-allowed bg-primary/50 text-white/90 hover:bg-primary/50 xl:flex-1'}
                aria-disabled={!selectedVariant}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
