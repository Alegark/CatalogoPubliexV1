import { Router, type IRouter } from "express";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  authenticateAdmin,
  clearLoginAttempts,
  getLoginAttempt,
  getAdminSession,
  isAdminConfigured,
  logoutAdmin,
  MAX_LOGIN_ATTEMPTS,
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  recordLoginFailure,
} from "../lib/auth.ts";

const router: IRouter = Router();

router.get("/auth/session", async (request, response): Promise<void> => {
  try {
    const [configured, session] = await Promise.all([
      isAdminConfigured(),
      getAdminSession(request),
    ]);
    response.json({
      authenticated: Boolean(session),
      configured,
      username: session?.username,
    });
  } catch {
    response.status(503).json({ error: "Servicio de autenticación no disponible" });
  }
});

router.post("/auth/login", async (request, response): Promise<void> => {
  try {
    if (!(await isAdminConfigured())) {
      response.status(503).json({ error: "Administración no configurada" });
      return;
    }

    const username = typeof request.body?.username === "string"
      ? request.body.username.trim()
      : "";
    const password = typeof request.body?.password === "string"
      ? request.body.password
      : "";
    if (!username || username.length > MAX_USERNAME_LENGTH || !password || password.length > MAX_PASSWORD_LENGTH) {
      response.status(400).json({ error: "Los datos de acceso no son válidos." });
      return;
    }

    const key = request.ip || request.socket.remoteAddress || "unknown";
    const attempt = await getLoginAttempt(key);
    if (attempt && attempt.count >= MAX_LOGIN_ATTEMPTS) {
      response
        .status(429)
        .setHeader("Retry-After", Math.max(1, Math.ceil((attempt.resetAt - Date.now()) / 1000)))
        .json({ error: "Demasiados intentos. Inténtalo más tarde." });
      return;
    }

    const result = await authenticateAdmin(username, password);
    if (!result) {
      await recordLoginFailure(key);
      response.status(401).json({ error: "Credenciales inválidas" });
      return;
    }

    await clearLoginAttempts(key);
    response.cookie(ADMIN_COOKIE_NAME, result.token, adminCookieOptions());
    response.json({ authenticated: true, configured: true, username: result.username });
  } catch {
    response.status(503).json({ error: "Servicio de autenticación no disponible" });
  }
});

router.post("/auth/logout", async (request, response): Promise<void> => {
  try {
    await logoutAdmin(request);
  } finally {
    response.clearCookie(ADMIN_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    response.sendStatus(204);
  }
});

export default router;
