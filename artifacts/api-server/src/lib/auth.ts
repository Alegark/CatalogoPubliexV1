import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt, lt, sql } from "drizzle-orm";

export const ADMIN_COOKIE_NAME = "pm_admin_session";
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_USERNAME_LENGTH = 80;
export const MAX_PASSWORD_LENGTH = 256;

export interface AdminSession {
  userId: number;
  username: string;
  role: string;
  expiresAt: number;
}

export interface AuthUser {
  id: number;
  username: string;
  passwordHash: string;
  role: string;
  active: boolean;
}

export interface AuthRepository {
  findActiveAdmin(username: string): Promise<AuthUser | null>;
  findSession(tokenHash: string, now: number): Promise<AdminSession | null>;
  hasAdmin(): Promise<boolean>;
  createSession(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  getLoginAttempt(keyHash: string, now: number): Promise<{ count: number; resetAt: number } | null>;
  recordLoginFailure(keyHash: string, now: number): Promise<{ count: number; resetAt: number }>;
  clearLoginAttempts(keyHash: string): Promise<void>;
  deleteExpiredSessions(now: number): Promise<void>;
}

let repositoryOverride: AuthRepository | undefined;
let repositoryPromise: Promise<AuthRepository> | undefined;

export function setAuthRepository(repository: AuthRepository): void {
  repositoryOverride = repository;
  repositoryPromise = undefined;
}

async function getAuthRepository(): Promise<AuthRepository> {
  if (repositoryOverride) return repositoryOverride;
  repositoryPromise ??= (async () => {
    const { db, loginAttemptsTable, sessionsTable, usersTable } = await import("@workspace/db");

    return {
      async findActiveAdmin(username: string) {
        const [user] = await db
          .select({
            id: usersTable.id,
            username: usersTable.username,
            passwordHash: usersTable.passwordHash,
            role: usersTable.role,
            active: usersTable.active,
          })
          .from(usersTable)
          .where(and(
            eq(usersTable.username, username),
            eq(usersTable.role, "admin"),
            eq(usersTable.active, true),
          ))
          .limit(1);
        return user ?? null;
      },

      async findSession(tokenHash: string, now: number) {
        const [session] = await db
          .select({
            userId: usersTable.id,
            username: usersTable.username,
            role: usersTable.role,
            expiresAt: sessionsTable.expiresAt,
          })
          .from(sessionsTable)
          .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
          .where(and(
            eq(sessionsTable.tokenHash, tokenHash),
            gt(sessionsTable.expiresAt, new Date(now)),
            eq(usersTable.role, "admin"),
            eq(usersTable.active, true),
          ))
          .limit(1);

        return session
          ? { ...session, expiresAt: session.expiresAt.getTime() }
          : null;
      },

      async hasAdmin() {
        const [user] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(and(eq(usersTable.role, "admin"), eq(usersTable.active, true)))
          .limit(1);
        return Boolean(user);
      },

      async createSession(userId: number, tokenHash: string, expiresAt: Date) {
        await db.insert(sessionsTable).values({ userId, tokenHash, expiresAt });
      },

      async deleteSession(tokenHash: string) {
        await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));
      },

      async getLoginAttempt(keyHash: string, now: number) {
        const [attempt] = await db
          .select({ count: loginAttemptsTable.count, resetAt: loginAttemptsTable.resetAt })
          .from(loginAttemptsTable)
          .where(eq(loginAttemptsTable.keyHash, keyHash))
          .limit(1);
        if (!attempt) return null;
        return { count: attempt.resetAt.getTime() <= now ? 0 : attempt.count, resetAt: attempt.resetAt.getTime() };
      },

      async recordLoginFailure(keyHash: string, now: number) {
        const nowDate = new Date(now);
        const resetDate = new Date(now + LOGIN_ATTEMPT_WINDOW_MS);
        await db.delete(loginAttemptsTable).where(lt(loginAttemptsTable.resetAt, nowDate));
        const [attempt] = await db
          .insert(loginAttemptsTable)
          .values({ keyHash, count: 1, resetAt: resetDate, updatedAt: nowDate })
          .onConflictDoUpdate({
            target: loginAttemptsTable.keyHash,
            set: {
              count: sql`CASE WHEN ${loginAttemptsTable.resetAt} <= ${nowDate} THEN 1 ELSE LEAST(${loginAttemptsTable.count} + 1, ${MAX_LOGIN_ATTEMPTS}) END`,
              resetAt: sql`CASE WHEN ${loginAttemptsTable.resetAt} <= ${nowDate} THEN ${resetDate} ELSE ${loginAttemptsTable.resetAt} END`,
              updatedAt: nowDate,
            },
          })
          .returning({ count: loginAttemptsTable.count, resetAt: loginAttemptsTable.resetAt });
        return { count: attempt.count, resetAt: attempt.resetAt.getTime() };
      },

      async clearLoginAttempts(keyHash: string) {
        await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.keyHash, keyHash));
      },

      async deleteExpiredSessions(now: number) {
        await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date(now)));
      },
    } satisfies AuthRepository;
  })();
  return repositoryPromise;
}

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("base64url"),
): string {
  const digest = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, digest] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  try {
    const expected = Buffer.from(digest, "base64url");
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

const DUMMY_PASSWORD_HASH = hashPassword("invalid-login-password", "catalogo-dummy-salt");

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticateAdmin(
  username: string,
  password: string,
  now = Date.now(),
): Promise<{ token: string; username: string } | null> {
  if (username.length > MAX_USERNAME_LENGTH || password.length > MAX_PASSWORD_LENGTH) return null;
  const repository = await getAuthRepository();
  const user = await repository.findActiveAdmin(username);
  const passwordMatches = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) return null;

  const token = createSessionToken();
  await repository.createSession(
    user.id,
    hashSessionToken(token),
    new Date(now + SESSION_DURATION_MS),
  );
  return { token, username: user.username };
}

function hashLoginKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function getLoginAttempt(key: string, now = Date.now()): Promise<{ count: number; resetAt: number } | null> {
  return (await getAuthRepository()).getLoginAttempt(hashLoginKey(key), now);
}

export async function recordLoginFailure(key: string, now = Date.now()): Promise<{ count: number; resetAt: number }> {
  return (await getAuthRepository()).recordLoginFailure(hashLoginKey(key), now);
}

export async function clearLoginAttempts(key: string): Promise<void> {
  await (await getAuthRepository()).clearLoginAttempts(hashLoginKey(key));
}

export async function isAdminConfigured(): Promise<boolean> {
  return (await getAuthRepository()).hasAdmin();
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const key = entry.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function getAdminSession(request: Request): Promise<AdminSession | null> {
  const token = readCookie(request, ADMIN_COOKIE_NAME);
  if (!token) return null;
  const repository = await getAuthRepository();
  const now = Date.now();
  await repository.deleteExpiredSessions(now);
  return repository.findSession(hashSessionToken(token), now);
}

export async function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!(await isAdminConfigured())) {
      response.status(503).json({ error: "Administración no configurada" });
      return;
    }
    if (!(await getAdminSession(request))) {
      response.status(401).json({ error: "Autenticación requerida" });
      return;
    }
    next();
  } catch {
    response.status(503).json({ error: "Servicio de autenticación no disponible" });
  }
}

export async function logoutAdmin(request: Request): Promise<void> {
  const token = readCookie(request, ADMIN_COOKIE_NAME);
  if (token) await (await getAuthRepository()).deleteSession(hashSessionToken(token));
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DURATION_MS,
  };
}
