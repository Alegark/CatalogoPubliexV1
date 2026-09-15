import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

export function createApp(): Express {
  const app: Express = express();
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.disable("x-powered-by");
  if (isProduction) app.set("trust proxy", 1);

  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (isProduction) {
      response.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co https://*.supabase.in; form-action 'self'",
      );
    }
    next();
  });

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || !isProduction || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }));
  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: true, limit: "50kb", parameterLimit: 100 }));
  app.use("/api", router);

  const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    request.log?.error({ err: error }, "Unhandled API error");
    response.status(500).json({ error: "Error interno del servidor." });
  };
  app.use(errorHandler);

  return app;
}

export default createApp();
