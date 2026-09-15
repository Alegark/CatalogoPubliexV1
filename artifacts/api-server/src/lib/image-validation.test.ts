import assert from "node:assert/strict";
import test from "node:test";
import { validateImageBytes } from "./image-validation.ts";

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("verifica la firma binaria y no solo el MIME declarado", () => {
  assert.equal(validateImageBytes(PNG_HEADER, "image/png", "promo.png"), null);
  assert.match(
    validateImageBytes(PNG_HEADER, "image/jpeg", "promo.jpg") ?? "",
    /no coincide con el formato declarado/,
  );
});

test("rechaza un archivo SVG aunque el navegador declare un formato permitido", () => {
  const svg = new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
  assert.match(
    validateImageBytes(svg, "image/png", "promo.svg") ?? "",
    /no contiene una imagen/,
  );
});
