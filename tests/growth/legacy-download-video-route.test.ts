import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../../app/api/download-video/route";

test("legacy video download endpoint refuses caller-controlled URLs without fetching", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: unknown[] = [];
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    fetchCalls.push(args);
    return new Response("unexpected", { status: 200 });
  }) as typeof fetch;

  try {
    const response = await GET(
      new Request(
        "https://remove-anything.test/api/download-video?fileUrl=http://127.0.0.1/admin&name=secret.mp4",
      ),
    );
    assert.equal(response.status, 410);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      error: "Endpoint retired",
      code: "ENDPOINT_RETIRED",
    });
    assert.deepEqual(fetchCalls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
