import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { useListProducts, useGetExchangeRate } from '@workspace/api-client-react';
import { useCart } from '@/contexts/CartContext';
import { trackCommerceEvent } from '@/lib/analytics';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency } from '@/lib/commerce';
import { getAllProductImages } from '@/lib/assets';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Tag, X } from 'lucide-react';
import { Link } from 'wouter';
import { QuantitySelector } from '@/components/QuantitySelector';
import { PaymentMethods } from '@/components/PaymentMethods';
import { ProductDescription } from '@/components/ProductDescription';
import { ProductSpecifications } from '@/components/ProductSpecifications';
import { StockIndicator } from '@/components/StockIndicator';
import { useToast } from '@/hooks/use-toast';
import { getApplicableDiscountAmountUsd, normalizeDiscountTiers } from '@/lib/commerce';

export function ProductDetail() {
  const [, params] = useRoute('/producto/:slug');
  const { data: products, isLoading } = useListProducts({ slug: params?.slug });
  const product = products?.[0];

  const { currency } = useCurrency();
  const { addItem } = useCart();
  const { toast } = useToast();
  const { data: exchangeRate } = useGetExchangeRate();

  const [selectedSizeIndex, setSelectedSizeIndex] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageZoomOrigin, setImageZoomOrigin] = useState('50% 50%');
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [areOffersOpen, setAreOffersOpen] = useState(false);
  const [shouldHighlightSize, setShouldHighlightSize] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const suppressGalleryClick = useRef(false);
  const sizeTriggerRef = useRef<HTMLButtonElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const offersTriggerRef = useRef<HTMLButtonElement>(null);
  const offersMenuRef = useRef<HTMLDivElement>(null);
  const imageViewerCloseRef = useRef<HTMLButtonElement>(null);

  const images = useMemo(() => {
    if (!product) return [];
    return getAllProductImages(product.images, product.id);
  }, [product]);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsImageViewerOpen(false);
  }, [product?.id]);

  useEffect(() => {
    if (!isImageViewerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsImageViewerOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    imageViewerCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isImageViewerOpen]);

  useEffect(() => {
    if (!isSizeMenuOpen && !areOffersOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        isSizeMenuOpen
        && !sizeTriggerRef.current?.contains(event.target)
        && !sizeMenuRef.current?.contains(event.target)
      ) {
        setIsSizeMenuOpen(false);
      }
      if (
        areOffersOpen
        && !offersTriggerRef.current?.contains(event.target)
        && !offersMenuRef.current?.contains(event.target)
      ) {
        setAreOffersOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isSizeMenuOpen) {
        setIsSizeMenuOpen(false);
        sizeTriggerRef.current?.focus();
      }
      if (areOffersOpen) {
        setAreOffersOpen(false);
        offersTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [areOffersOpen, isSizeMenuOpen]);

  const changeImage = (direction: 1 | -1) => {
    if (images.length < 2) return;
    setActiveImageIndex((currentIndex) => (
      (currentIndex + direction + images.length) % images.length
    ));
  };

  const handleGalleryTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
    suppressGalleryClick.current = false;
  };

  const handleGalleryTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touchStart = touchStartX.current;
    touchStartX.current = null;
    if (event.target instanceof Element && event.target.closest('button')) return;
    if (touchStart === null) {
      setIsImageViewerOpen(true);
      return;
    }

    const touchEndX = event.changedTouches[0]?.clientX;
    if (touchEndX === undefined) {
      setIsImageViewerOpen(true);
      return;
    }

    const horizontalDistance = touchEndX - touchStart;
    if (Math.abs(horizontalDistance) < 40) {
      setIsImageViewerOpen(true);
      return;
    }

    suppressGalleryClick.current = true;
    window.setTimeout(() => {
      suppressGalleryClick.current = false;
    }, 350);
    changeImage(horizontalDistance < 0 ? 1 : -1);
  };

  const handleGalleryClick = () => {
    if (suppressGalleryClick.current) return;
    setIsImageViewerOpen(true);
  };

  const handleGalleryKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsImageViewerOpen(true);
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center animate-pulse">Cargando producto...</div>;
  }

  if (!product) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold">Producto no encontrado</h2>
        <Link href="/" className="text-primary hover:underline mt-4 inline-block">Volver al catálogo</Link>
      </div>
    );
  }

  const variants = product.sizes && product.sizes.length > 0
    ? product.sizes
    : [{ name: 'Estándar', price: product.basePrice }];
  const effectiveSizeIndex = selectedSizeIndex ?? (variants.length === 1 ? 0 : null);
  const selectedSize = effectiveSizeIndex === null ? null : variants[effectiveSizeIndex];
  const originalPriceUSD = selectedSize?.price ?? product.basePrice;
  const discountTiers = normalizeDiscountTiers(
    product.discountTiers,
    product.discountThreshold ?? null,
    product.discountPercent ?? null,
    originalPriceUSD,
  );
  const appliedDiscountAmountUsd = getApplicableDiscountAmountUsd(
    discountTiers,
    quantity,
    product.discountThreshold ?? null,
    product.discountPercent ?? null,
    originalPriceUSD,
  );
  const currentPriceUSD = Math.max(0, originalPriceUSD - appliedDiscountAmountUsd);
  const hasDiscount = appliedDiscountAmountUsd > 0;
  const discountOffers = discountTiers.filter((tier) => tier.amountOffUsd > 0);
  const sizeListId = `product-size-options-${product.id}`;
  const offersListId = `product-discount-offers-${product.id}`;

  const rate = exchangeRate?.usdToBs ?? 0;
  const displayPrice = formatCurrency(currentPriceUSD, currency, rate);
  const displayOriginalPrice = formatCurrency(originalPriceUSD, currency, rate);

  const selectSize = (index: number) => {
    setSelectedSizeIndex(index);
    setIsSizeMenuOpen(false);
    sizeTriggerRef.current?.focus();
  };

  const handleAddToCart = async () => {
    if (!selectedSize) {
      setShouldHighlightSize(true);
      window.setTimeout(() => setShouldHighlightSize(false), 520);
      sizeTriggerRef.current?.focus();
      return;
    }
    try {
      addItem({
        productId: product.id,
        productName: product.name,
        sizeName: selectedSize.name,
        sizePrice: selectedSize.price,
        quantity,
        discountTiers,
        discountThreshold: product.discountThreshold ?? null,
        discountPercent: product.discountPercent ?? null,
        image: images[0],
        deliveryTime: product.deliveryTime,
      });
      await trackCommerceEvent({
        eventType: 'add_to_cart',
        productId: product.id,
        source: 'product_detail',
        sizeName: selectedSize.name,
        quantity,
      });
      setQuantity(1);
    } catch {
      toast({
        variant: 'destructive',
        title: 'No se pudo agregar el producto',
        description: 'Inténtalo nuevamente.',
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver al catálogo
        </Link>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Gallery */}
        <div className="flex w-full flex-col gap-4 p-0 md:w-1/2 md:p-0">
          <div
            className="relative aspect-square min-w-0 flex-1 touch-pan-y overflow-hidden rounded-none border-0 bg-gray-50 p-0 md:rounded-none md:border-0 md:p-0"
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
            onClick={handleGalleryClick}
            onKeyDown={handleGalleryKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`Ampliar imagen de ${product.name}`}
            onPointerMove={(event) => {
              if (event.pointerType !== 'mouse') return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const x = ((event.clientX - bounds.left) / bounds.width) * 100;
              const y = ((event.clientY - bounds.top) / bounds.height) * 100;
              setImageZoomOrigin(`${x}% ${y}%`);
            }}
            onPointerLeave={() => setImageZoomOrigin('50% 50%')}
          >
            <img
              key={activeImageIndex}
              src={images[activeImageIndex]} 
              alt={product.name} 
              className="gallery-image-in h-full w-full cursor-zoom-in object-contain transition-transform duration-200 ease-out md:hover:scale-[1.65]"
              style={{ transformOrigin: imageZoomOrigin }}
              width="720"
              height="720"
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    changeImage(-1);
                  }}
                  aria-label={`Imagen anterior de ${product.name}`}
                  className="group absolute left-2 top-1/2 z-10 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-full p-0 text-gray-800 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-white/60 bg-white/65 shadow-sm transition-transform duration-150 group-hover:scale-105 group-active:scale-90">
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    changeImage(1);
                  }}
                  aria-label={`Siguiente imagen de ${product.name}`}
                  className="group absolute right-2 top-1/2 z-10 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-full p-0 text-gray-800 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-white/60 bg-white/65 shadow-sm transition-transform duration-150 group-hover:scale-105 group-active:scale-90">
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </button>

                <div
                  className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1.5 shadow-sm md:hidden"
                  aria-hidden="true"
                >
                  {images.map((_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 rounded-full transition-all duration-200 ${
                        activeImageIndex === index ? 'w-4 bg-primary' : 'w-1.5 bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="sr-only" aria-live="polite">
                  Imagen {activeImageIndex + 1} de {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="hidden w-full gap-3 overflow-x-auto pb-2 md:flex md:flex-row md:overflow-y-hidden md:pb-0">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    activeImageIndex === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-gray-300'
                  }`}
                  aria-label={`Ver imagen ${idx + 1} de ${product.name}`}
                  aria-pressed={activeImageIndex === idx}
                >
                  <img src={img} alt="" className="h-full w-full object-contain bg-gray-50 p-1" width="80" height="80" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="w-full md:w-1/2 p-6 md:p-10 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
            {product.name}
          </h1>

          <div className="flex items-end gap-3 mb-6">
            <span className="text-4xl font-black text-primary tracking-tight">
              {displayPrice}
            </span>
            {hasDiscount && (
              <span className="text-xl text-gray-400 line-through mb-1">
                {displayOriginalPrice}
              </span>
            )}
          </div>

          <div className="mb-4">
            <StockIndicator stockQuantity={product.stockQuantity} deliveryTime={product.deliveryTime} />
          </div>

          {discountOffers.length > 0 && (
            <div className="relative mb-6 rounded-xl border border-green-200 bg-green-50/70 p-3">
              {discountOffers.length === 1 && (
                <div className="flex items-center gap-2 text-sm font-bold text-green-800">
                  <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Ofertas por cantidad</span>
                </div>
              )}

              {discountOffers.length > 1 && (
                <>
                  <div className="hidden items-center gap-2 text-sm font-bold text-green-800 md:flex">
                    <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Ofertas por cantidad</span>
                  </div>
                  <button
                    ref={offersTriggerRef}
                    type="button"
                    aria-label={`Ver ${discountOffers.length} ofertas para ${product.name}`}
                    aria-expanded={areOffersOpen}
                    aria-controls={offersListId}
                    onClick={() => {
                      setAreOffersOpen((open) => !open);
                      setIsSizeMenuOpen(false);
                    }}
                    className="flex min-h-10 w-full items-center gap-3 rounded-lg px-1 py-0.5 text-left text-sm font-bold text-green-800 transition-colors hover:bg-green-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 md:hidden"
                  >
                    <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">Ofertas por cantidad</span>
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                      <span>{discountOffers.length} ofertas</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 transition-transform duration-200${areOffersOpen ? ' rotate-180' : ''}`}
                      />
                    </span>
                  </button>
                </>
              )}

              <div className={`mt-2 flex flex-wrap gap-2${discountOffers.length > 1 ? ' hidden md:flex' : ''}`}>
                {discountOffers.map((offer) => (
                  <span
                    key={`${offer.threshold}-${offer.amountOffUsd}`}
                    className="rounded-md border border-green-200 bg-white px-2.5 py-1 text-xs font-semibold text-green-800"
                  >
                    Desde {offer.threshold} uds. · -{formatCurrency(offer.amountOffUsd, currency, rate)} c/u
                  </span>
                ))}
              </div>

              {discountOffers.length > 1 && areOffersOpen && (
                <div
                  ref={offersMenuRef}
                  id={offersListId}
                  role="dialog"
                  aria-label={`Ofertas disponibles para ${product.name}`}
                  className="offer-popover mt-3 space-y-1 border-t border-green-200/80 pt-3 md:hidden"
                >
                  {discountOffers.map((offer) => (
                    <div
                      key={`${offer.threshold}-${offer.amountOffUsd}`}
                      className="flex items-start gap-2 py-1 text-xs font-semibold text-green-800"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" aria-hidden="true" />
                      <span>Desde {offer.threshold} uds. · -{formatCurrency(offer.amountOffUsd, currency, rate)} c/u</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-6 flex-1">
            {product.sizes && product.sizes.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Tamaño</h3>
                {product.sizes.length > 4 ? (
                  <div className="relative">
                    <button
                      ref={sizeTriggerRef}
                      type="button"
                      aria-label={`Seleccionar tamaño para ${product.name}`}
                      aria-haspopup="listbox"
                      aria-expanded={isSizeMenuOpen}
                      aria-controls={sizeListId}
                      onClick={() => {
                        setIsSizeMenuOpen((open) => !open);
                        setAreOffersOpen(false);
                      }}
                      className={`flex min-h-12 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${shouldHighlightSize ? 'size-selector-attention border-primary ring-2 ring-primary/20' : ''}`}
                    >
                      <span className="min-w-0 truncate text-left">{selectedSize?.name ?? 'Elige tamaño'}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 text-gray-700 transition-transform duration-200${isSizeMenuOpen ? ' rotate-180' : ''}`}
                      />
                    </button>

                    {isSizeMenuOpen && (
                      <div
                        ref={sizeMenuRef}
                        id={sizeListId}
                        role="listbox"
                        aria-label={`Tamaños disponibles para ${product.name}`}
                        className="variant-menu-popover absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl shadow-primary/10"
                      >
                        {product.sizes.map((size, idx) => (
                          <button
                            key={idx}
                            type="button"
                            role="option"
                            aria-selected={effectiveSizeIndex === idx}
                            onClick={() => selectSize(idx)}
                            className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              effectiveSizeIndex === idx
                                ? 'bg-primary/10 font-semibold text-primary'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {size.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${shouldHighlightSize ? 'size-selector-attention rounded-lg p-1' : ''}`}>
                    {product.sizes.map((size, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectSize(idx)}
                        aria-pressed={effectiveSizeIndex === idx}
                        className={`min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          effectiveSizeIndex === idx
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {size.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <ProductSpecifications size={selectedSize} />

            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Cantidad</h3>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <QuantitySelector
                  value={quantity}
                  onChange={setQuantity}
                  label={`Cantidad de ${product.name}`}
                />

              </div>
            </div>

            <Button
              size="lg"
              className={`h-14 w-full text-lg font-bold ${selectedSize ? '' : 'cursor-not-allowed bg-primary/50 text-white/90 hover:bg-primary/50'}`}
              onClick={handleAddToCart}
              aria-disabled={!selectedSize}
            >
              <ShoppingCart className="mr-2 h-5 w-5" aria-hidden="true" />
              Agregar al carrito
            </Button>

            <div className="pt-4 border-t border-gray-100 text-sm text-gray-500">
              <span className="font-semibold text-gray-900">Tiempo de entrega:</span> {product.deliveryTime}
            </div>

            <PaymentMethods />
          </div>

        </div>
      </div>

      <ProductDescription description={product.description} />

      {isImageViewerOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Visor de imágenes de ${product.name}`}
          onClick={() => setIsImageViewerOpen(false)}
        >
          <div
            className="relative flex h-full w-full items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
          >
            <img
              src={images[activeImageIndex]}
              alt={`${product.name}, imagen ${activeImageIndex + 1} de ${images.length}`}
              className="max-h-[calc(100vh-5rem)] max-w-full object-contain"
              width="1200"
              height="1200"
            />
            <button
              type="button"
              onClick={() => setIsImageViewerOpen(false)}
              ref={imageViewerCloseRef}
              className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-gray-800 shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95"
              aria-label="Cerrar visor de imagen"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => changeImage(-1)}
                  className="absolute left-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-gray-800 shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => changeImage(1)}
                  className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-gray-800 shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95"
                  aria-label="Siguiente imagen"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gray-900/70 px-3 py-1.5 text-xs font-semibold text-white">
                  {activeImageIndex + 1} / {images.length}
                </div>
              </>
            )}
            <span className="absolute bottom-0 left-0 hidden items-center gap-1.5 text-xs font-medium text-white/80 md:flex">
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Pasa el cursor para ampliar
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
