import { Router, type IRouter } from "express";
import { db, exchangeRateTable } from "@workspace/db";
import { UpdateExchangeRateBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();
const EXCHANGE_RATE_KEY = "default";
const DEFAULT_EXCHANGE_RATE = "36.50";

// GET /exchange-rate
router.get("/exchange-rate", async (_req, res): Promise<void> => {
  await db
    .insert(exchangeRateTable)
    .values({ key: EXCHANGE_RATE_KEY, usdToBs: DEFAULT_EXCHANGE_RATE })
    .onConflictDoNothing({ target: exchangeRateTable.key });
  const [rate] = await db
    .select()
    .from(exchangeRateTable)
    .where(eq(exchangeRateTable.key, EXCHANGE_RATE_KEY))
    .limit(1);

  if (!rate) {
    res.status(503).json({ error: "La tasa de cambio no está disponible." });
    return;
  }

  res.json({
    ...rate,
    usdToBs: parseFloat(rate.usdToBs),
  });
});

// PUT /exchange-rate
router.put("/exchange-rate", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateExchangeRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rate] = await db
    .insert(exchangeRateTable)
    .values({ key: EXCHANGE_RATE_KEY, usdToBs: String(parsed.data.usdToBs) })
    .onConflictDoUpdate({
      target: exchangeRateTable.key,
      set: { usdToBs: String(parsed.data.usdToBs), updatedAt: new Date() },
    })
    .returning();

  if (!rate) {
    res.status(503).json({ error: "La tasa de cambio no está disponible." });
    return;
  }

  res.json({
    ...rate,
    usdToBs: parseFloat(rate.usdToBs),
  });
});

export default router;
