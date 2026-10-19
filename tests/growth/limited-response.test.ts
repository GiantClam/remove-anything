import assert from "node:assert/strict";
import test from "node:test";

import {
  readLimitedResponse,
  ResultSizeLimitError,
} from "../../lib/limited-response";

test("result reads honor an exact byte limit with no declared length", async () => {
  assert.deepEqual(
    await readLimitedResponse(new Response(new Uint8Array([1, 2, 3])), 3),
    new Uint8Array([1, 2, 3]),
  );
});

test("oversized declared results are canceled without reading", async () => {
  let canceled = false;
  const response = new Response(
    new ReadableStream({
      cancel: () => {
        canceled = true;
      },
    }),
    { headers: { "content-length": "99" } },
  );
  await assert.rejects(readLimitedResponse(response, 3), ResultSizeLimitError);
  assert.equal(canceled, true);
});

test("streaming reads reject missing or dishonest Content-Length before buffering the full result", async () => {
  for (const headers of [undefined, { "content-length": "1" }]) {
    let canceled = false;
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.enqueue(new Uint8Array([3, 4]));
        },
        cancel() {
          canceled = true;
        },
      }),
      { headers },
    );
    await assert.rejects(
      readLimitedResponse(response, 3),
      ResultSizeLimitError,
    );
    assert.equal(canceled, true);
  }
});
