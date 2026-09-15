import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useListBanners, type Banner } from '@workspace/api-client-react';
import escaleraImage from '@assets/Escalera_Acrilica_1784777305367.png';
import portaTarjetasImage from '@assets/Porta-Tarjetas_1784777305367.png';
import cubosImage from '@assets/Cubos_Acrilicos_1784777305367.png';

const AUTO_ADVANCE_MS = 5000;
const SWIPE_DISTANCE_PX = 40;
type DisplayBanner = Pick<Banner, 'id' | 'url' | 'link' | 'productName'>;

const demoBanners: DisplayBanner[] = [
  { id: -1, url: escaleraImage, link: null, productName: null },
  { id: -2, url: portaTarjetasImage, link: null, productName: null },
  { id: -3, url: cubosImage, link: null, productName: null },
];

const slideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -24 : 24 }),
};

function BannerFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-[2.25/1] w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm sm:aspect-[3.8/1]">
      {children}
    </div>
  );
}

function BannerSkeleton() {
  return (
    <BannerFrame>
      <div className="h-full w-full animate-pulse bg-gradient-to-r from-gray-100 via-white to-gray-100" aria-hidden="true" />
      <span className="sr-only">Cargando promociones</span>
    </BannerFrame>
  );
}

export function BannerCarousel() {
  const { data: banners, isLoading } = useListBanners();
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const visibleBanners: DisplayBanner[] = banners?.length
    ? banners
    : import.meta.env.DEV
      ? demoBanners
      : [];

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(visibleBanners.length - 1, 0)));
  }, [visibleBanners.length]);

  const goTo = useCallback((nextIndex: number) => {
    if (visibleBanners.length < 2) return;
    const normalizedIndex = (nextIndex + visibleBanners.length) % visibleBanners.length;
    setDirection(normalizedIndex >= activeIndex ? 1 : -1);
    setActiveIndex(normalizedIndex);
  }, [activeIndex, visibleBanners.length]);

  const move = useCallback((delta: number) => {
    goTo(activeIndex + delta);
  }, [activeIndex, goTo]);

  useEffect(() => {
    if (visibleBanners.length < 2 || isPaused) return;
    const advance = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((current) => (current + 1) % visibleBanners.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(advance);
  }, [isPaused, visibleBanners.length]);

  useEffect(() => {
    if (visibleBanners.length < 2) return;
    const handleVisibilityChange = () => setIsPaused(document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [visibleBanners.length]);

  if (isLoading) return <BannerSkeleton />;
  if (visibleBanners.length === 0) return null;

  const activeBanner = visibleBanners[activeIndex];
  const motionTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < SWIPE_DISTANCE_PX) return;
    setIsPaused(false);
    move(distance < 0 ? 1 : -1);
  };

  const image = (
    <img
      src={activeBanner.url}
      alt="Promocion Publiex Maracaibo"
      className="h-full w-full select-none object-cover"
      draggable={false}
      decoding="async"
      loading={activeIndex === 0 ? 'eager' : 'lazy'}
    />
  );

  return (
    <section
      aria-label="Promociones"
      aria-roledescription="carrusel"
      className="group relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <BannerFrame>
        <AnimatePresence initial={false} custom={direction} mode="sync">
          <motion.div
            key={activeBanner.id}
            className="absolute inset-0 h-full w-full"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={motionTransition}
          >
            {activeBanner.link ? (
              <Link
                href={activeBanner.link}
                aria-label={`Ver ${activeBanner.productName ?? 'producto promocionado'}`}
                className="block h-full w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              >
                {image}
              </Link>
            ) : image}
          </motion.div>
        </AnimatePresence>

        {visibleBanners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Promocion anterior"
              onClick={() => move(-1)}
              className="absolute left-2 top-1/2 z-10 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center p-0 text-primary opacity-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:left-4 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/90 shadow-md backdrop-blur transition-transform hover:bg-white active:scale-90">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
            <button
              type="button"
              aria-label="Promocion siguiente"
              onClick={() => move(1)}
              className="absolute right-2 top-1/2 z-10 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center p-0 text-primary opacity-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:right-4 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/90 shadow-md backdrop-blur transition-transform hover:bg-white active:scale-90">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>

            <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
              {visibleBanners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  aria-label={`Mostrar promocion ${index + 1}`}
                  aria-current={index === activeIndex ? 'true' : undefined}
                  onClick={() => goTo(index)}
                  className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    index === activeIndex ? 'w-5 bg-white' : 'w-2 bg-white/60 hover:bg-white/90'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </BannerFrame>
    </section>
  );
}
