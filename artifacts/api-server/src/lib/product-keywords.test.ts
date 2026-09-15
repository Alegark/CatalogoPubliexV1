import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectProductKeywords,
  normalizeProductKeywords,
  removeProductKeyword,
} from "./product-keywords.ts";

describe("product keywords", () => {
  it("trims and deduplicates keywords without case-sensitive duplicates", () => {
    assert.deepEqual(normalizeProductKeywords([" Exhibidor ", "exhibidor", "celular", "", 42]), [
      "Exhibidor",
      "celular",
    ]);
  });

  it("limits collected suggestions and filters them", () => {
    assert.deepEqual(collectProductKeywords(["Celular", "exhibidor", "celular", "Porta tarjetas"], "cel"), [
      "Celular",
    ]);
    assert.deepEqual(collectProductKeywords(["Zeta", "Ángulo", "Alfa"]), ["Alfa", "Ángulo", "Zeta"]);
  });

  it("removes a keyword regardless of capitalization", () => {
    assert.deepEqual(removeProductKeyword(["Celular", "exhibidor", "celular"], "CELULAR"), ["exhibidor"]);
    assert.deepEqual(removeProductKeyword(["Celular"], " Celular "), []);
  });
});
