import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import authRouter from "./auth.ts";
import {
  hashPassword,
  hashSessionToken,
  requireAdmin,
  setAuthRepository,
  type AuthRepository,
  type AdminSession,
} from "../lib/auth.ts";

const users = new Map([
  ["test-admin", {
    id: 1,
    username: "test-admin",
    passwordHash: hashPassword("clave-de-prueba", "sal-http"),
    role: "admin",
    active: true,
  }],
]);
const sessions = new Map<string, AdminSession>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const repository: AuthRepository = {
  async findActiveAdmin(username) {
    return users.get(username) ?? null;
  },
  async findSession(tokenHash, now) {
    const session = sessions.get(tokenHash);
    return session && session.expiresAt > now ? session : null;
  },
  async hasAdmin() {
    return users.size > 0;
  },
  async createSession(userId, tokenHash, expiresAt) {
    const user = [...users.values()].find((candidate) => candidate.id === userId);
    assert.ok(user);
    sessions.set(tokenHash, {
      userId,
      username: user.username,
      role: user.role,
      expiresAt: expiresAt.getTime(),
    });
  },
  async deleteSession(tokenHash) {
    sessions.delete(tokenHash);
  },
  async getLoginAttempt(keyHash, now) {
    const attempt = loginAttempts.get(keyHash);
    return attempt && attempt.resetAt > now ? attempt : null;
  },
  async recordLoginFailure(keyHash, now) {
    const current = loginAttempts.get(keyHash);
    const next = current && current.resetAt > now
      ? { count: Math.min(current.count + 1, 5), resetAt: current.resetAt }
      : { count: 1, resetAt: now + 15 * 60 * 1000 };
    loginAttempts.set(keyHash, next);
    return next;
  },
  async clearLoginAttempts(keyHash) {
    loginAttempts.delete(keyHash);
  },
  async deleteExpiredSessions(now) {
    for (const [tokenHash, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(tokenHash);
    }
  },
};

setAuthRepository(repository);

const app = express();
app.use(express.json());
app.use("/api", authRouter);
app.get("/api/protected", requireAdmin, (_request, response) => {
  response.json({ ok: true });
});

const server = app.listen(0, "127.0.0.1");
let baseUrl = "";

before(async () => {
  await new Promise<void>((resolve) => {
    if (server.listening) resolve();
    else server.once("listening", resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("bloquea acceso administrativo sin sesión", async () => {
  const response = await fetch(`${baseUrl}/protected`);
  assert.equal(response.status, 401);
});

test("rechaza credenciales inválidas con un mensaje genérico", async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "incorrecta" }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Credenciales inválidas" });
});

test("rechaza credenciales demasiado largas antes de ejecutar scrypt", async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "a".repeat(81), password: "b".repeat(257) }),
  });
  assert.equal(response.status, 400);
});

test("crea cookie HttpOnly, reconoce la sesión y permite cerrarla", async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "clave-de-prueba" }),
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /pm_admin_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(";")[0];

  const session = await fetch(`${baseUrl}/auth/session`, { headers: { cookie } });
  assert.equal((await session.json() as { authenticated: boolean }).authenticated, true);

  const protectedResponse = await fetch(`${baseUrl}/protected`, { headers: { cookie } });
  assert.equal(protectedResponse.status, 200);

  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie") ?? "", /pm_admin_session=;/);
  assert.equal(sessions.has(hashSessionToken(cookie.split("=")[1])), false);
});
