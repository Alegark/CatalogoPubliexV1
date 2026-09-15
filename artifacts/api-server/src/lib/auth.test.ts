import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "./auth.ts";

test("el hash valida la contraseña sin almacenarla en texto plano", () => {
  const hash = hashPassword("una-clave-segura", "sal-de-prueba");
  assert.equal(hash.includes("una-clave-segura"), false);
  assert.equal(verifyPassword("una-clave-segura", hash), true);
  assert.equal(verifyPassword("incorrecta", hash), false);
});

test("la sesión usa un token aleatorio y almacena solo su hash", () => {
  const token = createSessionToken();
  assert.ok(token.length >= 40);
  assert.notEqual(hashSessionToken(token), token);
  assert.equal(hashSessionToken(token), hashSessionToken(token));
});
