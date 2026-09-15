import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MutableRefObject } from 'react';
import { useGetExchangeRate, useListProducts, type Product } from '@workspace/api-client-react';
import { CalendarDays, ChevronDown, Download, FileText, ImagePlus, Loader2, Plus, RefreshCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getApplicableDiscountAmountUsd } from '@/lib/commerce';
import logoMark from '@assets/Mesa_de_trabajo_3.png';
import type { BudgetPdfData } from './BudgetPdf';
import {
  calculateLine,
  calculateTotals,
  convertUsdPrice,
  createLineId,
  formatQuoteAmount,
  getProductImages,
  getProductUnitPrice,
  getSuggestedBudgetNumber,
  imageToDataUrl,
  isAllowedLocalImage,
  readFileAsDataUrl,
  rememberBudgetNumber,
  toNumber,
} from './finance-utils';
import type { QuoteCurrency, QuoteLine, QuoteSettings } from './types';

const inputClass = 'min-h-10 border-gray-200 bg-white';
const panelClass = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm';

const defaultSettings: QuoteSettings = {
  clientName: '',
  rifCedula: '',
  city: 'Maracaibo',
  issueDate: '',
  quoteNumber: '',
  currency: 'USD',
  ivaEnabled: true,
  ivaPercent: 16,
  deliveryTime: '5-6 días hábiles aproximadamente.',
  paymentMethod: '50% de abono para comenzar el trabajo y saldo contra entrega.',
  advance: '50% de Abono para comenzar el trabajo.',
  notes: 'Precios sujetos a cambios. Presupuesto válido por 15 días.',
};

function setField<K extends keyof QuoteSettings>(settings: QuoteSettings, key: K, value: QuoteSettings[K]): QuoteSettings {
  return { ...settings, [key]: value };
}

function productMatches(product: Product, search: string): boolean {
  const query = search.trim().toLocaleLowerCase('es');
  if (!query) return true;
  return [product.name, product.slug, product.category, ...(product.keywords ?? [])]
    .some((value) => value.toLocaleLowerCase('es').includes(query));
}

function getProductDiscount(product: Product, quantity: number, sizePriceUsd = product.basePrice): number {
  return getApplicableDiscountAmountUsd(
    product.discountTiers,
    quantity,
    product.discountThreshold ?? null,
    product.discountPercent ?? null,
    sizePriceUsd,
  );
}

export function FinanceAdmin() {
  const { data: products = [], isLoading: productsLoading } = useListProducts();
  const { data: exchangeRate } = useGetExchangeRate();
  const [settings, setSettings] = useState<QuoteSettings>(() => ({
    ...defaultSettings,
    issueDate: getTodayForInput(),
    quoteNumber: getSuggestedBudgetNumber(),
  }));
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [expandedProductCategory, setExpandedProductCategory] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState('0');
  const [showCustomLine, setShowCustomLine] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const productPickerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const filteredProducts = useMemo(
    () => products.filter((product) => productMatches(product, productSearch)),
    [products, productSearch],
  );
  const groupedFilteredProducts = useMemo(() => {
    const groups = new Map<string, Product[]>();
    filteredProducts.forEach((product) => {
      const group = groups.get(product.category) ?? [];
      group.push(product);
      groups.set(product.category, group);
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, 'es'));
  }, [filteredProducts]);
  const rate = Number(exchangeRate?.usdToBs ?? 0);
  const totals = useMemo(
    () => calculateTotals(lines, settings.ivaEnabled, toNumber(settings.ivaPercent), settings.currency, rate),
    [lines, settings.ivaEnabled, settings.ivaPercent],
  );

  useEffect(() => {
    if (!productPickerOpen) return;
    const closePicker = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!productPickerRef.current?.contains(event.target)) setProductPickerOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProductPickerOpen(false);
    };
    document.addEventListener('pointerdown', closePicker);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closePicker);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [productPickerOpen]);

  function updateLine(id: string, update: Partial<QuoteLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...update } : line));
  }

  function addProductLine() {
    if (!selectedProduct) {
      setMessage({ kind: 'error', text: 'Selecciona un producto del catálogo.' });
      return;
    }
    const size = getProductUnitPrice(selectedProduct, selectedSizeIndex);
    const images = getProductImages(selectedProduct);
    const quantity = Math.max(1, Math.floor(selectedQuantity));
    setLines((current) => [...current, {
      id: createLineId(),
      kind: 'product',
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      category: selectedProduct.category,
      sizeName: size.name,
      description: selectedProduct.description ?? '',
      quantity,
      unitPrice: convertUsdPrice(size.priceUsd, settings.currency, rate),
      sourceUnitPriceUsd: size.priceUsd,
      unitPriceEdited: false,
      discountAmountUsd: getProductDiscount(selectedProduct, quantity, size.priceUsd),
      manualTotal: null,
      image: images[0] ?? null,
      imageOptions: images,
      imageIsCustom: false,
    }]);
    setMessage({ kind: 'success', text: 'Producto agregado al presupuesto.' });
  }

  function addCustomLine() {
    if (!customName.trim()) {
      setMessage({ kind: 'error', text: 'Escribe el nombre del concepto personalizado.' });
      return;
    }
    setLines((current) => [...current, {
      id: createLineId(),
      kind: 'custom',
      productId: null,
      productName: customName.trim(),
      category: 'Personalizado',
      sizeName: '',
      description: customDescription.trim(),
      quantity: Math.max(1, Math.floor(customQuantity)),
      unitPrice: Math.max(0, toNumber(customPrice)),
      sourceUnitPriceUsd: null,
      unitPriceEdited: true,
      discountAmountUsd: 0,
      manualTotal: null,
      image: null,
      imageOptions: [],
      imageIsCustom: false,
    }]);
    setCustomName('');
    setCustomDescription('');
    setCustomPrice('0');
    setCustomQuantity(1);
    setMessage({ kind: 'success', text: 'Concepto personalizado agregado.' });
  }

  function changeCurrency(currency: QuoteCurrency) {
    setSettings((current) => setField(current, 'currency', currency));
    if (currency === 'Bs' && rate <= 0) {
      setMessage({ kind: 'error', text: 'La tasa de cambio todavía no está configurada. Puedes elegir USD o completar la tasa en el panel Tasa de Cambio.' });
      return;
    }
    setLines((current) => current.map((line) => line.sourceUnitPriceUsd === null || line.unitPriceEdited
      ? line
      : { ...line, unitPrice: convertUsdPrice(line.sourceUnitPriceUsd, currency, rate), manualTotal: null }));
  }

  async function handleReferenceImage(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isAllowedLocalImage(file)) {
      setMessage({ kind: 'error', text: 'La imagen debe ser JPG, PNG, WEBP, GIF o AVIF y pesar 5 MB o menos.' });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateLine(id, { image: dataUrl, imageIsCustom: true });
      setMessage({ kind: 'success', text: 'Imagen de referencia actualizada.' });
    } catch {
      setMessage({ kind: 'error', text: 'No se pudo leer la imagen seleccionada.' });
    }
  }

  async function handleDownload() {
    setMessage(null);
    if (!settings.clientName.trim() || !settings.issueDate || !settings.quoteNumber.trim()) {
      setMessage({ kind: 'error', text: 'Completa nombre del cliente, fecha y número de presupuesto.' });
      return;
    }
    if (lines.length === 0) {
      setMessage({ kind: 'error', text: 'Agrega al menos un producto o concepto antes de descargar.' });
      return;
    }
    if (settings.currency === 'Bs' && rate <= 0) {
      setMessage({ kind: 'error', text: 'No hay una tasa de cambio válida para generar el presupuesto en Bs.' });
      return;
    }
    setIsGenerating(true);
    try {
      const logo = await imageToDataUrl(logoMark);
      const pdfLines = await Promise.all(lines.map(async (line) => {
        const calculation = calculateLine(line, settings.currency, rate);
        const image = await imageToDataUrl(line.image);
        return {
          quantity: line.quantity,
          productName: line.productName,
          category: line.category,
          sizeName: line.sizeName,
          description: line.description || (line.kind === 'custom' ? 'Concepto personalizado' : 'Producto del catálogo'),
          unitPrice: formatQuoteAmount(line.unitPrice, settings.currency),
          total: formatQuoteAmount(calculation.total, settings.currency),
          discount: calculation.discount > 0 ? formatQuoteAmount(calculation.discount, settings.currency) : '',
          image,
        };
      }));
      const data: BudgetPdfData = {
        logo,
        clientName: settings.clientName.trim(),
        rifCedula: settings.rifCedula.trim(),
        city: settings.city.trim(),
        issueDate: formatDateForPdf(settings.issueDate),
        quoteNumber: settings.quoteNumber.trim(),
        currency: settings.currency,
        exchangeRate: settings.currency === 'Bs' ? rate : null,
        lines: pdfLines,
        subtotal: formatQuoteAmount(totals.subtotal, settings.currency),
        discount: formatQuoteAmount(totals.discount, settings.currency),
        iva: formatQuoteAmount(totals.iva, settings.currency),
        total: formatQuoteAmount(totals.total, settings.currency),
        ivaEnabled: settings.ivaEnabled,
        ivaPercent: toNumber(settings.ivaPercent),
        deliveryTime: settings.deliveryTime,
        paymentMethod: settings.paymentMethod,
        advance: settings.advance,
        notes: settings.notes,
      };
      const { generateBudgetPdf } = await import('./BudgetPdf');
      const blob = await generateBudgetPdf(data);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Presupuesto-${settings.quoteNumber.trim()}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      rememberBudgetNumber(settings.quoteNumber);
      setSettings((current) => ({ ...current, quoteNumber: getSuggestedBudgetNumber() }));
      setMessage({ kind: 'success', text: 'Presupuesto descargado correctamente.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo generar el PDF.' });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Finanzas
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Crear presupuesto</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Prepara una cotización profesional y descárgala en PDF. Nada se guarda en la base de datos.</p>
        </div>
        <Button className="min-h-11" onClick={handleDownload} disabled={isGenerating || productsLoading}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
          {isGenerating ? 'Generando...' : 'Descargar PDF'}
        </Button>
      </div>

      {message ? (
        <div role="status" className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${message.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          <span>{message.text}</span>
          <button type="button" aria-label="Cerrar mensaje" onClick={() => setMessage(null)}><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
        <div className="space-y-6">
          <section className={panelClass}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h3 className="text-lg font-bold text-gray-900">Datos del cliente</h3><p className="text-sm text-gray-500">Estos datos aparecerán en la primera página.</p></div>
              <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre del cliente *" value={settings.clientName} onChange={(value) => setSettings((current) => setField(current, 'clientName', value))} placeholder="Nombre o razón social" />
              <Field label="RIF o cédula" value={settings.rifCedula} onChange={(value) => setSettings((current) => setField(current, 'rifCedula', value))} placeholder="V-00.000.000" />
              <Field label="Ciudad" value={settings.city} onChange={(value) => setSettings((current) => setField(current, 'city', value))} />
              <label className="space-y-1.5 text-sm font-semibold text-gray-700">Fecha de emisión *<Input type="date" className={inputClass} value={settings.issueDate} onChange={(event) => setSettings((current) => setField(current, 'issueDate', event.target.value))} /></label>
              <Field label="Nº de presupuesto *" value={settings.quoteNumber} onChange={(value) => setSettings((current) => setField(current, 'quoteNumber', value))} />
              <label className="space-y-1.5 text-sm font-semibold text-gray-700">Moneda *<select className={`${inputClass} w-full rounded-md px-3 text-sm font-normal`} value={settings.currency} onChange={(event) => changeCurrency(event.target.value as QuoteCurrency)}><option value="USD">USD</option><option value="Bs">Bs</option></select></label>
            </div>
            {settings.currency === 'Bs' ? <p className="mt-3 flex items-center gap-2 text-xs text-gray-500"><RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Tasa actual: {rate > 0 ? `${rate.toFixed(2)} Bs/USD` : 'no configurada'}</p> : null}
          </section>

          <section className={panelClass}>
            <div className="mb-4"><h3 className="text-lg font-bold text-gray-900">Productos del presupuesto</h3><p className="text-sm text-gray-500">Selecciona productos del catálogo o agrega un concepto personalizado.</p></div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                <div ref={productPickerRef} className="relative space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Producto del catálogo</label>
                  <button type="button" className="flex min-h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 text-left text-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setProductPickerOpen((open) => !open)} aria-expanded={productPickerOpen} aria-haspopup="listbox">
                    <span className={selectedProduct ? 'text-gray-900' : 'text-gray-500'}>{selectedProduct?.name ?? 'Selecciona un producto'}</span><ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  </button>
                  {productPickerOpen ? <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl shadow-primary/10">
                    <Input autoFocus value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar por nombre, categoría o palabra clave" className="mb-3" />
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1" role="listbox" aria-label="Productos del catálogo">
                      {groupedFilteredProducts.map(([category, categoryProducts]) => {
                        const isExpanded = Boolean(productSearch.trim()) || expandedProductCategory === category;
                        return <div key={category} className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50/70">
                          <button
                            type="button"
                            className="flex min-h-10 w-full items-center justify-between px-3 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedProductCategory(isExpanded && !productSearch.trim() ? null : category)}
                          >
                            <span>{category} <span className="ml-1 text-xs font-medium text-gray-500">{categoryProducts.length}</span></span>
                            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200${isExpanded ? ' rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                          {isExpanded && <div className="space-y-1 border-t border-gray-100 bg-white p-1.5">
                            {categoryProducts.map((product) => <button key={product.id} type="button" role="option" aria-selected={product.id === selectedProductId} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${product.id === selectedProductId ? 'bg-primary/10 text-primary' : 'text-gray-800'}`} onClick={() => { setSelectedProductId(product.id); setSelectedSizeIndex(0); setProductPickerOpen(false); setProductSearch(''); }}>
                              <img src={getProductImages(product)[0]} alt="" className="h-9 w-9 shrink-0 rounded-md bg-gray-50 object-contain" width="36" height="36" />
                              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{product.name}</span><span className="block text-xs text-gray-500">{product.sizes?.length ?? 0} tamaños{product.discountTiers?.length ? ' · Con oferta' : ''}</span></span>
                            </button>)}
                          </div>}
                        </div>;
                      })}
                      {groupedFilteredProducts.length === 0 ? <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">No se encontraron productos.</p> : null}
                    </div>
                  </div> : null}
                </div>
                <label className="space-y-1.5 text-sm font-semibold text-gray-700">Cantidad<Input type="number" min={1} className={inputClass} value={selectedQuantity} onChange={(event) => setSelectedQuantity(Math.max(1, Math.floor(toNumber(event.target.value))))} /></label>
                <Button type="button" className="min-h-10" onClick={addProductLine} disabled={!selectedProduct}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Agregar</Button>
              </div>
              {selectedProduct ? <div className="mt-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><img src={getProductImages(selectedProduct)[0]} alt="" className="h-12 w-12 rounded-lg bg-gray-50 object-contain" /><div><p className="text-sm font-semibold text-gray-900">{selectedProduct.name}</p><p className="text-xs text-gray-500">Precio base desde {formatQuoteAmount(convertUsdPrice(getProductUnitPrice(selectedProduct, selectedSizeIndex).priceUsd, settings.currency, rate), settings.currency)}</p></div></div><label className="text-sm font-semibold text-gray-700">Tamaño<select className="ml-2 rounded-md border border-gray-200 px-2 py-2 text-sm font-normal" value={selectedSizeIndex} onChange={(event) => setSelectedSizeIndex(Number(event.target.value))}>{(selectedProduct.sizes?.length ? selectedProduct.sizes : [{ name: 'Estándar', price: selectedProduct.basePrice }]).map((size, index) => <option value={index} key={`${size.name}-${index}`}>{size.name}</option>)}</select></label></div> : null}
              <button type="button" className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary hover:underline" onClick={() => setShowCustomLine((open) => !open)}>{showCustomLine ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showCustomLine ? 'Cerrar concepto personalizado' : 'Agregar concepto personalizado'}</button>
              {showCustomLine ? (
                <div className="mt-3 rounded-xl border-t border-gray-200 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.35fr)_minmax(5.5rem,0.6fr)_minmax(8rem,0.8fr)_auto] lg:items-end">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <Field label="Concepto *" value={customName} onChange={setCustomName} placeholder="Instalación, transporte..." />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <Field label="Detalle" value={customDescription} onChange={setCustomDescription} placeholder="Medidas o especificaciones" />
                    </div>
                    <Field label="Cantidad" value={String(customQuantity)} onChange={(value) => setCustomQuantity(Math.max(1, Math.floor(toNumber(value))))} type="number" />
                    <Field label={`Precio (${settings.currency})`} value={customPrice} onChange={setCustomPrice} type="number" min="0" step="0.01" />
                    <Button type="button" className="min-h-10 w-full sm:col-span-2 lg:col-span-1 lg:w-auto" onClick={addCustomLine}>Agregar</Button>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">El concepto personalizado se agrega sin descuento automático.</p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              {lines.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">Aún no hay líneas. Agrega un producto para comenzar.</div> : null}
              {lines.map((line, index) => <div key={line.id} className="space-y-2"><QuoteLineEditor line={line} index={index} currency={settings.currency} exchangeRate={rate} products={products} fileInputRefs={fileInputRefs} onImageChange={handleReferenceImage} onUpdate={updateLine} onRemove={(id) => setLines((current) => current.filter((item) => item.id !== id))} /><ReferenceImagePicker line={line} product={line.productId === null ? null : products.find((product) => product.id === line.productId) ?? null} onSelect={(image) => updateLine(line.id, { image, imageIsCustom: false })} /></div>)}
            </div>
          </section>

          <section className={panelClass}>
            <div className="mb-4"><h3 className="text-lg font-bold text-gray-900">Condiciones y notas</h3><p className="text-sm text-gray-500">Puedes modificar estos textos para cada presupuesto.</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Tiempo de entrega" value={settings.deliveryTime} onChange={(value) => setSettings((current) => setField(current, 'deliveryTime', value))} /><Field label="Forma de pago" value={settings.paymentMethod} onChange={(value) => setSettings((current) => setField(current, 'paymentMethod', value))} /><label className="space-y-1.5 text-sm font-semibold text-gray-700">Abono inicial<textarea className="min-h-20 w-full resize-y rounded-md border border-gray-200 p-3 text-sm font-normal" value={settings.advance} onChange={(event) => setSettings((current) => setField(current, 'advance', event.target.value))} /></label><label className="space-y-1.5 text-sm font-semibold text-gray-700">Notas<textarea className="min-h-20 w-full resize-y rounded-md border border-gray-200 p-3 text-sm font-normal" value={settings.notes} onChange={(event) => setSettings((current) => setField(current, 'notes', event.target.value))} /></label></div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-3"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={settings.ivaEnabled} onChange={(event) => setSettings((current) => setField(current, 'ivaEnabled', event.target.checked))} /> Incluir IVA</label>{settings.ivaEnabled ? <label className="flex items-center gap-2 text-sm text-gray-600">Porcentaje<input type="number" min="0" max="100" step="0.01" className="w-24 rounded-md border border-gray-200 px-2 py-1.5" value={settings.ivaPercent} onChange={(event) => setSettings((current) => setField(current, 'ivaPercent', Math.min(100, Math.max(0, toNumber(event.target.value)))))} />%</label> : null}</div>
          </section>
        </div>

        <QuotePreview settings={settings} lines={lines} totals={totals} rate={rate} />
      </div>
    </div>
  );
}

function ReferenceImagePicker({ line, product, onSelect }: { line: QuoteLine; product: Product | null; onSelect: (image: string) => void }) {
  const imageOptions = product ? getProductImages(product) : line.imageOptions;
  if (line.kind !== 'product' || imageOptions.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-gray-700">Diseño referencial</p>
        <span className="text-[11px] text-gray-500">{imageOptions.length === 1 ? 'Imagen del producto' : `${imageOptions.length} imágenes disponibles`}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label={`Imágenes de referencia de ${line.productName}`}>
        {imageOptions.map((image, index) => {
          const selected = line.image === image && !line.imageIsCustom;
          return (
            <button
              key={`${image}-${index}`}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={`Usar imagen ${index + 1} de ${line.productName}`}
              onClick={() => onSelect(image)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white p-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-gray-300'}`}
            >
              <img src={image} alt="" className="h-full w-full object-contain" width="64" height="64" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuoteLineEditor({ line, index, currency, exchangeRate, products, fileInputRefs, onImageChange, onUpdate, onRemove }: { line: QuoteLine; index: number; currency: QuoteCurrency; exchangeRate: number; products: Product[]; fileInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>; onImageChange: (id: string, event: ChangeEvent<HTMLInputElement>) => void; onUpdate: (id: string, update: Partial<QuoteLine>) => void; onRemove: (id: string) => void }) {
  const product = line.productId === null ? null : products.find((candidate) => candidate.id === line.productId) ?? null;
  const currentSizeIndex = product?.sizes?.findIndex((size) => size.name === line.sizeName) ?? -1;
  const calculation = calculateLine(line, currency, exchangeRate);
  const sizeOptions = product?.sizes?.length ? product.sizes : product ? [{ name: 'Estándar', price: product.basePrice }] : [];
  return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{line.productName}</p><p className="text-xs text-gray-500">{line.kind === 'custom' ? 'Concepto personalizado' : line.category}</p></div><button type="button" aria-label={`Eliminar ${line.productName}`} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => onRemove(line.id)}><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold text-gray-600">Cantidad<input type="number" min={1} className="mt-1 w-full rounded-md border border-gray-200 px-2 py-2 text-sm" value={line.quantity} onChange={(event) => { const quantity = Math.max(1, Math.floor(toNumber(event.target.value))); const discountAmountUsd = product ? getProductDiscount(product, quantity, line.sourceUnitPriceUsd ?? product.basePrice) : 0; onUpdate(line.id, { quantity, discountAmountUsd }); }} /></label>{product ? <label className="text-xs font-semibold text-gray-600">Tamaño<select className="mt-1 w-full rounded-md border border-gray-200 px-2 py-2 text-sm" value={currentSizeIndex >= 0 ? currentSizeIndex : 0} onChange={(event) => { const sizeIndex = Number(event.target.value); const size = sizeOptions[sizeIndex]; onUpdate(line.id, { sizeName: size.name, sourceUnitPriceUsd: Number(size.price), unitPrice: convertUsdPrice(Number(size.price), currency, exchangeRate), unitPriceEdited: false, discountAmountUsd: product ? getProductDiscount(product, line.quantity, Number(size.price)) : 0, manualTotal: null }); }} >{sizeOptions.map((size, sizeIndex) => <option value={sizeIndex} key={`${size.name}-${sizeIndex}`}>{size.name}</option>)}</select></label> : <div /> }<label className="text-xs font-semibold text-gray-600">Precio unitario ({currency})<input type="number" min="0" step="0.01" className="mt-1 w-full rounded-md border border-gray-200 px-2 py-2 text-sm" value={line.unitPrice} onChange={(event) => onUpdate(line.id, { unitPrice: Math.max(0, toNumber(event.target.value)), unitPriceEdited: true, manualTotal: null })} /></label><div className="rounded-lg bg-gray-50 p-2 text-sm"><span className="block text-xs text-gray-500">Total de línea</span><strong className="text-primary">{formatQuoteAmount(calculation.total, currency)}</strong></div></div>{line.discountAmountUsd > 0 ? <p className="mt-2 text-xs font-semibold text-green-700">Descuento automático aplicado: -{formatQuoteAmount(convertUsdPrice(line.discountAmountUsd, currency, exchangeRate), currency)} c/u</p> : null}<div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3"><label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={line.manualTotal !== null} onChange={(event) => onUpdate(line.id, { manualTotal: event.target.checked ? calculation.computedTotal : null })} /> Editar total manualmente</label>{line.manualTotal !== null ? <input type="number" min="0" step="0.01" className="w-32 rounded-md border border-gray-200 px-2 py-1.5 text-sm" value={line.manualTotal} onChange={(event) => onUpdate(line.id, { manualTotal: Math.max(0, toNumber(event.target.value)) })} /> : null}<button type="button" className="text-xs font-semibold text-gray-500 hover:text-primary" onClick={() => onUpdate(line.id, { manualTotal: null })}>Restablecer cálculo</button><input ref={(node) => { fileInputRefs.current[line.id] = node; }} type="file" accept="image/*" className="hidden" onChange={(event) => onImageChange(line.id, event)} /><button type="button" className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline" onClick={() => fileInputRefs.current[line.id]?.click()}><ImagePlus className="h-4 w-4" />{line.imageIsCustom ? 'Cambiar imagen' : 'Cambiar referencia'}</button></div>{line.image ? <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-50 p-2"><img src={line.image} alt="" className="h-12 w-16 rounded object-contain" /><span className="text-xs text-gray-500">La imagen aparecerá en la segunda página del PDF.</span></div> : null}</div></div></div>;
}

function QuotePreview({ settings, lines, totals, rate }: { settings: QuoteSettings; lines: QuoteLine[]; totals: ReturnType<typeof calculateTotals>; rate: number }) {
  return <aside className={`${panelClass} h-fit xl:sticky xl:top-24`}><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Vista previa</p><h3 className="mt-1 text-lg font-bold text-gray-900">Presupuesto Nº {settings.quoteNumber || '00000'}</h3></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{settings.currency}</span></div><div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4"><div className="flex items-center gap-2 border-b border-gray-200 pb-3"><img src={logoMark} alt="" className="h-8 w-8 object-contain" /><div><p className="text-xs font-bold text-primary">PUBLICIDAD EXTERIOR</p><p className="text-[10px] text-gray-500">MARACAIBO · RIF: V303101361</p></div></div><div className="grid grid-cols-2 gap-3 border-b border-gray-200 py-3 text-xs"><div><span className="block text-gray-500">Cliente</span><strong>{settings.clientName || 'Sin especificar'}</strong></div><div><span className="block text-gray-500">Fecha</span><strong>{settings.issueDate ? formatDateForPdf(settings.issueDate) : '—'}</strong></div></div>{settings.currency === 'Bs' ? <p className="border-b border-gray-200 py-2 text-xs text-gray-500">Tasa: {rate > 0 ? `${rate.toFixed(2)} Bs/USD` : 'no configurada'}</p> : null}<div className="max-h-60 overflow-y-auto py-2">{lines.length === 0 ? <p className="py-8 text-center text-xs text-gray-500">Las líneas aparecerán aquí.</p> : lines.map((line) => { const calculation = calculateLine(line, settings.currency, rate); return <div className="flex justify-between gap-3 border-b border-gray-100 py-2 text-xs last:border-0" key={line.id}><span><strong className="block">{line.quantity} × {line.productName}</strong><span className="text-gray-500">{line.sizeName || 'Personalizado'}</span></span><strong>{formatQuoteAmount(calculation.total, settings.currency)}</strong></div>; })}</div><div className="space-y-1 border-t border-gray-200 pt-3 text-xs"><div className="flex justify-between"><span>Subtotal</span><span>{formatQuoteAmount(totals.subtotal, settings.currency)}</span></div>{totals.discount > 0 ? <div className="flex justify-between text-green-700"><span>Descuento</span><span>-{formatQuoteAmount(totals.discount, settings.currency)}</span></div> : null}{settings.ivaEnabled ? <div className="flex justify-between"><span>IVA {settings.ivaPercent}%</span><span>{formatQuoteAmount(totals.iva, settings.currency)}</span></div> : null}<div className="mt-2 flex justify-between rounded-lg bg-green-100 p-2 font-bold text-green-900"><span>Total</span><span>{formatQuoteAmount(totals.total, settings.currency)}</span></div></div></div><p className="mt-3 text-xs text-gray-500">El PDF incluye una segunda página con las imágenes de referencia de cada línea.</p></aside>;
}

function Field({ label, value, onChange, placeholder, type = 'text', min, step }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; min?: string; step?: string }) {
  return <label className="space-y-1.5 text-sm font-semibold text-gray-700">{label}<Input type={type} min={min} step={step} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function getTodayForInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatDateForPdf(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}
