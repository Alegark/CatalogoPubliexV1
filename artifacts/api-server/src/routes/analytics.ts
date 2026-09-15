import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import {
  analyticsEventsTable,
  categoriesTable,
  db,
  productsTable,
} from "@workspace/db";
import {
  GetAnalyticsOverviewQueryParams,
  RecordAnalyticsEventBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";
import { createVercelAnalyticsParams } from "../lib/vercel-analytics";

const router: IRouter = Router();
const CARACAS_OFFSET = "-04:00";
const MAX_RANGE_DAYS = 31;
const eventHits = new Map<string, { count: number; resetAt: number }>();

type UnknownRecord = Record<string, unknown>;

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asRows(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter((row): row is UnknownRecord => Boolean(row && typeof row === "object"));
  if (!value || typeof value !== "object") return [];
  const record = value as UnknownRecord;
  for (const key of ["data", "rows", "results", "items"]) {
    if (Array.isArray(record[key])) return asRows(record[key]);
  }
  return [];
}

function firstString(row: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    if (typeof row[key] === "string" && row[key]) return row[key] as string;
  }
  return "";
}

function metric(row: UnknownRecord, keys: string[]): number {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return asNumber(row[key]);
  }
  return 0;
}

function datesBetween(from: string, to: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${from}T00:00:00${CARACAS_OFFSET}`);
  const end = new Date(`${to}T00:00:00${CARACAS_OFFSET}`);
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function rangeDates(from: string, to: string) {
  return {
    start: new Date(`${from}T00:00:00${CARACAS_OFFSET}`),
    end: new Date(`${to}T23:59:59.999${CARACAS_OFFSET}`),
  };
}

function validRange(from: string, to: string): boolean {
  const start = new Date(`${from}T00:00:00${CARACAS_OFFSET}`);
  const end = new Date(`${to}T23:59:59${CARACAS_OFFSET}`);
  return Number.isFinite(start.getTime())
    && Number.isFinite(end.getTime())
    && start <= end
    && (end.getTime() - start.getTime()) <= MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
}

async function queryVercel(path: string, from: string, to: string, by: string): Promise<UnknownRecord[]> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) throw new Error("VERCEL_ANALYTICS_NOT_CONFIGURED");

  const params = createVercelAnalyticsParams({
    projectId,
    teamId: process.env.VERCEL_TEAM_ID,
    from,
    to,
    by,
  });

  const response = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/${path}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    const body = await response.text();
    let detail = "";
    try {
      const payload = JSON.parse(body) as UnknownRecord;
      const error = payload.error;
      if (typeof error === "string") detail = error;
      else if (error && typeof error === "object") {
        detail = firstString(error as UnknownRecord, ["message", "code"]);
      }
      if (!detail) detail = firstString(payload, ["message", "code"]);
    } catch {
      detail = body;
    }
    const safeDetail = detail.replace(/[\r\n]+/g, " ").slice(0, 240);
    throw new Error(`VERCEL_ANALYTICS_${response.status}${safeDetail ? `: ${safeDetail}` : ""}`);
  }
  return asRows(await response.json());
}

function eventKey(request: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = request.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return value?.trim() || request.ip || "unknown";
}

function allowedEvent(request: { ip?: string; headers: Record<string, string | string[] | undefined> }): boolean {
  const now = Date.now();
  const key = eventKey(request);
  const current = eventHits.get(key);
  if (!current || current.resetAt <= now) {
    eventHits.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (current.count >= 120) return false;
  current.count += 1;
  return true;
}

router.post("/analytics/events", async (request, response): Promise<void> => {
  if (!allowedEvent(request)) {
    response.status(429).json({ error: "Demasiados eventos. Inténtalo más tarde." });
    return;
  }

  const parsed = RecordAnalyticsEventBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Evento de analítica inválido." });
    return;
  }

  const event = parsed.data;
  if (event.eventType === "add_to_cart" && !event.productId) {
    response.status(400).json({ error: "El evento de carrito requiere producto." });
    return;
  }
  if (event.eventType === "whatsapp_checkout" && (!event.itemCount || event.amountUsd === undefined)) {
    response.status(400).json({ error: "El evento de WhatsApp requiere resumen del pedido." });
    return;
  }

  let product: { id: number; slug: string; name: string; categoryName: string } | undefined;
  if (event.productId) {
    const [row] = await db
      .select({ id: productsTable.id, slug: productsTable.slug, name: productsTable.name, categoryName: categoriesTable.name })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(eq(productsTable.id, event.productId))
      .limit(1);
    product = row;
    if (!product && event.eventType === "add_to_cart") {
      response.status(400).json({ error: "Producto no encontrado." });
      return;
    }
  }

  await db.insert(analyticsEventsTable).values({
    eventType: event.eventType,
    productId: product?.id,
    productSlug: product?.slug,
    productName: product?.name,
    categoryName: product?.categoryName,
    source: event.source,
    sizeName: event.sizeName,
    quantity: event.quantity,
    itemCount: event.itemCount,
    amountUsd: event.amountUsd?.toFixed(2),
  });
  response.status(202).json({ accepted: true });
});

router.get("/analytics/overview", requireAdmin, async (request, response): Promise<void> => {
  response.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.setHeader("Pragma", "no-cache");

  const parsed = GetAnalyticsOverviewQueryParams.safeParse(request.query);
  if (!parsed.success || !validRange(parsed.data.from, parsed.data.to)) {
    response.status(400).json({ error: "El período debe ser válido y no superar 31 días." });
    return;
  }

  const { from, to } = parsed.data;
  const { start, end } = rangeDates(from, to);
  const dates = datesBetween(from, to);
  const warnings: string[] = [];

  let vercelStatus: "ok" | "unavailable" | "not_configured" = "ok";
  let trafficRows: UnknownRecord[] = [];
  let pathRows: UnknownRecord[] = [];
  let deviceRows: UnknownRecord[] = [];
  let referrerRows: UnknownRecord[] = [];
  if (!process.env.VERCEL_ANALYTICS_TOKEN || !process.env.VERCEL_PROJECT_ID) {
    vercelStatus = "not_configured";
    warnings.push("Configura VERCEL_ANALYTICS_TOKEN y VERCEL_PROJECT_ID para mostrar tráfico de Vercel.");
  } else {
    try {
      [trafficRows, pathRows, deviceRows, referrerRows] = await Promise.all([
        queryVercel("aggregate", from, to, "day"),
        queryVercel("aggregate", from, to, "requestPath"),
        queryVercel("aggregate", from, to, "deviceType"),
        queryVercel("aggregate", from, to, "referrerHostname"),
      ]);
    } catch (error) {
      vercelStatus = "unavailable";
      warnings.push("No se pudo consultar Vercel Analytics en este momento.");
      request.log?.warn({ err: error }, "Analytics provider unavailable");
    }
  }

  const daily = new Map(dates.map((date) => [date, { date, pageviews: 0, visitors: 0, addToCartClicks: 0, whatsappIntents: 0 }]));
  for (const row of trafficRows) {
    const date = firstString(row, ["timestamp", "date", "day", "period", "key"]).slice(0, 10);
    const target = daily.get(date);
    if (!target) continue;
    target.pageviews += metric(row, ["pageviews", "views", "count", "value"]);
    target.visitors += metric(row, ["visitors", "uniqueVisitors", "unique"]);
  }

  let commerceStatus: "ok" | "unavailable" = "ok";
  let eventRows: Array<typeof analyticsEventsTable.$inferSelect> = [];
  try {
    eventRows = await db.select().from(analyticsEventsTable).where(and(gte(analyticsEventsTable.occurredAt, start), lt(analyticsEventsTable.occurredAt, end)));
  } catch (error) {
    commerceStatus = "unavailable";
    warnings.push("No se pudo consultar la actividad comercial.");
    request.log?.warn({ err: error }, "Commerce analytics unavailable");
  }

  const top = new Map<string, { slug: string; name: string; views: number; addClicks: number }>();
  let addToCartClicks = 0;
  let unitsAdded = 0;
  let whatsappIntents = 0;
  let potentialValueUsd = 0;
  for (const event of eventRows) {
    const day = new Date(event.occurredAt).toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
    const target = daily.get(day);
    if (event.eventType === "add_to_cart") {
      addToCartClicks += 1;
      unitsAdded += event.quantity ?? 0;
      if (target) target.addToCartClicks += 1;
      if (event.productSlug) {
        const current = top.get(event.productSlug) ?? { slug: event.productSlug, name: event.productName ?? event.productSlug, views: 0, addClicks: 0 };
        current.addClicks += 1;
        top.set(event.productSlug, current);
      }
    } else if (event.eventType === "whatsapp_checkout") {
      whatsappIntents += 1;
      potentialValueUsd += asNumber(event.amountUsd);
      if (target) target.whatsappIntents += 1;
    }
  }

  for (const row of pathRows) {
    const path = firstString(row, ["requestPath", "path", "key"]);
    if (!path.startsWith("/producto/")) continue;
    const slug = decodeURIComponent(path.split("?")[0].replace(/\/$/, "").split("/").pop() ?? "");
    if (!slug) continue;
    const current = top.get(slug) ?? { slug, name: slug.replaceAll("-", " "), views: 0, addClicks: 0 };
    current.views += metric(row, ["pageviews", "views", "count", "value"]);
    top.set(slug, current);
  }

  const breakdown = (rows: UnknownRecord[]) => rows
    .map((row) => ({ label: firstString(row, ["deviceType", "referrerHostname", "key", "label", "valueName"]) || "Desconocido", value: metric(row, ["visitors", "pageviews", "views", "count", "value"]) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const dailyRows = [...daily.values()];
  response.json({
    range: { from, to, timezone: "America/Caracas" },
    traffic: {
      visitors: dailyRows.reduce((sum, row) => sum + row.visitors, 0),
      pageviews: dailyRows.reduce((sum, row) => sum + row.pageviews, 0),
      daily: dailyRows,
    },
    commerce: { addToCartClicks, unitsAdded, whatsappIntents, potentialValueUsd: Math.round(potentialValueUsd * 100) / 100, daily: dailyRows },
    topProducts: [...top.values()].sort((a, b) => (b.views + b.addClicks) - (a.views + a.addClicks)).slice(0, 10),
    devices: breakdown(deviceRows),
    referrers: breakdown(referrerRows),
    sourceStatus: { vercel: vercelStatus, commerce: commerceStatus },
    warnings,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
