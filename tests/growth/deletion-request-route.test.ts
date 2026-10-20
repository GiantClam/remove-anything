import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  resetDeletionRequestState,
  deletionRequestState as state,
} from "../support/deletion-request-stubs";

const routePromise = import("../../app/api/privacy/deletion-request/route");

beforeEach(resetDeletionRequestState);

function request(
  body: unknown,
  options: { malformed?: boolean; oversized?: boolean } = {},
) {
  return new NextRequest(
    "https://remove-anything.test/api/privacy/deletion-request",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "192.0.2.45",
        ...(options.oversized ? { "content-length": "9000" } : {}),
      },
      body: options.malformed ? "{" : JSON.stringify(body),
    },
  );
}

const validBody = {
  email: "owner@example.test",
  taskType: "object",
  taskId: "task_123",
  details: "Please remove this result.",
};

test("valid early deletion requests are emailed for human review without invoking deletion", async () => {
  const { POST } = await routePromise;
  const response = await POST(request(validBody));
  const result = await response.json();

  assert.equal(response.status, 202);
  assert.equal(result.success, true);
  assert.match(result.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(state.sentEmails.length, 1);
  assert.equal(state.sentEmails[0].reply_to, validBody.email);
  assert.match(String(state.sentEmails[0].text), /No data was deleted/);
  assert.deepEqual(state.limitIdentifiers, [
    "deletion-request:0d567e03017b5f307d59f726",
  ]);
});

test("invalid payloads are rejected before sending an email", async () => {
  const { POST } = await routePromise;
  for (const body of [
    { ...validBody, email: "not-an-email" },
    { ...validBody, taskId: "bad/task/id" },
    { ...validBody, extra: "unexpected" },
  ]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
  }
  assert.equal((await POST(request(null, { malformed: true }))).status, 400);
  assert.equal(state.sentEmails.length, 0);
});

test("oversized and rate-limited requests stop before parsing or sending", async () => {
  const { POST } = await routePromise;
  assert.equal(
    (await POST(request(validBody, { oversized: true }))).status,
    413,
  );
  state.limitSuccess = false;
  assert.equal((await POST(request(validBody))).status, 429);
  assert.equal(state.sentEmails.length, 0);
});

test("honeypot requests receive a generic acknowledgment without sending email", async () => {
  const { POST } = await routePromise;
  const response = await POST(request({ ...validBody, website: "spam" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    requestId: "received",
  });
  assert.equal(state.sentEmails.length, 0);
});

test("missing intake configuration and email delivery failures are retryable", async () => {
  const { POST } = await routePromise;
  state.configured = false;
  assert.equal((await POST(request(validBody))).status, 503);
  state.configured = true;
  state.sendError = true;
  assert.equal((await POST(request(validBody))).status, 503);
});
