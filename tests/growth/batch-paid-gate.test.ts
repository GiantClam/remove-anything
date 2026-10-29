import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { batchRouteState } from "../support/batch-route-stubs";
import { isPaidToolEnabled } from "../../lib/tool-registry";

test("batch-remove-background paid gate is open after cost approval", () => {
  assert.equal(isPaidToolEnabled("batch-remove-background"), true);
});

test("batch route proceeds past the paid gate and rate-limits before provider work", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    throw new Error("Paid gate allowed an unexpected network call");
  };
  try {
    const { POST } = await import("../../app/api/batch-remove-background/route");
    const response = await POST(new NextRequest("https://remove-anything.test/api/batch-remove-background", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageUrls: ["https://images.example.test/input.png"] }),
    }));

    // Authenticated stub user + paidEnabled: true → past 402 gate.
    // Invalid/unreachable URL HEAD or later work may fail; must not be PAID_OUTPUT_UNAVAILABLE.
    assert.notEqual(response.status, 402);
    const body = await response.json().catch(() => ({}));
    assert.notEqual(body.code, "PAID_OUTPUT_UNAVAILABLE");
    assert.ok(batchRouteState.rateLimitCalls >= 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
