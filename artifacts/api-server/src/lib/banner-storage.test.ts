import assert from "node:assert/strict";
import test from "node:test";
import {
  getBannerImageUrl,
  getBannerValidationError,
  removeBannerImage,
  uploadBannerImage,
} from "./banner-storage.ts";

test("accepts supported banner images under the size limit", () => {
  const file = new File([new Uint8Array([1])], "promo.webp", { type: "image/webp" });
  assert.equal(getBannerValidationError(file), null);
});

test("rejects unsupported banner formats", () => {
  const file = new File([new Uint8Array([1])], "promo.svg", { type: "image/svg+xml" });
  assert.match(getBannerValidationError(file) ?? "", /no es una imagen compatible/);
});

test("rejects banners larger than 5 MB", () => {
  const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "promo.png", { type: "image/png" });
  assert.match(getBannerValidationError(file) ?? "", /supera el l/);
});

test("uses local storage for banner uploads during development", async () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  try {
    process.env.NODE_ENV = "development";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const stored = await uploadBannerImage(
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "promo.png", { type: "image/png" }),
    );

    assert.match(stored.storagePath, /^local-banners\/[0-9a-f-]+\.png$/);
    assert.equal(getBannerImageUrl(stored.storagePath), stored.url);
    await removeBannerImage(stored.storagePath);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.supabaseUrl;
    if (previous.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.serviceRoleKey;
  }
});
