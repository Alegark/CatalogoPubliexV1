import test from "node:test";
import assert from "node:assert/strict";
import { categorySlug } from "./category-utils.ts";

test("categorySlug normaliza acentos, espacios y signos", () => {
  assert.equal(categorySlug("  Exhibidores y Decoración  "), "exhibidores-y-decoracion");
});

test("categorySlug evita guiones sobrantes", () => {
  assert.equal(categorySlug("--Habladores--"), "habladores");
});
