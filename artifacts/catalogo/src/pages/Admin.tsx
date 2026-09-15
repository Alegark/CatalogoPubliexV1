import { useEffect, useRef, useState } from "react";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useGetExchangeRate,
  useUpdateExchangeRate,
  useListCategories,
  useCreateCategory,
  useDeleteCategory,
  getListProductsQueryKey,
  getGetExchangeRateQueryKey,
  getListCategoriesQueryKey,
  getGetAdminSessionQueryKey,
  useGetAdminSession,
  useAdminLogin,
  useAdminLogout,
  useListBanners,
  useReorderBanners,
  useUpdateBannerLink,
  useDeleteBanner,
  getListBannersQueryKey,
  useListProductKeywords,
  getListProductKeywordsQueryKey,
  useDeleteProductKeyword,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  GripVertical,
  ImagePlus,
  Loader2,
  LogOut,
  Pencil,
  Trash2,
  Plus,
  X,
  Save,
} from "lucide-react";
import { Search, SlidersHorizontal, Tags } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import { normalizeDiscountTiers, type DiscountTier } from "@/lib/commerce";
import { uploadBannerImages, uploadProductImages } from "@/lib/admin-uploads";
import { ProductKeywordPicker } from "@/components/ProductKeywordPicker";
import { ProductInput, Product, Banner } from "@workspace/api-client-react";
import {
  countAdminProductsByCategory,
  filterAdminProducts,
} from "@/lib/admin-product-filters";
import { FinanceAdmin } from "@/components/finance/FinanceAdmin";
import { AnalyticsAdmin } from "@/components/AnalyticsAdmin";

type Tab = "productos" | "tasa" | "banners" | "finanzas" | "estadisticas";

const MAX_BANNER_COUNT = 10;
const MAX_BANNER_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_BANNER_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getProductDiscountTiers(product: Product | null): DiscountTier[] {
  if (product?.discountTiers?.length)
    return normalizeDiscountTiers(
      product.discountTiers,
      null,
      null,
      product.basePrice,
    );
  return normalizeDiscountTiers(
    undefined,
    product?.discountThreshold ?? null,
    product?.discountPercent ?? null,
    product?.basePrice ?? 0,
  );
}

function productSlugFromName(name: string): string {
  return name
    .toLocaleLowerCase("es-VE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function Admin() {
  const session = useGetAdminSession();
  const logout = useAdminLogout();
  const queryClient = useQueryClient();

  if (session.isLoading) {
    return (
      <div className="py-20 text-center animate-pulse">
        Verificando acceso...
      </div>
    );
  }

  if (!session.data?.configured) {
    return (
      <AdminMessage
        title="Acceso administrativo no configurado"
        description="Ejecuta la migración y crea un usuario administrador con pnpm.cmd run db:seed antes de usar esta consola."
      />
    );
  }

  if (!session.data.authenticated) {
    return <AdminLogin />;
  }

  const handleLogout = async () => {
    await logout.mutateAsync();
    await queryClient.invalidateQueries({
      queryKey: getGetAdminSessionQueryKey(),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={logout.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Cerrar sesión
        </Button>
      </div>
      <AdminConsole />
    </div>
  );
}

function AdminMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <p className="mt-3 text-sm text-gray-600">{description}</p>
    </div>
  );
}

function AdminLogin() {
  const login = useAdminLogin();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await login.mutateAsync({ data: { username, password } });
      setPassword("");
      await queryClient.invalidateQueries({
        queryKey: getGetAdminSessionQueryKey(),
      });
    } catch {
      setError(
        "No se pudo iniciar sesión. Verifica tus datos e inténtalo nuevamente.",
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-md space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Acceso administrativo
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Inicia sesión para administrar productos y la tasa de cambio.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="space-y-1">
        <label
          htmlFor="admin-username"
          className="text-sm font-semibold text-gray-800"
        >
          Usuario
        </label>
        <Input
          id="admin-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="admin-password"
          className="text-sm font-semibold text-gray-800"
        >
          Contraseña
        </label>
        <Input
          id="admin-password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <Button
        type="submit"
        className="min-h-11 w-full"
        disabled={login.isPending}
      >
        {login.isPending ? "Iniciando sesión..." : "Iniciar sesión"}
      </Button>
    </form>
  );
}

function AdminConsole() {
  const [activeTab, setActiveTab] = useState<Tab>("productos");

  return (
    <div className="bg-white min-h-[calc(100vh-10rem)] rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50/50">
        <button
          className={`min-w-[8rem] flex-1 whitespace-nowrap py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
            activeTab === "productos"
              ? "text-primary border-b-2 border-primary bg-white"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
          onClick={() => setActiveTab("productos")}
        >
          Productos
        </button>
        <button
          className={`min-w-[8rem] flex-1 whitespace-nowrap py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
            activeTab === "tasa"
              ? "text-primary border-b-2 border-primary bg-white"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
          onClick={() => setActiveTab("tasa")}
        >
          Tasa de Cambio
        </button>
        <button
          className={`min-w-[8rem] flex-1 whitespace-nowrap py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
            activeTab === "banners"
              ? "text-primary border-b-2 border-primary bg-white"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
          onClick={() => setActiveTab("banners")}
        >
          Banners
        </button>
        <button
          className={`min-w-[8rem] flex-1 whitespace-nowrap py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
            activeTab === "finanzas"
              ? "text-primary border-b-2 border-primary bg-white"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
          onClick={() => setActiveTab("finanzas")}
        >
          <span className="inline-flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" /> Finanzas
          </span>
        </button>
        <button
          className={`min-w-[8rem] flex-1 whitespace-nowrap py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
            activeTab === "estadisticas"
              ? "text-primary border-b-2 border-primary bg-white"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
          onClick={() => setActiveTab("estadisticas")}
        >
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden="true" /> Estadísticas
          </span>
        </button>
      </div>

      <div className="p-6 md:p-10">
        {activeTab === "productos" && <ProductsAdmin />}
        {activeTab === "tasa" && <ExchangeRateAdmin />}
        {activeTab === "banners" && <BannersAdmin />}
        {activeTab === "finanzas" && <FinanceAdmin />}
        {activeTab === "estadisticas" && <AnalyticsAdmin />}
      </div>
    </div>
  );
}

function BannersAdmin() {
  const { data: banners, isLoading, isError } = useListBanners();
  const { data: products } = useListProducts();
  const reorderBanners = useReorderBanners();
  const updateBannerLink = useUpdateBannerLink();
  const deleteBanner = useDeleteBanner();
  const queryClient = useQueryClient();
  const [orderedBanners, setOrderedBanners] = useState<Banner[]>([]);
  const [draggedBannerId, setDraggedBannerId] = useState<number | null>(null);
  const [savingLinkBannerId, setSavingLinkBannerId] = useState<number | null>(
    null,
  );
  const [openBannerProductId, setOpenBannerProductId] = useState<number | null>(
    null,
  );
  const [bannerError, setBannerError] = useState("");
  const [isUploadingBanners, setIsUploadingBanners] = useState(false);

  useEffect(() => {
    if (banners) setOrderedBanners(banners);
  }, [banners]);

  const persistOrder = async (nextOrder: Banner[]) => {
    const previousOrder = orderedBanners;
    setOrderedBanners(nextOrder);
    setBannerError("");
    try {
      await reorderBanners.mutateAsync({
        data: { ids: nextOrder.map((banner) => banner.id) },
      });
      await queryClient.invalidateQueries({
        queryKey: getListBannersQueryKey(),
      });
    } catch (error) {
      setOrderedBanners(previousOrder);
      setBannerError(
        error instanceof Error ? error.message : "No se pudo guardar el orden.",
      );
    }
  };

  const moveBanner = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedBanners.length) return;
    const nextOrder = [...orderedBanners];
    [nextOrder[index], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[index],
    ];
    void persistOrder(nextOrder);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedBannerId === null) return;
    const sourceIndex = orderedBanners.findIndex(
      (banner) => banner.id === draggedBannerId,
    );
    setDraggedBannerId(null);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const nextOrder = [...orderedBanners];
    const [movedBanner] = nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, movedBanner);
    void persistOrder(nextOrder);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const remainingSlots = MAX_BANNER_COUNT - orderedBanners.length;
    if (files.length > remainingSlots) {
      setBannerError(
        `Puedes agregar ${remainingSlots} banner${remainingSlots === 1 ? "" : "s"} más.`,
      );
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !ACCEPTED_BANNER_TYPES.has(file.type) ||
        file.size > MAX_BANNER_SIZE_BYTES,
    );
    if (invalidFile) {
      setBannerError(
        `"${invalidFile.name}" debe ser una imagen compatible de máximo 5 MB.`,
      );
      return;
    }

    setBannerError("");
    try {
      setIsUploadingBanners(true);
      await uploadBannerImages(files);
      await queryClient.invalidateQueries({
        queryKey: getListBannersQueryKey(),
      });
    } catch (error) {
      setBannerError(
        error instanceof Error
          ? error.message
          : "No se pudieron subir los banners.",
      );
    } finally {
      setIsUploadingBanners(false);
    }
  };

  const handleDelete = async (banner: Banner) => {
    if (
      !window.confirm(
        "¿Eliminar este banner? Esta acción también elimina su imagen de Storage.",
      )
    )
      return;
    setBannerError("");
    try {
      await deleteBanner.mutateAsync({ id: banner.id });
      await queryClient.invalidateQueries({
        queryKey: getListBannersQueryKey(),
      });
    } catch (error) {
      setBannerError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el banner.",
      );
    }
  };

  const promotionalProducts =
    products?.filter((product) =>
      getProductDiscountTiers(product).some((tier) => tier.amountOffUsd > 0),
    ) ?? [];

  const handleBannerLinkChange = async (banner: Banner, value: string) => {
    const productId = value ? Number(value) : null;
    setSavingLinkBannerId(banner.id);
    setBannerError("");
    try {
      const updated = await updateBannerLink.mutateAsync({
        id: banner.id,
        data: { productId },
      });
      setOrderedBanners((current) =>
        current.map((item) => (item.id === banner.id ? updated : item)),
      );
    } catch (error) {
      setBannerError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el enlace del banner.",
      );
    } finally {
      setSavingLinkBannerId(null);
    }
  };

  const isBusy =
    isUploadingBanners ||
    reorderBanners.isPending ||
    updateBannerLink.isPending ||
    deleteBanner.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Banners del catálogo
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Agrega hasta 10 imágenes, ordénalas y enlaza cada una opcionalmente
            a un producto con oferta.
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {isUploadingBanners ? "Subiendo..." : "Agregar imágenes"}
          <input
            type="file"
            className="sr-only"
            accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
            multiple
            disabled={isBusy || orderedBanners.length >= MAX_BANNER_COUNT}
            onChange={(event) => void handleUpload(event)}
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <span>
          {orderedBanners.length} de {MAX_BANNER_COUNT} banners activos
        </span>
        <span className="text-xs text-blue-700">
          JPG, PNG, WEBP, GIF o AVIF ? máximo 5 MB
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">Guía para diseñar banners</p>
        <p className="mt-1">
          Tamaño recomendado: <strong>1600 ? 640 px</strong> (proporción 2.5:1).
          Mantén logos y textos importantes en la zona central; el carrusel
          recorta ligeramente los bordes según la pantalla.
        </p>
      </div>

      {bannerError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {bannerError}
        </p>
      )}

      {isLoading ? (
        <div
          className="flex gap-4 overflow-hidden"
          aria-label="Cargando banners"
        >
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-48 min-w-[240px] animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      ) : isError ? (
        <p
          role="alert"
          className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600"
        >
          No se pudieron cargar los banners. Comprueba la sesión y la conexión
          con la API.
        </p>
      ) : orderedBanners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <ImagePlus
            className="mx-auto h-8 w-8 text-gray-400"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-semibold text-gray-900">
            Aún no hay banners
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            La página pública ocultará esta sección hasta que agregues una
            imagen.
          </p>
        </div>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2 pb-3">
          <div
            className="flex min-w-max gap-4"
            role="list"
            aria-label="Banners ordenados"
          >
            {orderedBanners.map((banner, index) => (
              <article
                key={banner.id}
                role="listitem"
                draggable={!isBusy}
                onDragStart={() => setDraggedBannerId(banner.id)}
                onDragEnd={() => setDraggedBannerId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(index)}
                className={`relative w-[min(72vw,300px)] shrink-0 overflow-visible rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
                  draggedBannerId === banner.id
                    ? "border-primary opacity-60"
                    : "border-gray-200"
                } ${openBannerProductId === banner.id ? "z-20" : "z-0"}`}
              >
                <div className="relative aspect-[2.25/1] overflow-hidden rounded-t-xl bg-gray-50">
                  <img
                    src={banner.url}
                    alt={`Banner ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(banner)}
                    disabled={isBusy}
                    aria-label={`Eliminar banner ${index + 1}`}
                    className="absolute right-2 top-2 grid min-h-9 min-w-9 place-items-center rounded-full bg-white/90 text-red-600 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="space-y-2 border-t border-gray-100 p-3">
                  <label
                    htmlFor={`banner-product-${banner.id}`}
                    className="text-xs font-semibold text-gray-700"
                  >
                    Enlace opcional
                  </label>
                  <BannerProductSelect
                    banner={banner}
                    products={promotionalProducts}
                    disabled={isBusy}
                    saving={savingLinkBannerId === banner.id}
                    open={openBannerProductId === banner.id}
                    onOpenChange={(open) =>
                      setOpenBannerProductId(open ? banner.id : null)
                    }
                    onChange={(value) =>
                      void handleBannerLinkChange(banner, value)
                    }
                  />
                  <p className="min-h-4 text-[11px] text-gray-500">
                    {savingLinkBannerId === banner.id
                      ? "Guardando enlace..."
                      : banner.link
                        ? `Lleva a ${banner.productName}`
                        : banner.productId
                          ? "El producto ya no tiene oferta activa"
                          : "Selecciona un producto con oferta"}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
                    <GripVertical className="h-4 w-4" aria-hidden="true" />
                    Arrastra para ordenar
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveBanner(index, -1)}
                      disabled={isBusy || index === 0}
                      aria-label={`Mover banner ${index + 1} a la izquierda`}
                      className="grid min-h-9 min-w-9 place-items-center rounded-md border border-gray-200 text-gray-600 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBanner(index, 1)}
                      disabled={isBusy || index === orderedBanners.length - 1}
                      aria-label={`Mover banner ${index + 1} a la derecha`}
                      className="grid min-h-9 min-w-9 place-items-center rounded-md border border-gray-200 text-gray-600 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BannerProductSelect({
  banner,
  products,
  disabled,
  saving,
  open,
  onOpenChange,
  onChange,
}: {
  banner: Banner;
  products: Product[];
  disabled: boolean;
  saving: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  const currentProductIsAvailable =
    banner.productId !== null &&
    products.some((product) => product.id === banner.productId);
  const options =
    banner.productId && !currentProductIsAvailable
      ? [
          {
            id: banner.productId,
            name: banner.productName ?? "Producto vinculado",
          },
          ...products,
        ]
      : products;

  return (
    <div ref={menuRef} className="relative">
      <button
        id={`banner-product-${banner.id}`}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`banner-product-list-${banner.id}`}
        aria-busy={saving}
        className={`flex min-h-11 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
          open
            ? "border-primary ring-1 ring-primary/20"
            : "border-input hover:border-primary/60"
        }`}
        onClick={() => onOpenChange(!open)}
      >
        <span
          className={
            banner.productId
              ? "truncate pr-3 text-gray-900"
              : "text-muted-foreground"
          }
        >
          {banner.productId
            ? (banner.productName ?? "Producto vinculado")
            : "Sin enlace"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={`banner-product-list-${banner.id}`}
          role="listbox"
          aria-label="Productos con oferta"
          className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5"
        >
          <div className="max-h-56 overflow-y-auto p-1">
            <button
              type="button"
              role="option"
              aria-selected={banner.productId === null}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                banner.productId === null
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-gray-800"
              }`}
              onClick={() => {
                onChange("");
                onOpenChange(false);
              }}
            >
              <span>Sin enlace</span>
              {banner.productId === null && (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
            </button>

            {options.map((product) => {
              const selected = banner.productId === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    selected
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-gray-800"
                  }`}
                  onClick={() => {
                    onChange(product.id.toString());
                    onOpenChange(false);
                  }}
                >
                  <span className="truncate pr-3">{product.name}</span>
                  {selected && (
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ExchangeRateAdmin() {
  const { data: exchangeRate, isLoading } = useGetExchangeRate();
  const updateRate = useUpdateExchangeRate();
  const queryClient = useQueryClient();
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (exchangeRate) setRate(exchangeRate.usdToBs.toString());
  }, [exchangeRate]);

  if (isLoading) return <div className="animate-pulse">Cargando...</div>;

  const handleSave = async () => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate <= 0) return alert("Tasa inválida");

    await updateRate.mutateAsync({ data: { usdToBs: numRate } });
    queryClient.invalidateQueries({ queryKey: getGetExchangeRateQueryKey() });
    alert("Tasa actualizada correctamente");
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Tasa de Cambio Actual
        </h3>
        <p className="text-3xl font-black text-primary mb-1">
          {exchangeRate ? `${exchangeRate.usdToBs} Bs / USD` : "No configurada"}
        </p>
        {exchangeRate && (
          <p className="text-sm text-gray-500">
            Última actualización:{" "}
            {new Date(exchangeRate.updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Nueva Tasa (Bs por 1 USD)
          </label>
          <Input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={exchangeRate?.usdToBs.toString() || "0.00"}
          />
        </div>
        <Button
          onClick={handleSave}
          className="w-full"
          disabled={updateRate.isPending}
        >
          {updateRate.isPending ? "Guardando..." : "Actualizar Tasa"}
        </Button>
      </div>
    </div>
  );
}

function ProductsAdmin() {
  const { data: products, isLoading } = useListProducts();
  const categoriesQuery = useListCategories();
  const keywordQuery = useListProductKeywords();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [keywordManagerOpen, setKeywordManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryManagerError, setCategoryManagerError] = useState("");
  const [categoryManagerStatus, setCategoryManagerStatus] = useState("");
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(
    null,
  );
  const [replacementCategoryId, setReplacementCategoryId] = useState<
    number | null
  >(null);
  const [keywordSearch, setKeywordSearch] = useState("");
  const [keywordDeletePending, setKeywordDeletePending] = useState<
    string | null
  >(null);
  const [keywordManagerError, setKeywordManagerError] = useState("");
  const [keywordManagerStatus, setKeywordManagerStatus] = useState("");
  const [productError, setProductError] = useState("");
  const deleteProduct = useDeleteProduct();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const deleteKeyword = useDeleteProductKeyword();
  const queryClient = useQueryClient();
  const allProducts = products ?? [];
  const categories = categoriesQuery.data ?? [];
  const categoryCounts = countAdminProductsByCategory(allProducts);
  const visibleProducts = filterAdminProducts(
    allProducts,
    productSearch,
    selectedCategory,
  );
  const filteredKeywords = (keywordQuery.data ?? []).filter((keyword) =>
    keyword
      .toLocaleLowerCase("es-VE")
      .includes(keywordSearch.trim().toLocaleLowerCase("es-VE")),
  );

  if (isLoading)
    return <div className="animate-pulse">Cargando productos...</div>;

  const handleDelete = async (id: number) => {
    if (!confirm("¿Seguro que deseas eliminar este producto?")) return;
    setProductError("");
    try {
      await deleteProduct.mutateAsync({ id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getListProductKeywordsQueryKey(),
        }),
      ]);
    } catch (error) {
      setProductError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el producto.",
      );
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryManagerError("Escribe un nombre para la categoría.");
      return;
    }

    setCategoryManagerError("");
    setCategoryManagerStatus("");
    try {
      const category = await createCategory.mutateAsync({ data: { name } });
      setNewCategoryName("");
      setCategoryManagerStatus(`Categoría “${category.name}” creada.`);
      if (pendingCategoryId !== null) setReplacementCategoryId(category.id);
      await queryClient.invalidateQueries({
        queryKey: getListCategoriesQueryKey(),
      });
    } catch (error) {
      setCategoryManagerError(
        error instanceof Error
          ? error.message
          : "No se pudo crear la categoría.",
      );
    }
  };

  const startCategoryDelete = (id: number) => {
    setPendingCategoryId(id);
    setReplacementCategoryId(null);
    setCategoryManagerError("");
    setCategoryManagerStatus("");
  };

  const cancelCategoryDelete = () => {
    setPendingCategoryId(null);
    setReplacementCategoryId(null);
    setCategoryManagerError("");
  };

  const handleDeleteCategory = async () => {
    if (pendingCategoryId === null) return;
    const category = categories.find((item) => item.id === pendingCategoryId);
    if (!category) return;
    const productCount = categoryCounts.get(category.name) ?? 0;
    if (productCount > 0 && replacementCategoryId === null) {
      setCategoryManagerError(
        "Selecciona una categoría destino para mover los productos.",
      );
      return;
    }

    setCategoryManagerError("");
    setCategoryManagerStatus("");
    try {
      const result = await deleteCategory.mutateAsync({
        id: category.id,
        data: { replacementCategoryId },
      });
      if (selectedCategory === category.name) setSelectedCategory("");
      setPendingCategoryId(null);
      setReplacementCategoryId(null);
      setCategoryManagerStatus(
        result.movedProductCount > 0
          ? `Categoría eliminada y ${result.movedProductCount} producto${result.movedProductCount === 1 ? "" : "s"} reasignado${result.movedProductCount === 1 ? "" : "s"}.`
          : "Categoría eliminada.",
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListCategoriesQueryKey(),
        }),
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
      ]);
    } catch (error) {
      setCategoryManagerError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la categoría.",
      );
    }
  };

  const handleDeleteKeyword = async (keyword: string) => {
    if (
      !confirm(
        `¿Eliminar “${keyword}” de las palabras sugeridas y de todos los productos que la usan?`,
      )
    )
      return;

    setKeywordDeletePending(keyword);
    setKeywordManagerError("");
    setKeywordManagerStatus("");
    try {
      await deleteKeyword.mutateAsync({ data: { keyword } });
      setKeywordManagerStatus(`“${keyword}” fue eliminada de las sugerencias.`);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListProductKeywordsQueryKey(),
        }),
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
      ]);
    } catch (error) {
      setKeywordManagerError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la palabra clave.",
      );
    } finally {
      setKeywordDeletePending(null);
    }
  };

  if (isCreating || editingProduct) {
    return (
      <ProductForm
        product={editingProduct}
        onCancel={() => {
          setIsCreating(false);
          setEditingProduct(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="order-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Catálogo de Productos
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {visibleProducts.length} de {allProducts.length} productos visibles
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          className="min-h-11 gap-2 self-start"
        >
          <Plus className="w-4 h-4" /> Nuevo Producto
        </Button>
      </div>

      {productError && (
        <p
          role="alert"
          className="order-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {productError}
        </p>
      )}

      <section className="order-3 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block flex-1">
            <span className="sr-only">Buscar productos</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Buscar por nombre, slug, categoría o palabra clave..."
              className="min-h-11 pl-10"
            />
          </label>
          {(productSearch || selectedCategory) && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 shrink-0"
              onClick={() => {
                setProductSearch("");
                setSelectedCategory("");
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <SlidersHorizontal
            className="h-4 w-4 text-primary"
            aria-hidden="true"
          />
          Filtrar por categoría
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Filtros de categorías"
        >
          <button
            type="button"
            role="listitem"
            aria-pressed={!selectedCategory}
            onClick={() => setSelectedCategory("")}
            className={`min-h-10 rounded-full border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${!selectedCategory ? "border-primary bg-primary text-white" : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-primary/5"}`}
          >
            Todas{" "}
            <span className="ml-1 text-xs opacity-75">
              {allProducts.length}
            </span>
          </button>
          {categories.map((category) => {
            const isSelected = selectedCategory === category.name;
            return (
              <button
                key={category.id}
                type="button"
                role="listitem"
                aria-pressed={isSelected}
                onClick={() =>
                  setSelectedCategory(isSelected ? "" : category.name)
                }
                className={`min-h-10 rounded-full border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isSelected ? "border-primary bg-primary text-white" : "border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40 hover:bg-primary/5"}`}
              >
                {category.name}{" "}
                <span className="ml-1 text-xs opacity-75">
                  {categoryCounts.get(category.name) ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="order-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleProducts.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col hover:border-primary/50 transition-colors shadow-sm hover:shadow-md"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-secondary-foreground bg-secondary/10 px-2 py-1 rounded">
                {p.category}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-primary"
                  onClick={() => setEditingProduct(p)}
                  aria-label={`Editar ${p.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-destructive"
                  onClick={() => handleDelete(p.id)}
                  disabled={deleteProduct.isPending}
                  aria-label={`Eliminar ${p.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <h3 className="font-bold text-gray-900 leading-tight mb-1">
              {p.name}
            </h3>
            <p className="text-lg font-black text-primary mb-3">
              {formatUSD(p.basePrice)}
            </p>
            <div className="mt-auto pt-3 border-t border-gray-100 text-xs text-gray-500">
              {p.sizes.length} tamaños |{" "}
              {p.discountTiers?.length
                ? `${p.discountTiers.length} ofertas por cantidad`
                : "Sin ofertas"}
            </div>
          </div>
        ))}
      </div>

      {visibleProducts.length === 0 && (
        <div className="order-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
          <Search
            className="mx-auto h-8 w-8 text-gray-400"
            aria-hidden="true"
          />
          <h3 className="mt-3 text-base font-semibold text-gray-900">
            No encontramos productos
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Prueba con otro término o limpia los filtros.
          </p>
        </div>
      )}

      <div className="order-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
            aria-expanded={categoryManagerOpen}
            onClick={() => setCategoryManagerOpen((open) => !open)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Tags className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900">
                  Gestionar categorías
                </span>
                <span className="block truncate text-xs text-gray-500">
                  Crea, filtra o reasigna productos antes de eliminar.
                </span>
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${categoryManagerOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {categoryManagerOpen && (
            <div className="space-y-3 border-t border-gray-100 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateCategory();
                    }
                  }}
                  placeholder="Nueva categoría"
                  maxLength={80}
                  disabled={createCategory.isPending}
                  className="min-h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 shrink-0 gap-2"
                  onClick={() => void handleCreateCategory()}
                  disabled={createCategory.isPending}
                >
                  {createCategory.isPending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  Agregar
                </Button>
              </div>

              <div
                className="space-y-2"
                role="list"
                aria-label="Categorías administrables"
              >
                {categories.map((category) => {
                  const productCount = categoryCounts.get(category.name) ?? 0;
                  const isPendingDelete = pendingCategoryId === category.id;
                  return (
                    <div
                      key={category.id}
                      className="rounded-lg border border-gray-200 bg-gray-50/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {category.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {productCount} producto
                            {productCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() =>
                            isPendingDelete
                              ? cancelCategoryDelete()
                              : startCategoryDelete(category.id)
                          }
                          disabled={deleteCategory.isPending}
                          aria-label={
                            isPendingDelete
                              ? `Cancelar eliminación de ${category.name}`
                              : `Eliminar categoría ${category.name}`
                          }
                        >
                          {isPendingDelete ? (
                            <X className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>

                      {isPendingDelete && (
                        <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs leading-5 text-amber-900">
                            {productCount > 0
                              ? `Esta categoría contiene ${productCount} producto${productCount === 1 ? "" : "s"}. Selecciona dónde moverlo${productCount === 1 ? "" : "s"} antes de eliminarla.`
                              : "Esta categoría no tiene productos y puede eliminarse directamente."}
                          </p>

                          {productCount > 0 && (
                            <div
                              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                              role="list"
                              aria-label="Categorías destino"
                            >
                              {categories
                                .filter(
                                  (candidate) => candidate.id !== category.id,
                                )
                                .map((candidate) => {
                                  const isReplacement =
                                    replacementCategoryId === candidate.id;
                                  return (
                                    <button
                                      key={candidate.id}
                                      type="button"
                                      role="listitem"
                                      aria-pressed={isReplacement}
                                      onClick={() =>
                                        setReplacementCategoryId(candidate.id)
                                      }
                                      className={`min-h-10 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isReplacement ? "border-primary bg-primary/10 font-semibold text-primary" : "border-gray-200 bg-white text-gray-700 hover:border-primary/40"}`}
                                    >
                                      {candidate.name}
                                    </button>
                                  );
                                })}
                            </div>
                          )}

                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-10"
                              onClick={cancelCategoryDelete}
                              disabled={deleteCategory.isPending}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              className="min-h-10 gap-2"
                              onClick={() => void handleDeleteCategory()}
                              disabled={
                                deleteCategory.isPending ||
                                (productCount > 0 &&
                                  replacementCategoryId === null)
                              }
                            >
                              {deleteCategory.isPending && (
                                <Loader2
                                  className="h-4 w-4 animate-spin"
                                  aria-hidden="true"
                                />
                              )}
                              {productCount > 0
                                ? "Mover y eliminar"
                                : "Eliminar categoría"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {categories.length === 0 && (
                <p className="text-sm text-gray-500">
                  Todavía no hay categorías creadas.
                </p>
              )}
              {categoryManagerError && (
                <p role="alert" className="text-xs text-red-600">
                  {categoryManagerError}
                </p>
              )}
              {categoryManagerStatus && (
                <p role="status" className="text-xs text-emerald-700">
                  {categoryManagerStatus}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
            aria-expanded={keywordManagerOpen}
            onClick={() => setKeywordManagerOpen((open) => !open)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Tags className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900">
                  Gestionar palabras clave
                </span>
                <span className="block truncate text-xs text-gray-500">
                  Busca y elimina sugerencias guardadas en los productos.
                </span>
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${keywordManagerOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {keywordManagerOpen && (
            <div className="space-y-3 border-t border-gray-100 p-4">
              <label className="relative block">
                <span className="sr-only">Buscar palabras clave</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  value={keywordSearch}
                  onChange={(event) => setKeywordSearch(event.target.value)}
                  placeholder="Buscar palabra clave..."
                  className="min-h-11 pl-10"
                />
              </label>

              {keywordQuery.isLoading && (
                <p className="text-sm text-gray-500">
                  Cargando palabras clave...
                </p>
              )}
              {keywordQuery.isError && (
                <p role="alert" className="text-sm text-red-600">
                  No se pudieron cargar las palabras clave.
                </p>
              )}
              {!keywordQuery.isLoading &&
                !keywordQuery.isError &&
                filteredKeywords.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                    {keywordQuery.data?.length
                      ? "No hay coincidencias."
                      : "Todavía no hay palabras clave guardadas."}
                  </p>
                )}
              {!keywordQuery.isLoading &&
                !keywordQuery.isError &&
                filteredKeywords.length > 0 && (
                  <div
                    className="max-h-56 space-y-2 overflow-y-auto pr-1"
                    role="list"
                    aria-label="Palabras clave administrables"
                  >
                    {filteredKeywords.map((keyword) => (
                      <div
                        key={keyword}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                          {keyword}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => void handleDeleteKeyword(keyword)}
                          disabled={Boolean(keywordDeletePending)}
                          aria-label={`Eliminar palabra clave ${keyword}`}
                        >
                          {keywordDeletePending === keyword ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              {keywordManagerError && (
                <p role="alert" className="text-xs text-red-600">
                  {keywordManagerError}
                </p>
              )}
              {keywordManagerStatus && (
                <p role="status" className="text-xs text-emerald-700">
                  {keywordManagerStatus}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type PendingImage = {
  file: File;
  previewUrl: string;
};

type ImageMoveAnimation = {
  kind: "saved" | "pending";
  index: number;
  direction: -1 | 1;
  key: number;
};

const MAX_IMAGE_FILES = 10;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function ProductForm({
  product,
  onCancel,
}: {
  product: Product | null;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const createProd = useCreateProduct();
  const updateProd = useUpdateProduct();
  const categoriesQuery = useListCategories();
  const createCategory = useCreateCategory();
  const keywordQuery = useListProductKeywords();
  const deleteKeyword = useDeleteProductKeyword();

  const [formData, setFormData] = useState<ProductInput>({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    keywords: product?.keywords || [],
    category: product?.category || "",
    images: product?.images || [],
    basePrice: product?.basePrice || 0,
    deliveryTime: product?.deliveryTime || "",
    stockQuantity: product?.stockQuantity ?? 0,
    sizes: product?.sizes || [{ name: "Estándar", price: 0 }],
    discountTiers: getProductDiscountTiers(product),
  });

  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState("");
  const [imageMoveAnimation, setImageMoveAnimation] =
    useState<ImageMoveAnimation | null>(null);
  const imageHoldRef = useRef<{
    timer: number | null;
    repeat: number | null;
    triggered: boolean;
  }>({ timer: null, repeat: null, triggered: false });
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [formError, setFormError] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [keywordDeletePending, setKeywordDeletePending] = useState<
    string | null
  >(null);
  const [keywordDeleteStatus, setKeywordDeleteStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach(({ previewUrl }) =>
        URL.revokeObjectURL(previewUrl),
      );
    };
  }, []);

  useEffect(() => {
    if (!categoryOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!categoryMenuRef.current?.contains(event.target as Node)) {
        setCategoryOpen(false);
        setIsAddingCategory(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCategoryOpen(false);
        setIsAddingCategory(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [categoryOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "number" ? (value ? parseFloat(value) : undefined) : value,
    }));
  };

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    const availableSlots =
      MAX_IMAGE_FILES - formData.images.length - pendingImages.length;
    const acceptedFiles: File[] = [];
    const errors: string[] = [];

    if (availableSlots <= 0) {
      setImageError(
        `Puedes tener hasta ${MAX_IMAGE_FILES} imágenes por producto.`,
      );
      return;
    }

    selectedFiles.slice(0, availableSlots).forEach((file) => {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        errors.push(`${file.name}: formato no compatible.`);
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        errors.push(`${file.name}: supera el límite de 5 MB.`);
        return;
      }
      acceptedFiles.push(file);
    });

    if (selectedFiles.length > availableSlots) {
      errors.push(
        `Solo puedes agregar ${availableSlots} imagen${availableSlots === 1 ? "" : "es"} más.`,
      );
    }

    if (acceptedFiles.length > 0) {
      setPendingImages((current) => [
        ...current,
        ...acceptedFiles.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    }
    setImageError(errors.join(" "));
  };

  const removeExistingImage = (index: number) => {
    setFormData((current) => ({
      ...current,
      images: current.images.filter((_, imageIndex) => imageIndex !== index),
    }));
    setImageError("");
  };

  const removePendingImage = (index: number) => {
    const pendingImage = pendingImages[index];
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImages((current) =>
      current.filter((_, imageIndex) => imageIndex !== index),
    );
    setImageError("");
  };
  const flashImageMove = (
    kind: "saved" | "pending",
    index: number,
    direction: -1 | 1,
  ) => {
    const key = Date.now();
    setImageMoveAnimation({ kind, index, direction, key });
    window.setTimeout(() => {
      setImageMoveAnimation((current) =>
        current?.key === key ? null : current,
      );
    }, 240);
  };

  const moveExistingImage = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= formData.images.length) return;
    setFormData((current) => {
      const images = [...current.images];
      [images[index], images[targetIndex]] = [
        images[targetIndex],
        images[index],
      ];
      return { ...current, images };
    });
    flashImageMove("saved", index, direction);
  };

  const movePendingImage = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pendingImages.length) return;
    setPendingImages((current) => {
      const images = [...current];
      [images[index], images[targetIndex]] = [
        images[targetIndex],
        images[index],
      ];
      return images;
    });
    flashImageMove("pending", index, direction);
  };

  const stopImageHold = () => {
    if (imageHoldRef.current.timer !== null)
      window.clearTimeout(imageHoldRef.current.timer);
    if (imageHoldRef.current.repeat !== null)
      window.clearInterval(imageHoldRef.current.repeat);
    imageHoldRef.current.timer = null;
    imageHoldRef.current.repeat = null;
  };

  const startImageHold = (
    kind: "saved" | "pending",
    index: number,
    direction: -1 | 1,
  ) => {
    stopImageHold();
    imageHoldRef.current.triggered = false;
    imageHoldRef.current.timer = window.setTimeout(() => {
      imageHoldRef.current.triggered = true;
      const move = kind === "saved" ? moveExistingImage : movePendingImage;
      move(index, direction);
      imageHoldRef.current.repeat = window.setInterval(
        () => move(index, direction),
        260,
      );
    }, 480);
  };

  const handleImageArrowClick = (
    kind: "saved" | "pending",
    index: number,
    direction: -1 | 1,
  ) => {
    if (imageHoldRef.current.triggered) {
      imageHoldRef.current.triggered = false;
      return;
    }
    const move = kind === "saved" ? moveExistingImage : movePendingImage;
    move(index, direction);
  };
  const clearPendingImages = () => {
    pendingImagesRef.current.forEach(({ previewUrl }) =>
      URL.revokeObjectURL(previewUrl),
    );
    setPendingImages([]);
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError("Escribe un nombre para la categoría.");
      return;
    }

    setCategoryError("");
    try {
      const category = await createCategory.mutateAsync({ data: { name } });
      setFormData((current) => ({ ...current, category: category.name }));
      setNewCategoryName("");
      setIsAddingCategory(false);
      setCategoryOpen(false);
      await queryClient.invalidateQueries({
        queryKey: getListCategoriesQueryKey(),
      });
    } catch (error) {
      setCategoryError(
        error instanceof Error
          ? error.message
          : "No se pudo crear la categoría.",
      );
    }
  };

  const handleDeleteKeyword = async (keyword: string) => {
    const confirmed = window.confirm(
      `¿Eliminar “${keyword}” de las palabras sugeridas y de los productos que la usan?`,
    );
    if (!confirmed) return;

    setKeywordDeletePending(keyword);
    setKeywordDeleteStatus(null);
    try {
      await deleteKeyword.mutateAsync({ data: { keyword } });
      const keywordKey = keyword.trim().toLocaleLowerCase("es-VE");
      setFormData((current) => ({
        ...current,
        keywords: (current.keywords ?? []).filter(
          (currentKeyword) =>
            currentKeyword.trim().toLocaleLowerCase("es-VE") !== keywordKey,
        ),
      }));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListProductKeywordsQueryKey(),
        }),
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
      ]);
      setKeywordDeleteStatus({
        type: "success",
        message: `“${keyword}” fue eliminada de las sugerencias.`,
      });
    } catch (error) {
      setKeywordDeleteStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la palabra clave.",
      });
    } finally {
      setKeywordDeletePending(null);
    }
  };

  const handleSizeChange = (
    index: number,
    field:
      "name" | "price" | "measurements" | "acrylicThicknessCm" | "acrylicColor",
    value: string,
  ) => {
    const newSizes = [...formData.sizes];
    newSizes[index] = {
      ...newSizes[index],
      [field]:
        field === "price"
          ? value
            ? parseFloat(value)
            : 0
          : field === "acrylicThicknessCm"
            ? value
              ? parseFloat(value)
              : undefined
            : value,
    };
    setFormData((prev) => ({ ...prev, sizes: newSizes }));
  };

  const addSize = () => {
    setFormData((prev) => ({
      ...prev,
      sizes: [...prev.sizes, { name: "", price: 0 }],
    }));
  };

  const removeSize = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }));
  };

  const handleDiscountChange = (
    index: number,
    field: keyof DiscountTier,
    value: string,
  ) => {
    const discountTiers = [...(formData.discountTiers ?? [])];
    discountTiers[index] = {
      ...discountTiers[index],
      [field]: value === "" ? 0 : Number(value),
    };
    setFormData((prev) => ({ ...prev, discountTiers }));
    setFormError("");
  };

  const addDiscountTier = () => {
    setFormData((prev) => ({
      ...prev,
      discountTiers: [
        ...(prev.discountTiers ?? []),
        { threshold: 1, amountOffUsd: 0 },
      ],
    }));
    setFormError("");
  };

  const removeDiscountTier = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      discountTiers: (prev.discountTiers ?? []).filter(
        (_, tierIndex) => tierIndex !== index,
      ),
    }));
    setFormError("");
  };

  const validateDiscountTiers = (tiers: DiscountTier[]) => {
    const seen = new Set<number>();
    let previousAmount = 0;
    for (const tier of tiers) {
      if (!Number.isInteger(tier.threshold) || tier.threshold <= 0) {
        return "Cada cantidad mínima debe ser un entero mayor que cero.";
      }
      if (
        !Number.isFinite(tier.amountOffUsd) ||
        tier.amountOffUsd < 0 ||
        tier.amountOffUsd > 1_000_000
      ) {
        return "Cada descuento debe ser un monto entre 0 y 1.000.000 USD.";
      }
      if (
        Math.abs(
          tier.amountOffUsd * 100 - Math.round(tier.amountOffUsd * 100),
        ) > Number.EPSILON
      ) {
        return "Cada descuento puede tener como máximo dos decimales.";
      }
      if (seen.has(tier.threshold)) {
        return "No puede haber dos ofertas con la misma cantidad mínima.";
      }
      if (tier.amountOffUsd < previousAmount) {
        return "Los descuentos deben mantenerse o aumentar en cantidades mayores.";
      }
      seen.add(tier.threshold);
      previousAmount = tier.amountOffUsd;
    }
    return null;
  };

  const normalizeSizes = () =>
    formData.sizes.map((size) => ({
      name: size.name.trim(),
      price: size.price,
      ...(size.measurements?.trim()
        ? { measurements: size.measurements.trim() }
        : {}),
      ...(size.acrylicThicknessCm !== undefined
        ? { acrylicThicknessCm: size.acrylicThicknessCm }
        : {}),
      ...(size.acrylicColor?.trim()
        ? { acrylicColor: size.acrylicColor.trim() }
        : {}),
    }));

  const validateSizes = (sizes: ReturnType<typeof normalizeSizes>) => {
    for (const size of sizes) {
      if (!size.name) return "Cada tamaño debe tener un nombre.";
      if (!Number.isFinite(size.price) || size.price < 0)
        return `El precio de ${size.name} no es válido.`;
      if (size.measurements && size.measurements.length > 120)
        return `Las medidas de ${size.name} son demasiado largas.`;
      if (
        size.acrylicThicknessCm !== undefined &&
        (!Number.isFinite(size.acrylicThicknessCm) ||
          size.acrylicThicknessCm < 0 ||
          size.acrylicThicknessCm > 100 ||
          Math.abs(
            size.acrylicThicknessCm * 100 -
              Math.round(size.acrylicThicknessCm * 100),
          ) > Number.EPSILON)
      ) {
        return `El grosor del acrílico de ${size.name} debe tener hasta dos decimales y estar entre 0 y 1000 mm.`;
      }
      if (size.acrylicColor && size.acrylicColor.length > 60)
        return `El color de ${size.name} es demasiado largo.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !Number.isInteger(formData.stockQuantity) ||
      formData.stockQuantity < 0
    ) {
      setFormError(
        "El stock debe ser un número entero igual o mayor que cero.",
      );
      return;
    }
    const sizes = normalizeSizes();
    const sizeError = validateSizes(sizes);
    if (sizeError) {
      setFormError(sizeError);
      return;
    }
    const discountTiers = [...(formData.discountTiers ?? [])].sort(
      (a, b) => a.threshold - b.threshold,
    );
    const discountError = validateDiscountTiers(discountTiers);
    if (discountError) {
      setFormError(discountError);
      return;
    }
    setFormError("");
    try {
      let images = formData.images;
      if (pendingImages.length > 0) {
        setImageError("");
        setIsUploadingImages(true);
        try {
          const uploadedImages = await uploadProductImages(
            pendingImages.map(({ file }) => file),
          );
          images = [...images, ...uploadedImages.map(({ url }) => url)];
          setFormData((current) => ({ ...current, images }));
          clearPendingImages();
        } catch (error) {
          setImageError(
            error instanceof Error
              ? error.message
              : "No se pudieron subir las imágenes.",
          );
          return;
        } finally {
          setIsUploadingImages(false);
        }
      }

      const data = {
        ...formData,
        slug: formData.slug || productSlugFromName(formData.name),
        images,
        sizes,
        discountTiers,
        discountThreshold: undefined,
        discountPercent: undefined,
      };
      if (product) {
        await updateProd.mutateAsync({ id: product.id, data });
      } else {
        await createProd.mutateAsync({ data });
      }
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getListProductKeywordsQueryKey(),
      });
      onCancel();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Error guardando producto. Revisa los datos.",
      );
      console.error(err);
    } finally {
      setIsUploadingImages(false);
    }
  };

  // Auto-generate slug from name if empty
  const handleNameBlur = () => {
    if (!formData.slug && formData.name) {
      setFormData((prev) => ({
        ...prev,
        slug: productSlugFromName(formData.name),
      }));
    }
  };

  const isPending =
    createProd.isPending || updateProd.isPending || isUploadingImages;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {product ? "Editar Producto" : "Nuevo Producto"}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          type="button"
          aria-label="Cerrar formulario"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold">Nombre</label>
          <Input
            required
            name="name"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleNameBlur}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold">Slug (URL)</label>
          <Input
            name="slug"
            value={formData.slug}
            onChange={handleChange}
            placeholder="Se genera desde el nombre"
          />
          <p className="text-xs text-gray-500">
            Se genera automáticamente si lo dejas vacío.
          </p>
        </div>
        <div className="space-y-1 [&>label:first-child]:hidden">
          <label className="text-sm font-semibold">Categoría</label>
          <div ref={categoryMenuRef} className="relative space-y-1">
            <label className="text-sm font-semibold">Categoría</label>
            <button
              type="button"
              className={`flex min-h-11 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                categoryOpen
                  ? "border-primary ring-1 ring-primary/20"
                  : "border-input hover:border-primary/60"
              }`}
              aria-haspopup="listbox"
              aria-expanded={categoryOpen}
              onClick={() => {
                setCategoryOpen((open) => !open);
                setCategoryError("");
              }}
            >
              <span
                className={
                  formData.category ? "text-gray-900" : "text-muted-foreground"
                }
              >
                {formData.category || "Seleccionar categoría"}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${categoryOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {categoryOpen && (
              <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5">
                <div
                  role="listbox"
                  aria-label="Categorías existentes"
                  className="max-h-56 overflow-y-auto p-1"
                >
                  {categoriesQuery.isLoading && (
                    <p className="px-3 py-3 text-sm text-gray-500">
                      Cargando categorías...
                    </p>
                  )}
                  {categoriesQuery.isError && (
                    <p className="px-3 py-3 text-sm text-red-600" role="alert">
                      No se pudieron cargar las categorías.
                    </p>
                  )}
                  {!categoriesQuery.isLoading &&
                    !categoriesQuery.isError &&
                    categoriesQuery.data?.length === 0 && (
                      <p className="px-3 py-3 text-sm text-gray-500">
                        Todavía no hay categorías creadas.
                      </p>
                    )}
                  {categoriesQuery.data?.map((category) => {
                    const selected = formData.category === category.name;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                          selected
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-gray-800"
                        }`}
                        onClick={() => {
                          setFormData((current) => ({
                            ...current,
                            category: category.name,
                          }));
                          setCategoryOpen(false);
                          setIsAddingCategory(false);
                          setCategoryError("");
                        }}
                      >
                        <span className="truncate pr-3">{category.name}</span>
                        {selected && (
                          <Check
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-gray-100 bg-gray-50/80 p-2">
                  {!isAddingCategory ? (
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      onClick={() => {
                        setIsAddingCategory(true);
                        setCategoryError("");
                      }}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Agregar nueva categoría
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor="new-category-name" className="sr-only">
                        Nombre de la nueva categoría
                      </label>
                      <Input
                        id="new-category-name"
                        value={newCategoryName}
                        onChange={(event) =>
                          setNewCategoryName(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateCategory();
                          }
                        }}
                        placeholder="Ej. Exhibidores"
                        maxLength={80}
                        autoFocus
                        disabled={createCategory.isPending}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-10 flex-1 gap-1"
                          onClick={() => void handleCreateCategory()}
                          disabled={createCategory.isPending}
                        >
                          {createCategory.isPending ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Save className="h-4 w-4" aria-hidden="true" />
                          )}
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-10"
                          onClick={() => {
                            setIsAddingCategory(false);
                            setNewCategoryName("");
                            setCategoryError("");
                          }}
                          disabled={createCategory.isPending}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {categoryError && (
              <p role="alert" className="text-xs text-red-600">
                {categoryError}
              </p>
            )}
            <input
              type="hidden"
              name="category"
              value={formData.category}
              required
              readOnly
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold">Precio Base (USD)</label>
          <Input
            required
            type="number"
            min="0"
            step="0.01"
            name="basePrice"
            value={formData.basePrice}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Descripción</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="product-keywords" className="text-sm font-semibold">
          Palabras clave
        </label>
        <ProductKeywordPicker
          id="product-keywords"
          value={formData.keywords ?? []}
          suggestions={keywordQuery.data ?? []}
          loading={keywordQuery.isLoading}
          error={keywordQuery.isError}
          disabled={isPending || Boolean(keywordDeletePending)}
          deletingKeyword={keywordDeletePending}
          onDeleteSuggestion={handleDeleteKeyword}
          onChange={(keywords) =>
            setFormData((current) => ({ ...current, keywords }))
          }
          placeholder="Ej. exhibidor, celular, teléfono"
        />
        {keywordDeleteStatus && (
          <p
            className={`text-xs ${keywordDeleteStatus.type === "error" ? "text-destructive" : "text-emerald-700"}`}
            role={keywordDeleteStatus.type === "error" ? "alert" : "status"}
          >
            {keywordDeleteStatus.message}
          </p>
        )}
        <p className="text-xs text-gray-500">
          Sepáralas por comas para que el producto aparezca aunque el cliente no
          use su título exacto.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Imágenes del producto
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-600">
              Selecciona una o varias imágenes. JPG, PNG, WEBP, GIF o AVIF ?
              máximo 5 MB cada una.
            </p>
            <p className="mt-2 text-xs leading-5 text-blue-700">
              Recomendado: <strong>1200 ? 1200 px</strong> (cuadrada), producto
              centrado con margen alrededor. PNG o WEBP funcionan mejor para
              productos transparentes.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2"
              onClick={() => imageInputRef.current?.click()}
              disabled={isPending}
            >
              {isUploadingImages ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
              )}
              {isUploadingImages
                ? "Subiendo imágenes..."
                : "Seleccionar imágenes"}
            </Button>
            <input
              ref={imageInputRef}
              id="product-images"
              className="sr-only"
              type="file"
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              multiple
              aria-label="Seleccionar imágenes del producto"
              onChange={handleImageSelection}
              disabled={isPending}
            />
          </div>
        </div>

        {imageError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {imageError}
          </p>
        )}

        {formData.images.length === 0 && pendingImages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            Todavía no hay imágenes. Si lo dejas vacío, el catálogo usará sus
            imágenes de respaldo.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {formData.images.map((image, index) => (
              <div
                key={`saved-image-${image}-${index}`}
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
              >
                <img
                  src={image}
                  alt={`${formData.name || "Producto"} imagen ${index + 1}`}
                  loading="lazy"
                  width={160}
                  height={160}
                  className={`aspect-square w-full object-cover ${imageMoveAnimation?.kind === "saved" && imageMoveAnimation.index === index ? "image-reorder-feedback" : ""}`}
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-sm transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  onClick={() => removeExistingImage(index)}
                  aria-label={`Eliminar imagen ${index + 1}`}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
                {index === 0 && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-white">
                    Principal
                  </span>
                )}
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-2 py-1.5">
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={
                      "Mover imagen " + (index + 1) + " hacia la izquierda"
                    }
                    onPointerDown={() => startImageHold("saved", index, -1)}
                    onPointerUp={stopImageHold}
                    onPointerCancel={stopImageHold}
                    onPointerLeave={stopImageHold}
                    onClick={() => handleImageArrowClick("saved", index, -1)}
                    style={{ touchAction: "none" }}
                    disabled={isPending || index === 0}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {index === 0 ? "Principal" : "Imagen " + (index + 1)}
                  </span>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={
                      "Mover imagen " + (index + 1) + " hacia la derecha"
                    }
                    onPointerDown={() => startImageHold("saved", index, 1)}
                    onPointerUp={stopImageHold}
                    onPointerCancel={stopImageHold}
                    onPointerLeave={stopImageHold}
                    onClick={() => handleImageArrowClick("saved", index, 1)}
                    style={{ touchAction: "none" }}
                    disabled={isPending || index === formData.images.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}

            {pendingImages.map((image, index) => (
              <div
                key={`${image.file.name}-${image.file.lastModified}-${index}`}
                className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50"
              >
                <img
                  src={image.previewUrl}
                  alt={image.file.name}
                  width={160}
                  height={160}
                  className={`aspect-square w-full object-cover ${imageMoveAnimation?.kind === "pending" && imageMoveAnimation.index === index ? "image-reorder-feedback" : ""}`}
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-sm transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  onClick={() => removePendingImage(index)}
                  aria-label={`Quitar ${image.file.name}`}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white">
                  Nueva: {image.file.name}
                </span>
                <div className="flex items-center justify-between border-t border-emerald-200 bg-white px-2 py-1.5">
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={
                      "Mover imagen nueva " +
                      (index + 1) +
                      " hacia la izquierda"
                    }
                    onPointerDown={() => startImageHold("pending", index, -1)}
                    onPointerUp={stopImageHold}
                    onPointerCancel={stopImageHold}
                    onPointerLeave={stopImageHold}
                    onClick={() => handleImageArrowClick("pending", index, -1)}
                    style={{ touchAction: "none" }}
                    disabled={isPending || index === 0}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="text-[11px] font-semibold text-gray-500">
                    Nueva
                  </span>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={
                      "Mover imagen nueva " + (index + 1) + " hacia la derecha"
                    }
                    onPointerDown={() => startImageHold("pending", index, 1)}
                    onPointerUp={stopImageHold}
                    onPointerCancel={stopImageHold}
                    onPointerLeave={stopImageHold}
                    onClick={() => handleImageArrowClick("pending", index, 1)}
                    style={{ touchAction: "none" }}
                    disabled={isPending || index === pendingImages.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Las imágenes nuevas se optimizan y se subirán al guardar el producto.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Tiempo de Entrega</label>
        <Input
          required
          name="deliveryTime"
          value={formData.deliveryTime}
          onChange={handleChange}
          placeholder="Ej. 3-5 días hábiles"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Stock disponible</label>
        <Input
          required
          name="stockQuantity"
          type="number"
          min="0"
          step="1"
          value={formData.stockQuantity ?? 0}
          onChange={handleChange}
          placeholder="0 = Por encargo"
        />
        <p className="text-xs text-gray-500">
          Usa 0 para mostrar “Por encargo”.
        </p>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-900">Tamaños y Precios</h3>
          <Button type="button" variant="outline" size="sm" onClick={addSize}>
            Añadir Tamaño
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Usa <span className="font-semibold text-gray-700">0</span> cuando la
          variante sea un servicio gratuito; se mostrará como “Gratis”.
        </p>
        {formData.sizes.map((size, idx) => (
          <div
            key={idx}
            className="space-y-3 rounded-lg border border-gray-200 bg-white p-3"
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] sm:items-end">
              <div className="space-y-1">
                <label
                  className="text-xs font-semibold text-gray-600"
                  htmlFor={`size-name-${idx}`}
                >
                  Tamaño
                </label>
                <Input
                  id={`size-name-${idx}`}
                  required
                  placeholder="Ej. Media Carta"
                  value={size.name}
                  onChange={(e) =>
                    handleSizeChange(idx, "name", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs font-semibold text-gray-600"
                  htmlFor={`size-price-${idx}`}
                >
                  Precio USD
                </label>
                <Input
                  id={`size-price-${idx}`}
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0 = Gratis"
                  value={size.price}
                  onChange={(e) =>
                    handleSizeChange(idx, "price", e.target.value)
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive shrink-0 sm:mb-0.5"
                onClick={() => removeSize(idx)}
                disabled={formData.sizes.length === 1}
                aria-label={`Eliminar tamaño ${size.name || idx + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label
                  className="text-xs font-semibold text-gray-600"
                  htmlFor={`size-measurements-${idx}`}
                >
                  Medidas (cm)
                </label>
                <Input
                  id={`size-measurements-${idx}`}
                  maxLength={120}
                  placeholder="30 ? 40 ? 15 cm"
                  value={size.measurements ?? ""}
                  onChange={(e) =>
                    handleSizeChange(idx, "measurements", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs font-semibold text-gray-600"
                  htmlFor={`size-thickness-${idx}`}
                >
                  Grosor (mm)
                </label>
                <Input
                  id={`size-thickness-${idx}`}
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  placeholder="Ej. 3"
                  value={
                    size.acrylicThicknessCm !== undefined
                      ? size.acrylicThicknessCm * 10
                      : ""
                  }
                  onChange={(e) =>
                    handleSizeChange(
                      idx,
                      "acrylicThicknessCm",
                      e.target.value
                        ? String(parseFloat(e.target.value) / 10)
                        : "",
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs font-semibold text-gray-600"
                  htmlFor={`size-color-${idx}`}
                >
                  Color del acrílico
                </label>
                <Input
                  id={`size-color-${idx}`}
                  maxLength={60}
                  placeholder="Ej. Transparente"
                  value={size.acrylicColor ?? ""}
                  onChange={(e) =>
                    handleSizeChange(idx, "acrylicColor", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-amber-900">
              Ofertas por cantidad
            </h3>
            <p className="mt-1 text-xs text-amber-800">
              Cada oferta descuenta un monto fijo por unidad y se aplica el
              nivel mas alto alcanzado.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addDiscountTier}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            Añadir oferta
          </Button>
        </div>

        {(formData.discountTiers ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-200 bg-white/60 p-3 text-sm text-amber-800">
            Este producto no tiene ofertas por cantidad.
          </p>
        ) : (
          <div className="space-y-3">
            {(formData.discountTiers ?? []).map((tier, index) => (
              <div
                key={index}
                className="grid grid-cols-1 items-end gap-3 rounded-lg border border-amber-100 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <div className="space-y-1">
                  <label
                    className="text-sm font-semibold text-amber-800"
                    htmlFor={`discount-threshold-${index}`}
                  >
                    Cantidad mínima
                  </label>
                  <Input
                    id={`discount-threshold-${index}`}
                    type="number"
                    min="1"
                    step="1"
                    value={tier.threshold}
                    onChange={(event) =>
                      handleDiscountChange(
                        index,
                        "threshold",
                        event.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label
                    className="text-sm font-semibold text-amber-800"
                    htmlFor={`discount-amount-${index}`}
                  >
                    Descuento por unidad (USD)
                  </label>
                  <Input
                    id={`discount-amount-${index}`}
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    value={tier.amountOffUsd}
                    onChange={(event) =>
                      handleDiscountChange(
                        index,
                        "amountOffUsd",
                        event.target.value,
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-destructive"
                  onClick={() => removeDiscountTier(index)}
                  aria-label={`Eliminar oferta desde ${tier.threshold} unidades`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {formError}
          </p>
        )}
      </section>

      <div className="pt-4 flex justify-end gap-3 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            "Guardando..."
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" /> Guardar Producto
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
