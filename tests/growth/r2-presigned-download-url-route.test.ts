import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../app/api/r2-presigned-download-url/route";

test("legacy R2 download signer refuses arbitrary keys without returning a signed URL", async () => {
  const response = await POST(
    new Request("https://remove-anything.test/api/r2-presigned-download-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "private/user/another-users-result.png" }),
    }),
  );
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.deepEqual(body, {
    error: "Endpoint retired",
    code: "ENDPOINT_RETIRED",
  });
  assert.equal("downloadUrl" in body, false);
});
