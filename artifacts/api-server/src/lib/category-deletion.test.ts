import assert from "node:assert/strict";
import test from "node:test";
import { validateCategoryDeletion } from "./category-deletion.ts";

test("requires a destination when a category contains products", () => {
  assert.deepEqual(
    validateCategoryDeletion({
      categoryId: 1,
      productCount: 3,
      replacementCategoryId: null,
      replacementExists: false,
    }),
    {
      status: 400,
      message: "Selecciona una categoría destino para mover los productos.",
    },
  );
});

test("rejects the same or an unknown destination category", () => {
  assert.equal(
    validateCategoryDeletion({
      categoryId: 1,
      productCount: 1,
      replacementCategoryId: 1,
      replacementExists: true,
    })?.message,
    "La categoría destino debe ser diferente.",
  );
  assert.equal(
    validateCategoryDeletion({
      categoryId: 1,
      productCount: 1,
      replacementCategoryId: 8,
      replacementExists: false,
    })?.message,
    "La categoría destino no existe.",
  );
});

test("allows deleting an empty category without a destination", () => {
  assert.equal(
    validateCategoryDeletion({
      categoryId: 1,
      productCount: 0,
      replacementCategoryId: null,
      replacementExists: false,
    }),
    null,
  );
});
