import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import categoriesRouter from "./categories";
import bannersRouter from "./banners";
import exchangeRateRouter from "./exchange-rate";
import authRouter from "./auth";
import uploadsRouter from "./uploads";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(categoriesRouter);
router.use(bannersRouter);
router.use(exchangeRateRouter);
router.use(authRouter);
router.use(uploadsRouter);
router.use(analyticsRouter);

export default router;
