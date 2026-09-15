import { useMemo, useState } from 'react';
import { useGetAnalyticsOverview, type AnalyticsOverview } from '@workspace/api-client-react';
import { BarChart3, Eye, MousePointerClick, RefreshCw, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type RangePreset = 'today' | '3' | '7' | '30' | 'month' | 'custom';

function dateString(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
}

function initialRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return { from: dateString(from), to: dateString(to) };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-VE').format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function MetricCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Eye; accent: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${accent}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Período</span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-gray-950">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

function ActivityChart({ data }: { data: AnalyticsOverview['traffic']['daily'] }) {
  const max = Math.max(1, ...data.map((row) => row.pageviews));
  return (
    <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
      <div className="flex h-40 items-end gap-1.5 sm:gap-2" aria-label="Actividad diaria">
        {data.map((row) => <div key={row.date} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${row.date}: ${row.pageviews} vistas`}><div className="w-full rounded-t-md bg-primary/80 transition-all group-hover:bg-primary" style={{ height: `${Math.max(4, (row.pageviews / max) * 100)}%` }} /></div>)}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400"><span>{data[0]?.date ?? ''}</span><span>{data.at(-1)?.date ?? ''}</span></div>
      <p className="mt-3 text-xs text-gray-500">Las barras representan vistas de página; los totales superiores muestran las acciones comerciales.</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: AnalyticsOverview['devices'] }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="font-bold text-gray-950">{title}</h3>
      <div className="mt-4 space-y-3">{rows.length === 0 ? <p className="text-sm text-gray-500">Sin datos disponibles.</p> : rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-4 text-sm"><span className="truncate text-gray-600">{row.label}</span><span className="font-semibold text-gray-900">{formatNumber(row.value)}</span></div>)}</div>
    </section>
  );
}

function AnalyticsContent({ data }: { data: AnalyticsOverview }) {
  const maxProduct = Math.max(1, ...data.topProducts.map((product) => product.views + product.addClicks));
  return (
    <>
      {data.warnings?.map((warning) => <p key={warning} className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{warning}</p>)}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Visitantes únicos" value={formatNumber(data.traffic.visitors)} icon={Users} accent="bg-indigo-50 text-indigo-700" />
        <MetricCard label="Vistas de página" value={formatNumber(data.traffic.pageviews)} icon={Eye} accent="bg-blue-50 text-blue-700" />
        <MetricCard label="Clics en Agregar" value={formatNumber(data.commerce.addToCartClicks)} icon={MousePointerClick} accent="bg-violet-50 text-violet-700" />
        <MetricCard label="Intentos por WhatsApp" value={formatNumber(data.commerce.whatsappIntents)} icon={Send} accent="bg-emerald-50 text-emerald-700" />
      </div>
      <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-gray-950">Actividad diaria</h3><p className="mt-1 text-sm text-gray-500">Vistas y acciones del período seleccionado.</p></div><BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" /></div><ActivityChart data={data.traffic.daily} /></section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"><h3 className="font-bold text-gray-950">Productos con mayor interés</h3><p className="mt-1 text-sm text-gray-500">Vistas de Vercel y acciones del catálogo.</p><div className="mt-4 space-y-3">{data.topProducts.length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Aún no hay actividad de productos.</p> : data.topProducts.map((product, index) => { const total = product.views + product.addClicks; return <div key={product.slug} className="rounded-xl border border-gray-100 p-3"><div className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{product.name}</p><p className="mt-0.5 text-xs text-gray-500">{formatNumber(product.views)} vistas · {formatNumber(product.addClicks)} agregados</p></div><span className="text-xs font-semibold text-primary">{Math.round((total / maxProduct) * 100)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (total / maxProduct) * 100)}%` }} /></div></div>; })}</div></section>
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"><h3 className="font-bold text-gray-950">Resumen comercial</h3><p className="mt-1 text-sm text-gray-500">Indicadores de intención, no ventas confirmadas.</p><dl className="mt-5 space-y-4"><div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3"><dt className="text-sm text-gray-600">Unidades agregadas</dt><dd className="font-bold text-gray-950">{formatNumber(data.commerce.unitsAdded)}</dd></div><div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3"><dt className="text-sm text-gray-600">Valor potencial</dt><dd className="font-bold text-gray-950">{formatUsd(data.commerce.potentialValueUsd)}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-sm text-gray-600">WhatsApp / agregar</dt><dd className="font-bold text-primary">{data.commerce.addToCartClicks ? `${Math.round((data.commerce.whatsappIntents / data.commerce.addToCartClicks) * 100)}%` : '—'}</dd></div></dl><p className="mt-5 rounded-xl bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-800">La tasa es orientativa porque no se identifica individualmente a los visitantes.</p></section>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2"><Breakdown title="Dispositivos" rows={data.devices} /><Breakdown title="Fuentes de tráfico" rows={data.referrers} /></div>
    </>
  );
}

export function AnalyticsAdmin() {
  const initial = useMemo(initialRange, []);
  const [preset, setPreset] = useState<RangePreset>('7');
  const [range, setRange] = useState(initial);
  const query = useGetAnalyticsOverview(range, { request: { cache: 'no-store' } });
  const setPresetRange = (next: RangePreset) => { const to = new Date(); const from = new Date(to); if (next === 'today') from.setDate(from.getDate()); else if (next === '3') from.setDate(from.getDate() - 2); else if (next === '7') from.setDate(from.getDate() - 6); else if (next === '30') from.setDate(from.getDate() - 29); else if (next === 'month') from.setDate(1); setPreset(next); if (next !== 'custom') setRange({ from: dateString(from), to: dateString(to) }); };
  return <div><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">Estadísticas</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-950">Actividad del catálogo</h2><p className="mt-1 text-sm text-gray-500">Visitas, productos consultados e intención de compra.</p></div><Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />Actualizar</Button></div><div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-2">{([['today', 'Hoy'], ['3', '3 días'], ['7', '7 días'], ['30', '30 días'], ['month', 'Mes actual'], ['custom', 'Personalizado']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPresetRange(value)} className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${preset === value ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-primary'}`}>{label}</button>)}{preset === 'custom' && <div className="flex w-full flex-col gap-2 border-t border-gray-200 pt-2 sm:w-auto sm:flex-row sm:border-l sm:border-t-0 sm:pl-2"><input aria-label="Desde" type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" /><input aria-label="Hasta" type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" /></div>}</div>{query.isLoading ? <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-gray-100" />)}</div> : query.isError ? <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">No se pudieron cargar las estadísticas. Revisa la sesión y vuelve a intentarlo.</div> : query.data ? <div className="mt-6"><AnalyticsContent data={query.data} /></div> : null}<p className="mt-6 text-center text-xs text-gray-400">Datos agregados y anónimos. El período máximo depende de Vercel Analytics.</p></div>;
}
