import type { ProductSize } from '@workspace/api-client-react';

type ProductSpecificationsProps = {
  size: ProductSize | null;
};

function formatThicknessMm(value: number) {
  const millimeters = Math.round(value * 10 * 100) / 100;
  return String(millimeters).replace('.', ',') + ' mm';
}

export function ProductSpecifications({ size }: ProductSpecificationsProps) {
  if (!size) return null;

  const rows = [
    size.measurements ? { label: 'Medidas (Alto x Ancho x Profundidad)', value: size.measurements } : null,
    size.acrylicThicknessCm !== undefined
      ? { label: 'Grosor del acr\u00edlico', value: formatThicknessMm(size.acrylicThicknessCm) }
      : null,
    size.acrylicColor ? { label: 'Color del acr\u00edlico', value: size.acrylicColor } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-4 sm:px-5"
      aria-labelledby="product-specifications-title"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="product-specifications-title" className="text-base font-bold uppercase tracking-wide text-gray-900">
          Especificaciones
        </h3>
        <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1.5 text-base font-bold text-primary">
          {size.name}
        </span>
      </div>
      <dl className="mt-3 divide-y divide-gray-200/80 border-t border-gray-200/80">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(10.5rem,42%)_minmax(0,1fr)] items-center gap-x-4 py-3 sm:grid-cols-[minmax(0,17rem)_1fr]">
            <dt className="text-sm font-semibold leading-5 text-gray-600">{row.label}</dt>
            <dd className="min-w-0 text-sm font-semibold leading-5 text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
