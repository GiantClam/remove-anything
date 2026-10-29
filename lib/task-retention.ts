import "server-only";

import type { Prisma } from "@prisma/client";

export const TASK_SOURCE_RESULT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MINIMAL_AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const DEFAULT_RETENTION_BATCH_SIZE = 100;
export const DEFAULT_DELETE_ATTEMPTS = 3;
export const RETENTION_EXECUTE_ENV = "TASK_RETENTION_EXECUTE";

export type RetentionModelName =
  | "taskData"
  | "backgroundRemovalTask"
  | "watermarkRemovalTask"
  | "objectRemovalTask";
export type RetentionRecord = {
  id: number | string;
  createdAt?: Date | string | null;
  expiresAt?: Date | string | null;
  auditExpiresAt?: Date | string | null;
  retentionCheckedAt?: Date | string | null;
  retentionCleanedAt?: Date | string | null;
  taskStatus?: string | null;
  [key: string]: unknown;
};
export type RetentionDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<RetentionRecord[]>;
  update?: (args: Record<string, unknown>) => Promise<unknown>;
  deleteMany?: (
    args: Record<string, unknown>,
  ) => Promise<{ count?: number } | unknown>;
  count?: (args: Record<string, unknown>) => Promise<number>;
};
export type RetentionDb = Record<RetentionModelName, RetentionDelegate> &
  Partial<
    Record<
      "backgroundComposition" | "backgroundImage" | "media" | "user",
      Pick<RetentionDelegate, "count">
    >
  > & { userBilling?: Pick<RetentionDelegate, "findMany"> };
export type RetentionStorage = {
  deleteItemInBucket: (key: string) => Promise<void>;
};
export type RetentionArtifact = {
  model: RetentionModelName;
  recordId: number | string;
  field: string;
  url: string;
  key: string | null;
};
export type RetentionIssue = {
  model: RetentionModelName;
  recordId: number | string;
  field: string;
  url?: string;
  key?: string;
  reason:
    | "external_or_provider"
    | "shared_reference"
    | "delete_failed"
    | "active_overdue"
    | "financial_history"
    | "audit_state_changed";
  error?: string;
  attempts?: number;
};
export type RetentionReport = {
  dryRun: boolean;
  batchSize: number;
  scanned: number;
  due: number;
  wouldExpire: number;
  expired: number;
  skippedActive: number;
  skippedNotDue: number;
  filesDeleted: number;
  filesWouldDelete: number;
  unresolvedExternal: RetentionIssue[];
  sharedReferences: RetentionIssue[];
  failures: RetentionIssue[];
  activeBlockers: RetentionIssue[];
  auditTrimmed: number;
  auditWouldTrim: number;
  auditTrimBlocked: RetentionIssue[];
  auditTrimUnsupported: RetentionModelName[];
};

const MODEL_CONFIG: Record<
  RetentionModelName,
  { urlFields: string[]; supportsAuditExpiry: boolean }
> = {
  taskData: {
    urlFields: ["inputImageUrl", "imageUrl", "r2Url", "replicateUrls"],
    supportsAuditExpiry: true,
  },
  backgroundRemovalTask: {
    urlFields: ["inputImageUrl", "outputImageUrl"],
    supportsAuditExpiry: true,
  },
  watermarkRemovalTask: {
    urlFields: ["inputZipUrl", "outputZipUrl"],
    supportsAuditExpiry: true,
  },
  objectRemovalTask: {
    urlFields: ["inputImageUrl", "inputMaskUrl", "outputImageUrl"],
    supportsAuditExpiry: true,
  },
};
const MODEL_NAMES = Object.keys(MODEL_CONFIG) as RetentionModelName[];
const CLEANED_TERMINAL_STATUSES = [
  "expired",
  "failed",
  "canceled",
  "cancelled",
];
const ACTIVE_STATUSES = [
  "queued",
  "pending",
  "starting",
  "processing",
  "running",
  "in_progress",
  "in-progress",
  "waiting",
];
const ACTIVE_STATUS_VALUES = Array.from(
  new Set(
    ACTIVE_STATUSES.flatMap((status) => [
      status,
      status.toUpperCase(),
      status.charAt(0).toUpperCase() + status.slice(1),
    ]),
  ),
);

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function isActiveRetentionTask(record: RetentionRecord) {
  return ACTIVE_STATUSES.includes(
    String(record.taskStatus || "")
      .trim()
      .toLowerCase(),
  );
}
export function isRetentionDue(record: RetentionRecord, now = new Date()) {
  const expiry =
    asDate(record.expiresAt) ||
    (asDate(record.createdAt)
      ? new Date(
          asDate(record.createdAt)!.getTime() + TASK_SOURCE_RESULT_RETENTION_MS,
        )
      : null);
  return Boolean(expiry && expiry.getTime() <= now.getTime());
}

/** Resolve only the exact configured HTTP(S) origin and path boundary. */
export function parseConfiguredR2Key(
  value: unknown,
  configuredBaseUrl: string | undefined,
): string | null {
  if (typeof value !== "string" || !value || !configuredBaseUrl) return null;
  try {
    const base = new URL(configuredBaseUrl);
    const candidate = new URL(value);
    if (
      !["https:", "http:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return null;
    if (
      candidate.origin !== base.origin ||
      candidate.username ||
      candidate.password
    )
      return null;
    // URL normalizes traversal segments; reject ambiguous raw encodings first.
    if (
      /(?:^|\/)\.{1,2}(?:\/|$)|%2e|%2f|%5c|\\/i.test(value.split(/[?#]/, 1)[0])
    )
      return null;
    const basePath = base.pathname.endsWith("/")
      ? base.pathname
      : `${base.pathname}/`;
    if (!candidate.pathname.startsWith(basePath)) return null;
    const encodedKey = candidate.pathname.slice(basePath.length);
    if (!encodedKey || encodedKey.endsWith("/")) return null;
    const key = decodeURIComponent(encodedKey);
    if (!key || key.startsWith("/") || key.includes("\0")) return null;
    return key;
  } catch {
    return null;
  }
}

function artifactUrls(
  model: RetentionModelName,
  record: RetentionRecord,
  base: string | undefined,
): RetentionArtifact[] {
  return MODEL_CONFIG[model].urlFields.flatMap((field) => {
    const raw = record[field];
    const values = Array.isArray(raw) ? raw : [raw];
    return values.flatMap((value, index) =>
      typeof value === "string" && value
        ? [
            {
              model,
              recordId: record.id,
              field: Array.isArray(raw) ? `${field}.${index}` : field,
              url: value,
              key: parseConfiguredR2Key(value, base),
            },
          ]
        : [],
    );
  });
}
function batchLimit(value: number | undefined) {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(500, Math.floor(value!)))
    : DEFAULT_RETENTION_BATCH_SIZE;
}
function dueWhere(now: Date) {
  return {
    OR: [
      { expiresAt: { lte: now } },
      {
        expiresAt: null,
        createdAt: {
          lte: new Date(now.getTime() - TASK_SOURCE_RESULT_RETENTION_MS),
        },
      },
    ],
  };
}
function urlFilters(fields: string[], url: string) {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  const canonical = parsed.toString();
  return fields.flatMap<Record<string, unknown>>((field) =>
    field === "replicateUrls"
      ? [{ [field]: { has: url } }, { [field]: { has: canonical } }]
      : [
          { [field]: url },
          { [field]: canonical },
          { [field]: { startsWith: `${canonical}?` } },
          { [field]: { startsWith: `${canonical}#` } },
        ],
  );
}
async function defaultSharedReferenceCheck(
  db: RetentionDb,
  artifact: RetentionArtifact,
): Promise<boolean> {
  // Fail closed if any known reference table cannot be checked. Count other
  // task rows as references even when due; deleting them requires ownership
  // reconciliation rather than guessing that their shared source is disposable.
  const extraModels = {
    backgroundComposition: ["foregroundImageUrl", "resultImageUrl"],
    backgroundImage: ["imageUrl", "thumbnailUrl"],
    media: ["url"],
    user: ["image"],
  } as const;
  const checks: Promise<number>[] = [];
  for (const model of MODEL_NAMES) {
    if (!db[model]?.count) return true;
    checks.push(
      db[model].count!({
        where: {
          ...(model === artifact.model
            ? { id: { not: artifact.recordId } }
            : {}),
          OR: urlFilters(MODEL_CONFIG[model].urlFields, artifact.url),
        },
      }),
    );
  }
  for (const [model, fields] of Object.entries(extraModels)) {
    const delegate = db[model as keyof typeof extraModels];
    if (!delegate?.count) return true;
    checks.push(
      delegate.count({ where: { OR: urlFilters([...fields], artifact.url) } }),
    );
  }
  return (await Promise.all(checks)).some((count) => count > 0);
}
async function deleteWithRetry(
  storage: RetentionStorage,
  key: string,
  attempts: number,
  sleep: (ms: number) => Promise<void>,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await storage.deleteItemInBucket(key);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts)
        await sleep(Math.min(1000, 50 * 2 ** (attempt - 1)));
    }
  }
  throw Object.assign(
    lastError instanceof Error ? lastError : new Error(String(lastError)),
    { attempts },
  );
}

async function trimAuditRows(
  db: RetentionDb,
  now: Date,
  dryRun: boolean,
  batchSize: number,
  report: RetentionReport,
) {
  const auditDeadlineWhere = {
    OR: [
      { auditExpiresAt: { lte: now } },
      {
        auditExpiresAt: null,
        createdAt: {
          lte: new Date(now.getTime() - MINIMAL_AUDIT_RETENTION_MS),
        },
      },
    ],
  };
  for (const model of MODEL_NAMES) {
    if (!MODEL_CONFIG[model].supportsAuditExpiry) {
      report.auditTrimUnsupported.push(model);
      continue;
    }
    const delegate = db[model];
    if (!delegate?.findMany || !delegate.deleteMany) continue;
    const candidates = await delegate.findMany({
      where: {
        ...auditDeadlineWhere,
        retentionCleanedAt: { not: null },
        taskStatus: { in: CLEANED_TERMINAL_STATUSES },
      },
      take: batchSize,
      orderBy: { auditExpiresAt: "asc" },
    });
    // Recheck the invariant in memory as well as at mutation time. A row with a
    // failed, provider, or shared artifact never gets a cleaned marker.
    const ids = (candidates || [])
      .filter(
        (row) =>
          asDate(row.retentionCleanedAt) &&
          (asDate(row.auditExpiresAt)?.getTime() ??
            (asDate(row.createdAt)?.getTime() ?? Infinity) +
              MINIMAL_AUDIT_RETENTION_MS) <= now.getTime() &&
          CLEANED_TERMINAL_STATUSES.includes(String(row.taskStatus)),
      )
      .slice(0, batchSize)
      .map((row) => row.id);
    if (!ids.length) continue;

    // TaskData is linked to UserBilling with an existing cascade relation.
    // Never delete a task row until the billing reference has been checked;
    // a missing/failed lookup preserves the audit history and reports why.
    let billingLinkedIds = new Set<number | string>();
    if (model === "taskData") {
      if (!db.userBilling?.findMany) {
        report.auditTrimBlocked.push(
          ...ids.map((recordId) => ({
            model,
            recordId,
            field: "userBillings",
            reason: "financial_history" as const,
            error:
              "Billing-reference lookup is unavailable; audit row was preserved",
          })),
        );
        continue;
      }
      try {
        const billingRows = await db.userBilling.findMany({
          where: { taskId: { in: ids } },
          select: { taskId: true },
        });
        billingLinkedIds = new Set(
          (billingRows || [])
            .map((row) => row.taskId)
            .filter((taskId): taskId is number | string => taskId != null),
        );
      } catch {
        report.auditTrimBlocked.push(
          ...ids.map((recordId) => ({
            model,
            recordId,
            field: "userBillings",
            reason: "financial_history" as const,
            error: "Billing-reference lookup failed; audit row was preserved",
          })),
        );
        continue;
      }
    }
    for (const recordId of billingLinkedIds) {
      if (ids.includes(recordId)) {
        report.auditTrimBlocked.push({
          model,
          recordId,
          field: "userBillings",
          reason: "financial_history",
        });
      }
    }
    const eligibleIds = ids.filter((id) => !billingLinkedIds.has(id));
    if (!eligibleIds.length) continue;
    if (dryRun) {
      report.auditWouldTrim += eligibleIds.length;
      continue;
    }
    const result = await delegate.deleteMany({
      where: {
        id: { in: eligibleIds },
        retentionCleanedAt: { not: null },
        taskStatus: { in: CLEANED_TERMINAL_STATUSES },
        ...auditDeadlineWhere,
        ...(model === "taskData" ? { userBillings: { none: {} } } : {}),
      },
    });
    const trimmed = Number((result as { count?: number })?.count || 0);
    report.auditTrimmed += trimmed;
    if (trimmed < eligibleIds.length) {
      const remaining = await delegate.findMany({
        where: { id: { in: eligibleIds } },
        select: { id: true },
      });
      for (const row of remaining || []) {
        report.auditTrimBlocked.push({
          model,
          recordId: row.id,
          field: "retention eligibility",
          reason: "audit_state_changed",
          error: "Audit row no longer matched the guarded deletion predicates",
        });
      }
    }
  }
}

export type RunTaskRetentionOptions = {
  db: RetentionDb;
  storage: RetentionStorage;
  configuredR2Url: string | undefined;
  now?: Date;
  dryRun?: boolean;
  batchSize?: number;
  deleteAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  isSharedAsset?: (artifact: RetentionArtifact) => Promise<boolean>;
};

/** Bounded per-table processing; all object and row mutation defaults off. */
export async function runTaskRetention(
  options: RunTaskRetentionOptions,
): Promise<RetentionReport> {
  const now = options.now || new Date();
  const dryRun = options.dryRun !== false;
  const batchSize = batchLimit(options.batchSize);
  const attempts = Math.max(
    1,
    Math.min(5, Math.floor(options.deleteAttempts || DEFAULT_DELETE_ATTEMPTS)),
  );
  const sleep =
    options.sleep ||
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const sharedCheck =
    options.isSharedAsset ||
    ((artifact: RetentionArtifact) =>
      defaultSharedReferenceCheck(options.db, artifact));
  const report: RetentionReport = {
    dryRun,
    batchSize,
    scanned: 0,
    due: 0,
    wouldExpire: 0,
    expired: 0,
    skippedActive: 0,
    skippedNotDue: 0,
    filesDeleted: 0,
    filesWouldDelete: 0,
    unresolvedExternal: [],
    sharedReferences: [],
    failures: [],
    activeBlockers: [],
    auditTrimmed: 0,
    auditWouldTrim: 0,
    auditTrimBlocked: [],
    auditTrimUnsupported: [],
  };

  for (const model of MODEL_NAMES) {
    const delegate = options.db[model];
    if (!delegate?.findMany) continue;
    const active = await delegate.findMany({
      where: { ...dueWhere(now), taskStatus: { in: ACTIVE_STATUS_VALUES } },
      take: batchSize,
      orderBy: { createdAt: "asc" },
    });
    for (const row of (active || [])
      .filter((row) => isActiveRetentionTask(row) && isRetentionDue(row, now))
      .slice(0, batchSize)) {
      report.activeBlockers.push({
        model,
        recordId: row.id,
        field: "taskStatus",
        reason: "active_overdue",
        error:
          "Provider cancellation or terminal-state reconciliation is required before deleting active work",
      });
    }
    const records = await delegate.findMany({
      where: {
        ...dueWhere(now),
        retentionCleanedAt: null,
        taskStatus: { notIn: ACTIVE_STATUS_VALUES },
      },
      take: batchSize,
      orderBy: [
        { retentionCheckedAt: { sort: "asc", nulls: "first" } },
        { id: "asc" },
      ],
    });
    for (const record of (records || []).slice(0, batchSize)) {
      report.scanned++;
      if (record.retentionCleanedAt) continue;
      if (isActiveRetentionTask(record)) {
        report.skippedActive++;
        continue;
      }
      if (!isRetentionDue(record, now)) {
        report.skippedNotDue++;
        continue;
      }
      report.due++;
      const artifacts = artifactUrls(model, record, options.configuredR2Url);
      let blocked = false;
      const candidateKeys = new Set<string>();
      for (const artifact of artifacts) {
        if (!artifact.key) {
          blocked = true;
          report.unresolvedExternal.push({
            ...artifact,
            key: undefined,
            reason: "external_or_provider",
          });
          continue;
        }
        let shared: boolean;
        let sharedError: string | undefined;
        try {
          shared = await sharedCheck(artifact);
        } catch (error) {
          shared = true;
          sharedError = `reference check failed: ${String(error)}`;
        }
        if (shared) {
          blocked = true;
          report.sharedReferences.push({
            ...artifact,
            key: artifact.key,
            reason: "shared_reference",
            ...(sharedError ? { error: sharedError } : {}),
          });
          continue;
        }
        candidateKeys.add(artifact.key);
      }
      if (dryRun) {
        report.filesWouldDelete += candidateKeys.size;
        if (!blocked) report.wouldExpire++;
        continue;
      }
      if (!delegate.update)
        throw new Error(`Retention update delegate is unavailable: ${model}`);

      // Claim the row before storage deletes so concurrent workers skip it.
      // URLs stay intact until every candidate key is deleted or confirmed
      // shared; that preserves retryable delete failures.
      try {
        await delegate.update({
          where: {
            id: record.id,
            retentionCleanedAt: null,
            taskStatus: { notIn: ACTIVE_STATUS_VALUES },
          },
          data: { retentionCheckedAt: now, updatedAt: now },
        });
      } catch {
        // Another worker claimed or the row left the eligible set.
        continue;
      }

      const deletedKeys = new Set<string>();
      let deleteBlocked = false;
      for (const artifact of artifacts) {
        if (!artifact.key || !candidateKeys.has(artifact.key)) continue;
        let sharedAfter: boolean;
        let sharedError: string | undefined;
        try {
          sharedAfter = await sharedCheck(artifact);
        } catch (error) {
          sharedAfter = true;
          sharedError = `post-claim reference check failed: ${String(error)}`;
        }
        if (sharedAfter) {
          deleteBlocked = true;
          report.sharedReferences.push({
            ...artifact,
            key: artifact.key,
            reason: "shared_reference",
            ...(sharedError
              ? { error: sharedError }
              : { error: "reference appeared after claim; R2 delete skipped" }),
          });
          continue;
        }
        try {
          if (!deletedKeys.has(artifact.key)) {
            await deleteWithRetry(
              options.storage,
              artifact.key,
              attempts,
              sleep,
            );
            report.filesDeleted++;
            deletedKeys.add(artifact.key);
          }
        } catch (error) {
          deleteBlocked = true;
          report.failures.push({
            ...artifact,
            key: artifact.key,
            reason: "delete_failed",
            error: String(error),
            attempts: Number(
              (error as { attempts?: number })?.attempts || attempts,
            ),
          });
        }
      }

      if (blocked || deleteBlocked) continue;

      const previousStatus = String(record.taskStatus || "").toLowerCase();
      const data: Record<string, unknown> = {
        retentionCheckedAt: now,
        updatedAt: now,
        retentionCleanedAt: now,
        taskStatus: ["failed", "canceled", "cancelled"].includes(previousStatus)
          ? previousStatus
          : "expired",
      };
      if (model === "taskData")
        Object.assign(data, {
          inputImageUrl: null,
          imageUrl: null,
          r2Url: null,
          inputPrompt: null,
          executePrompt: null,
          prompt: null,
          errorMsg: null,
          runninghubFileName: null,
          replicateStatus: null,
          replicateUrls: [],
          replicateLogs: [],
          replicateMetrics: {},
        } satisfies Prisma.TaskDataUpdateInput);
      if (model === "backgroundRemovalTask")
        Object.assign(data, {
          inputImageUrl: "",
          outputImageUrl: null,
          errorMsg: null,
        });
      if (model === "watermarkRemovalTask")
        Object.assign(data, {
          inputZipUrl: "",
          outputZipUrl: null,
          errorMsg: null,
        });
      if (model === "objectRemovalTask")
        Object.assign(data, {
          inputImageUrl: "",
          inputMaskUrl: "",
          outputImageUrl: null,
          detectPrompt: null,
          errorMsg: null,
        });
      await delegate.update({
        where: {
          id: record.id,
          retentionCleanedAt: null,
          taskStatus: { notIn: ACTIVE_STATUS_VALUES },
        },
        data,
      });
      report.expired++;
    }
  }
  await trimAuditRows(options.db, now, dryRun, batchSize, report);
  return report;
}
