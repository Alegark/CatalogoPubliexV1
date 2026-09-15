import assert from "node:assert/strict";
import test from "node:test";
import {
  createVercelAnalyticsParams,
  VERCEL_ANALYTICS_RESULT_LIMIT,
} from "./vercel-analytics.ts";

test("Vercel Analytics aggregate queries respect the API result limit", () => {
  const params = createVercelAnalyticsParams({
    projectId: "prj_example",
    teamId: "team_example",
    from: "2026-07-30",
    to: "2026-08-05",
    by: "day",
  });

  assert.equal(VERCEL_ANALYTICS_RESULT_LIMIT, 100);
  assert.equal(params.get("limit"), "100");
  assert.equal(params.get("by"), "day");
  assert.equal(params.get("teamId"), "team_example");
});
