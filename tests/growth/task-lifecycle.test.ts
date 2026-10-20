import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

(process.env as unknown as Record<string, string>).NODE_ENV = "test";
process.env.ANONYMOUS_PRINCIPAL_SECRET = "unit-test-principal-secret";

const counts = {
  backgroundRemovalTask: 0,
  watermarkRemovalTask: 0,
  objectRemovalTask: 0,
  taskData: 0,
};

const prismaFake = {
  backgroundRemovalTask: { count: async () => counts.backgroundRemovalTask },
  watermarkRemovalTask: { count: async () => counts.watermarkRemovalTask },
  objectRemovalTask: { count: async () => counts.objectRemovalTask },
  taskData: { count: async () => counts.taskData },
};
(globalThis as typeof globalThis & { __TEST_PRISMA__?: unknown }).__TEST_PRISMA__ = prismaFake;

const lifecyclePromise = import("../../lib/task-lifecycle");

test("anonymous principals are signed, opaque, and reject tampering", async () => {
  const { createAnonymousPrincipal, verifyAnonymousPrincipal } = await lifecyclePromise;
  const token = createAnonymousPrincipal();
  const subject = verifyAnonymousPrincipal(token);

  assert.ok(subject);
  assert.match(subject!, /^[0-9a-f-]{36}$/);
  assert.equal(verifyAnonymousPrincipal(`${token}tampered`), null);
  assert.equal(verifyAnonymousPrincipal("not-a-token"), null);
});

test("expired principal payloads are rejected", async () => {
  const { verifyAnonymousPrincipal } = await lifecyclePromise;
  const payload = Buffer.from(JSON.stringify({ sub: "expired-sub", exp: Date.now() - 1 }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.ANONYMOUS_PRINCIPAL_SECRET!).update(payload).digest("base64url");

  assert.equal(verifyAnonymousPrincipal(`${payload}.${signature}`), null);
});

test("status normalization and expiry provide one shared task contract", async () => {
  const { isTaskExpired, normalizeTaskStatus, taskExpiresAt, TASK_RESULT_TTL_MS } = await lifecyclePromise;
  assert.equal(normalizeTaskStatus("PENDING"), "queued");
  assert.equal(normalizeTaskStatus("RUNNING"), "processing");
  assert.equal(normalizeTaskStatus("SUCCESS"), "succeeded");
  assert.equal(normalizeTaskStatus("timeout"), "expired");
  assert.equal(normalizeTaskStatus("provider-broke"), "failed");

  const createdAt = new Date(Date.now() - TASK_RESULT_TTL_MS - 1);
  assert.equal(taskExpiresAt(createdAt).getTime(), createdAt.getTime() + TASK_RESULT_TTL_MS);
  assert.equal(isTaskExpired({ createdAt }), true);
  assert.equal(isTaskExpired({ expiresAt: new Date(Date.now() + 60_000) }), false);
});

test("quota counts active image work and rejects a second anonymous task", async () => {
  const { enforceImageTaskQuota, TaskLifecycleError, AUTHENTICATED_MONTHLY_TASK_LIMIT } = await lifecyclePromise;
  counts.backgroundRemovalTask = 0;
  counts.watermarkRemovalTask = 0;
  counts.objectRemovalTask = 0;
  counts.taskData = 0;

  assert.deepEqual(
    await enforceImageTaskQuota({ userId: null, principalId: "anon-1" }),
    { limit: 1, used: 0 },
  );

  counts.backgroundRemovalTask = 1;
  await assert.rejects(
    enforceImageTaskQuota({ userId: null, principalId: "anon-1" }),
    (error: unknown) => error instanceof TaskLifecycleError && error.code === "QUOTA_EXCEEDED" && error.status === 429,
  );

  counts.backgroundRemovalTask = 2;
  counts.watermarkRemovalTask = 1;
  counts.objectRemovalTask = 1;
  counts.taskData = 0;
  assert.equal(
    (await enforceImageTaskQuota({ userId: "user-1", principalId: null })).used,
    AUTHENTICATED_MONTHLY_TASK_LIMIT - 1,
  );
  counts.taskData = 1;
  await assert.rejects(
    enforceImageTaskQuota({ userId: "user-1", principalId: null }),
    /Monthly image task quota exceeded/,
  );
});

test("downloads require success, ownership, and a non-expired result", async () => {
  const { assertTaskDownloadAccess, TaskLifecycleError } = await lifecyclePromise;
  const task = {
    taskStatus: "succeeded",
    principalId: "anon-1",
    outputImageUrl: "https://example.com/result.png",
    expiresAt: new Date(Date.now() + 60_000),
  };
  assert.doesNotThrow(() => assertTaskDownloadAccess(task, { userId: null, principalId: "anon-1" }));
  await assert.rejects(
    async () => assertTaskDownloadAccess(task, { userId: null, principalId: "other" }),
    (error: unknown) => error instanceof TaskLifecycleError && error.status === 403,
  );
  await assert.rejects(
    async () => assertTaskDownloadAccess({ ...task, expiresAt: new Date(Date.now() - 1) }, { userId: null, principalId: "anon-1" }),
    (error: unknown) => error instanceof TaskLifecycleError && error.status === 410,
  );
});

test("signing in preserves access to the browser's anonymous task", async () => {
  const {
    ANONYMOUS_PRINCIPAL_COOKIE,
    assertTaskDownloadAccess,
    assertTaskOwnership,
    createAnonymousPrincipal,
    getTaskPrincipalFromRequest,
    verifyAnonymousPrincipal,
  } = await lifecyclePromise;
  const token = createAnonymousPrincipal();
  const request = new Request("https://remove-anything.test/api/download-background", {
    headers: { cookie: `session=authenticated; ${ANONYMOUS_PRINCIPAL_COOKIE}=${token}` },
  });
  const task = {
    userId: null,
    principalId: verifyAnonymousPrincipal(token),
    taskStatus: "succeeded",
    outputImageUrl: "https://example.com/result.png",
    expiresAt: new Date(Date.now() + 60_000),
  };

  const anonymous = getTaskPrincipalFromRequest(request, null);
  const signedIn = getTaskPrincipalFromRequest(request, "signed-in-user");
  assert.equal(signedIn.userId, "signed-in-user");
  assert.equal(signedIn.principalId, anonymous.principalId);
  assert.doesNotThrow(() => assertTaskOwnership(task, signedIn));
  assert.doesNotThrow(() => assertTaskDownloadAccess(task, signedIn));
});

test("a signed-in session cannot substitute for the original anonymous cookie", async () => {
  const {
    ANONYMOUS_PRINCIPAL_COOKIE,
    assertTaskDownloadAccess,
    createAnonymousPrincipal,
    getTaskPrincipalFromRequest,
    TaskLifecycleError,
    verifyAnonymousPrincipal,
  } = await lifecyclePromise;
  const originalToken = createAnonymousPrincipal();
  const task = {
    userId: null,
    principalId: verifyAnonymousPrincipal(originalToken),
    taskStatus: "succeeded",
    outputImageUrl: "https://example.com/result.png",
    expiresAt: new Date(Date.now() + 60_000),
  };

  for (const token of [null, createAnonymousPrincipal(), `${originalToken}tampered`]) {
    const request = new Request("https://remove-anything.test/api/download-background", {
      headers: token ? { cookie: `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}` } : {},
    });
    assert.throws(
      () => assertTaskDownloadAccess(task, getTaskPrincipalFromRequest(request, "signed-in-user")),
      (error: unknown) => error instanceof TaskLifecycleError && error.status === 403,
    );
  }
});

test("anonymous continuity does not override account ownership or result expiry", async () => {
  const {
    ANONYMOUS_PRINCIPAL_COOKIE,
    assertTaskDownloadAccess,
    createAnonymousPrincipal,
    getTaskPrincipalFromRequest,
    TaskLifecycleError,
    verifyAnonymousPrincipal,
  } = await lifecyclePromise;
  const token = createAnonymousPrincipal();
  const request = new Request("https://remove-anything.test/api/download-background", {
    headers: { cookie: `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}` },
  });
  const principal = getTaskPrincipalFromRequest(request, "different-user");
  const task = {
    userId: "task-owner",
    principalId: verifyAnonymousPrincipal(token),
    taskStatus: "succeeded",
    outputImageUrl: "https://example.com/result.png",
    expiresAt: new Date(Date.now() + 60_000),
  };

  assert.throws(
    () => assertTaskDownloadAccess(task, principal),
    (error: unknown) => error instanceof TaskLifecycleError && error.status === 403,
  );
  assert.throws(
    () => assertTaskDownloadAccess({ ...task, userId: null, expiresAt: new Date(Date.now() - 1) }, principal),
    (error: unknown) => error instanceof TaskLifecycleError && error.status === 410,
  );
});

test("automatic retries stop after one attempt and anonymous work cannot receive credits", async () => {
  const { canRetryAutomatically, refundFailedTaskCredit } = await lifecyclePromise;
  assert.equal(canRetryAutomatically(0), true);
  assert.equal(canRetryAutomatically(1), false);
  assert.equal(canRetryAutomatically(2), false);

  assert.equal(await refundFailedTaskCredit(null, 17, "image"), false);
});
