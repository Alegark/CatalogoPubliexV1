import assert from "node:assert/strict";
import test from "node:test";
import { countAdminProductsByCategory, filterAdminProducts } from "./admin-product-filters.ts";

const products = [
  { id: 1, name: "Porta Tarjetas Acrílico", slug: "porta-tarjetas-acrilico", category: "Exhibidores", keywords: ["tarjetero", "celular"] },
  { id: 2, name: "Hablador Tipo L", slug: "hablador-l", category: "Habladores", keywords: [] },
  { id: 3, name: "Cubos Acrílicos", slug: "cubos-acrilicos", category: "Decoración", keywords: ["exhibidor"] },
];

test("filters admin products across name, slug, category and keywords", () => {
  assert.deepEqual(filterAdminProducts(products, "tarjetero", "" ).map(({ id }) => id), [1]);
  assert.deepEqual(filterAdminProducts(products, "ACRILICO", "").map(({ id }) => id), [1, 3]);
  assert.deepEqual(filterAdminProducts(products, "", "habladores").map(({ id }) => id), [2]);
  assert.deepEqual(filterAdminProducts(products, "porta celular", "").map(({ id }) => id), [1]);
});

test("counts products by category for the filter list", () => {
  assert.deepEqual([...countAdminProductsByCategory(products)], [
    ["Exhibidores", 1],
    ["Habladores", 1],
    ["Decoración", 1],
  ]);
});
