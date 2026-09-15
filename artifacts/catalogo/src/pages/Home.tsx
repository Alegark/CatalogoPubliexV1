import { useState, useEffect, useMemo } from 'react';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import { ProductCard } from '@/components/ProductCard';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { normalizeDiscountTiers } from '@/lib/commerce';
import { BannerCarousel } from '@/components/BannerCarousel';

export function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: categories } = useListCategories();
  
  const queryParams = useMemo(() => {
    const params: any = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (selectedCategory) params.category = selectedCategory;
    return params;
  }, [debouncedSearch, selectedCategory]);

  const { data: products, isLoading } = useListProducts(queryParams);
  const orderedProducts = useMemo(() => {
    if (!products) return products;

    return [...products].sort((a, b) => {
      const aHasOffers = normalizeDiscountTiers(
        a.discountTiers,
        a.discountThreshold ?? null,
        a.discountPercent ?? null,
        a.basePrice,
      ).some((tier) => tier.amountOffUsd > 0);
      const bHasOffers = normalizeDiscountTiers(
        b.discountTiers,
        b.discountThreshold ?? null,
        b.discountPercent ?? null,
        b.basePrice,
      ).some((tier) => tier.amountOffUsd > 0);

      return Number(bHasOffers) - Number(aHasOffers);
    });
  }, [products]);

  return (
    <div className="flex flex-col gap-8">
      <BannerCarousel />

      {/* Search & Filters */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:gap-6 sm:p-6 md:flex-row md:items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input 
            placeholder="Buscar productos..."
            aria-label="Buscar productos"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="min-h-11 w-full border-transparent bg-gray-50 pl-10 transition-colors focus:bg-white"
          />
        </div>

        <div className="flex w-full flex-wrap gap-2 md:w-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            aria-pressed={selectedCategory === null}
            className={`min-h-11 rounded-full px-3 text-sm font-semibold transition-colors md:min-h-9 md:px-2.5 md:text-xs ${
              selectedCategory === null 
                ? 'bg-primary text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {categories?.map((category) => {
            const categoryName = category.name;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(categoryName)}
                aria-pressed={selectedCategory === categoryName}
                className={`min-h-11 rounded-full px-3 text-sm font-semibold transition-colors md:min-h-9 md:px-2.5 md:text-xs ${
                  selectedCategory === categoryName
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {categoryName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white rounded-xl border border-gray-100 h-[360px] animate-pulse">
              <div className="h-48 bg-gray-200 rounded-t-xl"></div>
              <div className="p-5 space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 mt-4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : orderedProducts?.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">No se encontraron productos</h3>
          <p className="text-gray-500 mt-2">Intenta ajustar tu búsqueda o filtros.</p>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-2 items-stretch gap-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {orderedProducts?.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
