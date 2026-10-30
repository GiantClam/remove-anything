import assert from "node:assert/strict";
import test from "node:test";

const retentionPromise = import("../../lib/task-retention");
type AnyRecord = Record<string, any>;
type RetentionRows = Record<
  | "taskData"
  | "backgroundRemovalTask"
  | "watermarkRemovalTask"
  | "objectRemovalTask",
  AnyRecord[]
>;
const NOW = new Date("2026-10-15T00:00:00.000Z");
const OLD = new Date("2026-06-01T00:00:00.000Z");
const BASE = "https://r2.example.test";

function matchValue(value: any, filter: any): boolean {
  if (filter === null) return value == null;
  if (filter instanceof Date)
    return new Date(value).getTime() === filter.getTime();
  if (typeof filter !== "object") return value === filter;
  if ("none" in filter && Array.isArray(value) && value.length > 0)
    return false;
  if ("some" in filter && (!Array.isArray(value) || value.length === 0))
    return false;
  if ("in" in filter && !filter.in.includes(value)) return false;
  if ("notIn" in filter && filter.notIn.includes(value)) return false;
  if ("not" in filter && matchValue(value, filter.not)) return false;
  if (
    "lte" in filter &&
    !(
      value != null &&
      new Date(value).getTime() <= new Date(filter.lte).getTime()
    )
  )
    return false;
  if (
    "startsWith" in filter &&
    !(typeof value === "string" && value.startsWith(filter.startsWith))
  )
    return false;
  if ("has" in filter && !(Array.isArray(value) && value.includes(filter.has)))
    return false;
  return true;
}
function matches(row: AnyRecord, where: AnyRecord = {}): boolean {
  return Object.entries(where).every(([field, filter]) =>
    field === "OR"
      ? (filter as AnyRecord[]).some((part) => matches(row, part))
      : matchValue(row[field], filter),
  );
}
function emptyRows(): RetentionRows {
  return {
    taskData: [],
    backgroundRemovalTask: [],
    watermarkRemovalTask: [],
    objectRemovalTask: [],
  };
}
function makeDb(rows: RetentionRows, calls: AnyRecord[]) {
  const db: Record<string, any> = Object.fromEntries(
    Object.keys(rows).map((model) => [
      model,
      {
        findMany: async (args: AnyRecord) => {
          let selected = rows[model].filter((row: AnyRecord) =>
            matches(row, args.where),
          );
          if (Array.isArray(args.orderBy))
            selected = selected.sort(
              (a: AnyRecord, b: AnyRecord) =>
                (a.retentionCheckedAt
                  ? new Date(a.retentionCheckedAt).getTime()
                  : -Infinity) -
                  (b.retentionCheckedAt
                    ? new Date(b.retentionCheckedAt).getTime()
                    : -Infinity) || Number(a.id) - Number(b.id),
            );
          return selected
            .slice(0, args.take)
            .map((row: AnyRecord) => ({ ...row }));
        },
        update: async (args: AnyRecord) => {
          calls.push({ op: "update", model, args });
          const row = rows[model].find(
            (row: AnyRecord) => row.id === args.where.id,
          );
          if (row) Object.assign(row, args.data);
          return row;
        },
        deleteMany: async (args: AnyRecord) => {
          calls.push({ op: "deleteMany", model, args });
          const deleted = rows[model].filter((row: AnyRecord) =>
            matches(row, args.where),
          );
          rows[model] = rows[model].filter(
            (row: AnyRecord) => !matches(row, args.where),
          );
          return { count: deleted.length };
        },
        count: async (args: AnyRecord) =>
          rows[model].filter((row: AnyRecord) => matches(row, args.where))
            .length,
      },
    ]),
  );
  for (const model of [
    "backgroundComposition",
    "backgroundImage",
    "media",
    "user",
  ])
    db[model] = { count: async () => 0 };
  db.userBilling = {
    findMany: async (args: AnyRecord) => {
      const taskIds = args.where.taskId.in as number[];
      return rows.taskData.flatMap((row: AnyRecord) =>
        taskIds.includes(row.id)
          ? (row.userBillings || []).map(() => ({ taskId: row.id }))
          : [],
      );
    },
  };
  return db as any;
}
function dueTask(id: number, overrides: AnyRecord = {}) {
  return {
    id,
    createdAt: OLD,
    expiresAt: new Date(OLD.getTime() + 24 * 60 * 60 * 1000),
    taskStatus: "succeeded",
    ...overrides,
  };
}

test("R2 parsing requires exact origin and path prefix and rejects ambiguous keys", async () => {
  const { parseConfiguredR2Key } = await retentionPromise;
  assert.equal(
    parseConfiguredR2Key(
      `${BASE}/tasks/a%20b.png?download=1#preview`,
      `${BASE}/tasks`,
    ),
    "a b.png",
  );
  assert.equal(
    parseConfiguredR2Key(`${BASE}/tasks/nested/a.png`, `${BASE}/tasks/`),
    "nested/a.png",
  );
  for (const url of [
    `${BASE}.evil.test/tasks/a.png`,
    "http://r2.example.test/tasks/a.png",
    `${BASE}/tasks-other/a.png`,
    `${BASE}/tasks`,
    `${BASE}/tasks/`,
    `${BASE}/tasks/a/../b.png`,
    `${BASE}/tasks/%2e%2e/a.png`,
    `${BASE}/tasks/a%2fb.png`,
    `${BASE}/tasks/a%5cb.png`,
    `${BASE}/tasks/%00.png`,
    `https://user@r2.example.test/tasks/a.png`,
    "not a url",
  ]) {
    assert.equal(parseConfiguredR2Key(url, `${BASE}/tasks`), null, url);
  }
  assert.equal(
    parseConfiguredR2Key(`${BASE}/tasks/a.png`, `${BASE}/tasks?prefix=1`),
    null,
  );
  assert.equal(parseConfiguredR2Key(`${BASE}/tasks/a.png`, undefined), null);
});

test("dry-run keeps all rows and objects unchanged and reports unresolved provider retention", async () => {
  const { runTaskRetention } = await retentionPromise;
  const calls: AnyRecord[] = [];
  const rows = emptyRows();
  rows.backgroundRemovalTask.push(
    dueTask(1, {
      inputImageUrl: "https://provider.example.test/input.png",
      outputImageUrl: `${BASE}/tasks/1/output.png`,
    }),
  );
  const deletes: string[] = [];
  const before = JSON.stringify(rows);
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: {
      deleteItemInBucket: async (key) => {
        deletes.push(key);
      },
    },
    configuredR2Url: BASE,
    now: NOW,
    isSharedAsset: async () => false,
  });
  assert.equal(report.dryRun, true);
  assert.equal(report.due, 1);
  assert.equal(report.filesWouldDelete, 1);
  assert.equal(report.wouldExpire, 0);
  assert.equal(report.unresolvedExternal.length, 1);
  assert.deepEqual(deletes, []);
  assert.deepEqual(calls, []);
  assert.equal(JSON.stringify(rows), before);
});

test("overdue active work is an observable blocker and future results are not due", async () => {
  const { runTaskRetention, isRetentionDue } = await retentionPromise;
  const rows = emptyRows();
  rows.taskData.push(
    dueTask(1, { taskStatus: "processing", imageUrl: `${BASE}/active.png` }),
    dueTask(2, {
      taskStatus: "queued",
      expiresAt: new Date("2026-10-16T00:00:00Z"),
    }),
    dueTask(3, { expiresAt: new Date("2026-10-16T00:00:00Z") }),
  );
  const calls: AnyRecord[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: {
      deleteItemInBucket: async () =>
        assert.fail("must not delete active/future assets"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    isSharedAsset: async () => false,
  });
  assert.equal(report.activeBlockers.length, 1);
  assert.equal(report.activeBlockers[0].reason, "active_overdue");
  assert.equal(report.due, 0);
  assert.deepEqual(calls, []);
  assert.equal(
    isRetentionDue(
      { id: 1, createdAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000) },
      NOW,
    ),
    true,
  );
});

test("deletion failure retries while preserving URL and blocking audit row deletion", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.objectRemovalTask.push(
    dueTask(9, {
      outputImageUrl: `${BASE}/tasks/9/output.png`,
      auditExpiresAt: OLD,
    }),
  );
  const calls: AnyRecord[] = [];
  let attempts = 0;
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: {
      deleteItemInBucket: async () => {
        attempts++;
        throw new Error("R2 failure");
      },
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    sleep: async () => {},
    isSharedAsset: async () => false,
  });
  assert.equal(attempts, 3);
  assert.equal(report.failures.length, 1);
  assert.equal(report.expired, 0);
  assert.equal(report.auditTrimmed, 0);
  assert.equal(
    rows.objectRemovalTask[0].outputImageUrl,
    `${BASE}/tasks/9/output.png`,
  );
  assert.equal(rows.objectRemovalTask[0].retentionCleanedAt, undefined);
  assert.ok(rows.objectRemovalTask[0].retentionCheckedAt);
  assert.equal(calls.filter((call) => call.op === "deleteMany").length, 0);
});

test("successful cleanup writes a durable marker and only then permits bounded audit trim", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.watermarkRemovalTask.push(
    dueTask(7, {
      inputZipUrl: `${BASE}/tasks/7/input.zip`,
      outputZipUrl: `${BASE}/tasks/7/output.zip`,
      auditExpiresAt: OLD,
    }),
  );
  const calls: AnyRecord[] = [];
  const deleted: string[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: {
      deleteItemInBucket: async (key) => {
        deleted.push(key);
      },
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    isSharedAsset: async () => false,
  });
  assert.equal(report.filesDeleted, 2);
  assert.equal(report.expired, 1);
  assert.equal(report.auditTrimmed, 1);
  assert.deepEqual(deleted.sort(), ["tasks/7/input.zip", "tasks/7/output.zip"]);
  const auditDelete = calls.find((call) => call.op === "deleteMany");
  assert.ok(auditDelete);
  assert.deepEqual(auditDelete.args.where.id, { in: [7] });
  assert.deepEqual(auditDelete.args.where.retentionCleanedAt, { not: null });
  assert.equal(rows.watermarkRemovalTask.length, 0);
});

test("provider and shared references keep every URL and cannot enter audit trim", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.objectRemovalTask.push(
    dueTask(3, {
      inputImageUrl: "https://provider.example.test/input.png",
      inputMaskUrl: `${BASE}/shared/mask.png`,
      outputImageUrl: `${BASE}/tasks/3/output.png`,
      auditExpiresAt: OLD,
    }),
  );
  const calls: AnyRecord[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: { deleteItemInBucket: async () => {} },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    isSharedAsset: async (artifact) => artifact.field === "inputMaskUrl",
  });
  assert.equal(report.unresolvedExternal.length, 1);
  assert.equal(report.sharedReferences.length, 1);
  assert.equal(report.filesDeleted, 1);
  assert.equal(report.expired, 0);
  assert.equal(report.auditTrimmed, 0);
  assert.equal(
    rows.objectRemovalTask[0].inputImageUrl,
    "https://provider.example.test/input.png",
  );
  assert.equal(
    rows.objectRemovalTask[0].inputMaskUrl,
    `${BASE}/shared/mask.png`,
  );
  assert.equal(
    rows.objectRemovalTask[0].outputImageUrl,
    `${BASE}/tasks/3/output.png`,
  );
  assert.equal(rows.objectRemovalTask[0].retentionCleanedAt, undefined);
});

test("checked markers rotate blocked work and cleaned markers prevent repeated scans", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.backgroundRemovalTask.push(
    dueTask(1, { outputImageUrl: "https://provider.example.test/output.png" }),
    dueTask(2, {
      outputImageUrl: `${BASE}/tasks/2/output.png`,
      // Keep this row available for the third scan so the test isolates
      // checked-marker rotation from the separate 90-day audit trim.
      auditExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
    }),
  );
  const calls: AnyRecord[] = [];
  const options = {
    db: makeDb(rows, calls),
    storage: { deleteItemInBucket: async () => {} },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    batchSize: 1,
    isSharedAsset: async () => false,
  };
  assert.equal((await runTaskRetention(options)).unresolvedExternal.length, 1);
  assert.equal((await runTaskRetention(options)).expired, 1);
  assert.ok(rows.backgroundRemovalTask[1].retentionCleanedAt);
  assert.equal((await runTaskRetention(options)).due, 1);
});

test("audit trimming deletes at most the configured batch and never historical expired rows without a cleaned marker", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.objectRemovalTask.push(
    dueTask(1, {
      taskStatus: "expired",
      retentionCleanedAt: OLD,
      auditExpiresAt: OLD,
    }),
    dueTask(2, {
      taskStatus: "expired",
      retentionCleanedAt: OLD,
      auditExpiresAt: OLD,
    }),
    dueTask(3, {
      taskStatus: "expired",
      auditExpiresAt: OLD,
      outputImageUrl: "https://provider.example.test/output.png",
    }),
  );
  const calls: AnyRecord[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: { deleteItemInBucket: async () => {} },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    batchSize: 1,
    isSharedAsset: async () => false,
  });
  assert.equal(report.auditTrimmed, 1);
  const auditDelete = calls.find((call) => call.op === "deleteMany");
  assert.ok(auditDelete);
  assert.equal(auditDelete.args.where.id.in.length, 1);
  assert.ok(rows.objectRemovalTask.some((row) => row.id === 3));
});

test("all task models retain audit metadata for 90 days and TaskData billing history is protected", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.taskData.push(
    dueTask(10, {
      taskStatus: "expired",
      retentionCleanedAt: OLD,
      auditExpiresAt: OLD,
    }),
    dueTask(11, {
      taskStatus: "expired",
      retentionCleanedAt: OLD,
      auditExpiresAt: OLD,
      userBillings: [{ id: 77 }],
    }),
  );
  rows.backgroundRemovalTask.push(
    dueTask(12, {
      taskStatus: "expired",
      retentionCleanedAt: OLD,
      auditExpiresAt: OLD,
    }),
  );
  rows.watermarkRemovalTask.push(
    dueTask(13, {
      taskStatus: "expired",
      retentionCleanedAt: OLD,
      auditExpiresAt: OLD,
    }),
  );
  rows.objectRemovalTask.push(
    dueTask(14, {
      taskStatus: "expired",
      retentionCleanedAt: OLD,
      auditExpiresAt: OLD,
    }),
  );
  const calls: AnyRecord[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: { deleteItemInBucket: async () => {} },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    isSharedAsset: async () => false,
  });

  assert.equal(report.auditTrimUnsupported.length, 0);
  assert.equal(report.auditTrimmed, 4);
  assert.deepEqual(
    report.auditTrimBlocked.map(({ model, recordId, reason }) => ({
      model,
      recordId,
      reason,
    })),
    [{ model: "taskData", recordId: 11, reason: "financial_history" }],
  );
  const taskDataDelete = calls.find(
    (call) => call.op === "deleteMany" && call.model === "taskData",
  );
  assert.ok(taskDataDelete);
  assert.deepEqual(taskDataDelete.args.where.id, { in: [10] });
  assert.deepEqual(taskDataDelete.args.where.userBillings, { none: {} });
  assert.ok(rows.taskData.some((row) => row.id === 11));
});

test("legacy audit rows derive their 90-day deadline from task creation", async () => {
  const { MINIMAL_AUDIT_RETENTION_MS, runTaskRetention } =
    await retentionPromise;
  const rows = emptyRows();
  const createdAt = new Date(NOW.getTime() - MINIMAL_AUDIT_RETENTION_MS);
  rows.backgroundRemovalTask.push(
    dueTask(21, {
      taskStatus: "expired",
      createdAt,
      retentionCleanedAt: OLD,
      auditExpiresAt: null,
    }),
  );
  const calls: AnyRecord[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: { deleteItemInBucket: async () => {} },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    isSharedAsset: async () => false,
  });
  assert.equal(report.auditTrimmed, 1);
  const trim = calls.find((call) => call.op === "deleteMany");
  assert.ok(trim);
  assert.deepEqual(trim.args.where.OR[1].createdAt, {
    lte: new Date(NOW.getTime() - MINIMAL_AUDIT_RETENTION_MS),
  });
});

test("default reference checks protect reuse by another task and shared asset tables", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.backgroundRemovalTask.push(
    dueTask(1, { outputImageUrl: `${BASE}/shared.png` }),
  );
  rows.taskData.push(
    dueTask(2, {
      expiresAt: new Date("2026-10-16T00:00:00Z"),
      inputImageUrl: `${BASE}/shared.png?download=1`,
    }),
  );
  const db = makeDb(rows, []);
  const report = await runTaskRetention({
    db,
    storage: {
      deleteItemInBucket: async () => assert.fail("shared asset must survive"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
  });
  assert.equal(report.sharedReferences.length, 1);
  assert.equal(report.expired, 0);
  assert.equal(report.filesDeleted, 0);
});

test("successful file cleanup removes payload metadata before the audit period ends", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.taskData.push(
    dueTask(5, {
      userId: "owner",
      inputImageUrl: `${BASE}/tasks/5/input.png`,
      imageUrl: `${BASE}/tasks/5/output.png`,
      inputPrompt: "private prompt",
      executePrompt: "provider prompt",
      prompt: "prompt",
      replicateLogs: ["private provider logs"],
      replicateUrls: [`${BASE}/tasks/5/output.png`],
      replicateMetrics: { private: true },
      auditExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
    }),
  );
  const report = await runTaskRetention({
    db: makeDb(rows, []),
    storage: { deleteItemInBucket: async () => {} },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    isSharedAsset: async () => false,
  });
  assert.equal(report.expired, 1);
  assert.equal(report.filesDeleted, 2);
  assert.equal(rows.taskData[0].inputImageUrl, null);
  assert.equal(rows.taskData[0].imageUrl, null);
  assert.equal(rows.taskData[0].inputPrompt, null);
  assert.deepEqual(rows.taskData[0].replicateLogs, []);
  assert.deepEqual(rows.taskData[0].replicateUrls, []);
  assert.deepEqual(rows.taskData[0].replicateMetrics, {});
  assert.equal(rows.taskData[0].userId, "owner");
  assert.ok(rows.taskData[0].retentionCleanedAt);
});

test("media and composition references fail closed even without another task", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.backgroundRemovalTask.push(
    dueTask(8, { outputImageUrl: `${BASE}/tasks/8/output.png` }),
  );
  const db = makeDb(rows, []);
  db.media.count = async () => 1;
  const report = await runTaskRetention({
    db,
    storage: {
      deleteItemInBucket: async () =>
        assert.fail("shared media must not be deleted"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
  });
  assert.equal(report.sharedReferences.length, 1);
  assert.equal(rows.backgroundRemovalTask[0].retentionCleanedAt, undefined);
});

test("cleaning failed and canceled tasks preserves their returned quota and permits safe audit trim", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.watermarkRemovalTask.push(
    dueTask(1, {
      taskStatus: "failed",
      inputZipUrl: "",
      auditExpiresAt: new Date("2027-01-01T00:00:00Z"),
    }),
    dueTask(2, {
      taskStatus: "canceled",
      inputZipUrl: "",
      auditExpiresAt: OLD,
    }),
  );
  const calls: AnyRecord[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    storage: { deleteItemInBucket: async () => undefined },
    isSharedAsset: async () => false,
  });
  assert.equal(rows.watermarkRemovalTask[0].taskStatus, "failed");
  assert.ok(rows.watermarkRemovalTask[0].retentionCleanedAt);
  assert.equal(rows.watermarkRemovalTask.length, 1);
  assert.equal(report.auditTrimmed, 1);
  const trimmed = calls.find((call) => call.op === "deleteMany");
  assert.ok(trimmed);
  assert.deepEqual(trimmed.args.where.id.in, [2]);
});

test("post-claim shared reference skips R2 delete and preserves URLs", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.backgroundRemovalTask.push(
    dueTask(42, {
      inputImageUrl: `${BASE}/tasks/42/input.png`,
      outputImageUrl: `${BASE}/tasks/42/output.png`,
    }),
  );
  const calls: AnyRecord[] = [];
  const deleted: string[] = [];
  let checks = 0;
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: {
      deleteItemInBucket: async (key) => {
        deleted.push(key);
      },
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    isSharedAsset: async () => {
      checks++;
      // First pass (pre-claim) unshared; post-claim reports shared.
      return checks > 2;
    },
  });
  assert.equal(report.expired, 0);
  assert.equal(deleted.length, 0);
  assert.ok(report.sharedReferences.length >= 1);
  assert.equal(
    rows.backgroundRemovalTask[0].outputImageUrl,
    `${BASE}/tasks/42/output.png`,
  );
  assert.equal(rows.backgroundRemovalTask[0].retentionCleanedAt, undefined);
});


test("active overdue cancel stays off by default and still reports blockers", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.taskData.push(
    dueTask(1, {
      taskStatus: "processing",
      replicateId: "rh-1",
      imageUrl: `${BASE}/active.png`,
      expiresAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
    }),
  );
  const cancelCalls: string[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, []),
    storage: {
      deleteItemInBucket: async () => assert.fail("must not delete"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    isSharedAsset: async () => false,
    cancelProviderTask: async (id) => {
      cancelCalls.push(id);
      return true;
    },
  });
  assert.equal(report.activeBlockers.length, 1);
  assert.equal(report.activeBlockers[0].reason, "active_overdue");
  assert.equal(report.canceledActive, 0);
  assert.equal(report.wouldCancelActive, 0);
  assert.deepEqual(cancelCalls, []);
  assert.equal(rows.taskData[0].taskStatus, "processing");
});

test("cancelActiveOverdue waits for grace before canceling", async () => {
  const { runTaskRetention, DEFAULT_ACTIVE_OVERDUE_GRACE_MS } =
    await retentionPromise;
  const rows = emptyRows();
  rows.backgroundRemovalTask.push(
    dueTask(2, {
      taskStatus: "processing",
      replicateId: "rh-bg-2",
      outputImageUrl: `${BASE}/bg.png`,
      // Due, but inside the 6h grace window.
      expiresAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    }),
  );
  const cancelCalls: string[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, []),
    storage: {
      deleteItemInBucket: async () => assert.fail("must not delete"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    cancelActiveOverdue: true,
    activeOverdueGraceMs: DEFAULT_ACTIVE_OVERDUE_GRACE_MS,
    isSharedAsset: async () => false,
    cancelProviderTask: async (id) => {
      cancelCalls.push(id);
      return true;
    },
  });
  assert.equal(report.activeBlockers.length, 1);
  assert.equal(report.activeBlockers[0].reason, "active_overdue_grace");
  assert.equal(report.canceledActive, 0);
  assert.deepEqual(cancelCalls, []);
});

test("cancelActiveOverdue dry-run counts wouldCancel without mutating", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.objectRemovalTask.push(
    dueTask(3, {
      taskStatus: "queued",
      runninghubTaskId: "rh-obj-3",
      inputImageUrl: `${BASE}/in.png`,
      inputMaskUrl: `${BASE}/mask.png`,
      expiresAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
    }),
  );
  const before = JSON.stringify(rows);
  const cancelCalls: string[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, []),
    storage: {
      deleteItemInBucket: async () => assert.fail("must not delete"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: true,
    cancelActiveOverdue: true,
    activeOverdueGraceMs: 6 * 60 * 60 * 1000,
    isSharedAsset: async () => false,
    cancelProviderTask: async (id) => {
      cancelCalls.push(id);
      return true;
    },
  });
  assert.equal(report.wouldCancelActive, 1);
  assert.equal(report.canceledActive, 0);
  assert.deepEqual(cancelCalls, []);
  assert.equal(JSON.stringify(rows), before);
});

test("cancelActiveOverdue cancels past-grace provider jobs and marks canceled", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.watermarkRemovalTask.push(
    dueTask(4, {
      taskStatus: "processing",
      runninghubTaskId: "2115733518440169474",
      inputZipUrl: `${BASE}/in.zip`,
      expiresAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
    }),
  );
  rows.taskData.push(
    dueTask(5, {
      taskStatus: "processing",
      // Missing provider id → blocker, not cancel.
      expiresAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
    }),
  );
  const calls: AnyRecord[] = [];
  const cancelCalls: string[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: {
      deleteItemInBucket: async () => assert.fail("must not delete yet"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    cancelActiveOverdue: true,
    activeOverdueGraceMs: 6 * 60 * 60 * 1000,
    isSharedAsset: async () => false,
    cancelProviderTask: async (id) => {
      cancelCalls.push(id);
      return true;
    },
  });
  assert.deepEqual(cancelCalls, ["2115733518440169474"]);
  assert.equal(report.canceledActive, 1);
  assert.equal(report.wouldCancelActive, 0);
  assert.equal(report.cancelFailures.length, 0);
  assert.equal(rows.watermarkRemovalTask[0].taskStatus, "canceled");
  assert.equal(rows.watermarkRemovalTask[0].inputZipUrl, `${BASE}/in.zip`);
  assert.equal(rows.watermarkRemovalTask[0].retentionCleanedAt, undefined);
  assert.ok(
    report.activeBlockers.some(
      (issue) => issue.reason === "active_overdue_missing_provider_id",
    ),
  );
  const statusUpdate = calls.find(
    (call) =>
      call.op === "update" &&
      call.model === "watermarkRemovalTask" &&
      call.args.data.taskStatus === "canceled",
  );
  assert.ok(statusUpdate);
});

test("cancelActiveOverdue records cancel failure and leaves row active", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.objectRemovalTask.push(
    dueTask(6, {
      taskStatus: "processing",
      runninghubTaskId: "2115733518440169999",
      inputImageUrl: `${BASE}/in.png`,
      inputMaskUrl: `${BASE}/mask.png`,
      expiresAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
    }),
  );
  const report = await runTaskRetention({
    db: makeDb(rows, []),
    storage: {
      deleteItemInBucket: async () => assert.fail("must not delete"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    cancelActiveOverdue: true,
    activeOverdueGraceMs: 0,
    isSharedAsset: async () => false,
    cancelProviderTask: async () => {
      throw new Error("provider down");
    },
  });
  assert.equal(report.canceledActive, 0);
  assert.equal(report.cancelFailures.length, 1);
  assert.equal(report.cancelFailures[0].reason, "active_overdue_cancel_failed");
  assert.equal(rows.objectRemovalTask[0].taskStatus, "processing");
});


test("invalid legacy provider ids are force-canceled locally after grace", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.taskData.push(
    dueTask(50, {
      taskStatus: "Processing",
      replicateId: "7vadlegacyreplicatetaskid01",
      expiresAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
      // Keep audit far away so this test isolates cancel reconcile.
      auditExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
      inputImageUrl: `${BASE}/legacy.png`,
    }),
  );
  const calls: AnyRecord[] = [];
  const cancelCalls: string[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, calls),
    storage: {
      deleteItemInBucket: async () => {},
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    cancelActiveOverdue: true,
    activeOverdueGraceMs: 6 * 60 * 60 * 1000,
    isSharedAsset: async () => false,
    cancelProviderTask: async (id) => {
      cancelCalls.push(id);
      return true;
    },
  });
  assert.deepEqual(cancelCalls, []);
  assert.equal(report.canceledActive, 1);
  const statusUpdate = calls.find(
    (call) =>
      call.op === "update" &&
      call.model === "taskData" &&
      call.args.data.taskStatus === "canceled",
  );
  assert.ok(statusUpdate);
});

test("reconciles SUCCESS provider status without requiring cancel", async () => {
  const { runTaskRetention } = await retentionPromise;
  const rows = emptyRows();
  rows.backgroundRemovalTask.push(
    dueTask(51, {
      taskStatus: "processing",
      replicateId: "2115733518440169474",
      outputImageUrl: `${BASE}/bg.png`,
      expiresAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
    }),
  );
  const cancelCalls: string[] = [];
  const report = await runTaskRetention({
    db: makeDb(rows, []),
    storage: {
      deleteItemInBucket: async () => assert.fail("must not delete"),
    },
    configuredR2Url: BASE,
    now: NOW,
    dryRun: false,
    cancelActiveOverdue: true,
    activeOverdueGraceMs: 0,
    isSharedAsset: async () => false,
    getProviderTaskStatus: async () => "SUCCESS",
    cancelProviderTask: async (id) => {
      cancelCalls.push(id);
      return false;
    },
  });
  assert.deepEqual(cancelCalls, []);
  assert.equal(report.canceledActive, 1);
  assert.equal(rows.backgroundRemovalTask[0].taskStatus, "succeeded");
});
