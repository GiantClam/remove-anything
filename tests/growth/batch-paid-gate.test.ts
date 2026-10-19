import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { batchRouteState } from "../support/batch-route-stubs";

test("batch route returns a stable paid gate before provider, credit, storage, or network work", async () => {
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

    assert.equal(response.status, 402);
    assert.equal((await response.json()).code, "PAID_OUTPUT_UNAVAILABLE");
    assert.equal(fetchCalls, 0);
    assert.deepEqual(batchRouteState, {
      providerCalls: 0,
      creditReads: 0,
      taskCreates: 0,
      transactionCalls: 0,
      rateLimitCalls: 0,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
