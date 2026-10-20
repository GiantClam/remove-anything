#!/usr/bin/env node

/** Offline, evidence-preserving import. See weekly-report-input-contract.md. */
import fs from "node:fs";

const NO_DATA = "NO DATA";
const DAY = 86_400_000;
const STAGES = [
  ["tool_view", ["tool_view"]],
  ["upload_started", ["upload_started"]],
  ["task_created", ["task_created"]],
  ["processing_started", ["processing_started", "task_processing"]],
  ["processing_completed", ["processing_completed", "task_succeeded"]],
  ["processing_failed", ["processing_failed", "task_failed"]],
  ["result_downloaded", ["result_downloaded"]],
  ["signup_completed", ["signup_completed"]],
  ["checkout_started", ["checkout_started"]],
  ["purchase_completed", ["purchase_completed"]],
];
const DIMENSIONS = ["landing_page", "tool_slug", "locale", "is_authenticated"];
const aliases = {
  event_name: "eventName",
  event: "eventName",
  name: "eventName",
  landingPage: "landing_page",
  landingPagePlusQueryString: "landing_page",
};
const issues = [];

function scalar(value) {
  if (value && typeof value === "object")
    return scalar(value.value ?? value.stringValue ?? value.int64Value);
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "(not set)"
  )
    return undefined;
  return value;
}
function text(value) {
  const result = scalar(value);
  return result === undefined ? NO_DATA : String(result);
}
function number(value, integer = false) {
  const raw = scalar(value);
  if (
    raw === undefined ||
    typeof raw === "boolean" ||
    (typeof raw === "string" && !raw.trim())
  )
    return null;
  const result = Number(raw);
  return Number.isFinite(result) &&
    result >= 0 &&
    (!integer || Number.isInteger(result))
    ? result
    : null;
}
function time(value) {
  const raw = scalar(value);
  if (
    typeof raw !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(
      raw,
    )
  )
    return null;
  const date = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
  if (
    !Number.isFinite(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== raw.slice(0, 10)
  )
    return null;
  const result = Date.parse(raw);
  return Number.isFinite(result) ? result : null;
}
function auth(value) {
  const raw = scalar(value);
  if (raw === true || raw === 1 || raw === "true" || raw === "1")
    return "authenticated";
  if (raw === false || raw === 0 || raw === "false" || raw === "0")
    return "anonymous";
  return NO_DATA;
}
function dimensions(row) {
  return [
    text(row.landing_page),
    text(row.tool_slug),
    text(row.locale),
    auth(row.is_authenticated),
  ];
}
function groupRows(rows, key = dimensions) {
  const groups = new Map();
  for (const row of rows) {
    const values = key(row);
    const id = JSON.stringify(values);
    if (!groups.has(id)) groups.set(id, { values, rows: [] });
    groups.get(id).rows.push(row);
  }
  return [...groups.values()].sort((a, b) =>
    JSON.stringify(a.values).localeCompare(JSON.stringify(b.values)),
  );
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function uniqueFacts(rows, idField, label, quality = {}) {
  const found = new Map();
  const conflicts = new Set();
  let duplicate = 0;
  let missing = 0;
  for (const row of rows) {
    const id = scalar(row?.[idField]);
    if (id === undefined) {
      missing += 1;
      continue;
    }
    const signature = JSON.stringify(canonical(row));
    const existing = found.get(String(id));
    if (existing && existing.signature !== signature) conflicts.add(String(id));
    else if (existing) duplicate += 1;
    else found.set(String(id), { signature, row });
  }
  if (duplicate)
    issues.push(
      `${label}: ignored ${duplicate} identical duplicate record(s).`,
    );
  if (missing)
    issues.push(`${label}: excluded ${missing} record(s) without ${idField}.`);
  if (conflicts.size)
    issues.push(
      `${label}: excluded all records for ${conflicts.size} conflicting ${idField} value(s).`,
    );
  quality.excluded = missing + conflicts.size;
  return [...found.entries()]
    .filter(([id]) => !conflicts.has(id))
    .map(([, entry]) => entry.row);
}
function dataset(value) {
  if (Array.isArray(value)) return { rows: value, metadata: {} };
  return {
    rows: Array.isArray(value?.rows) ? value.rows : [],
    metadata: value?.metadata || {},
  };
}
function headerName(header) {
  const name = typeof header === "string" ? header : header?.name;
  const plain = name?.replace(/^(customEvent|customUser):/, "");
  return aliases[plain] || plain;
}
function normalizeEvents(input) {
  const eventEnvelope =
    input?.events && !Array.isArray(input.events) ? input.events : input;
  const rows = Array.isArray(input)
    ? input
    : (eventEnvelope?.rows ??
      eventEnvelope?.events ??
      input?.events ??
      input?.rows ??
      []);
  if (!Array.isArray(rows)) throw new Error("events/rows must be an array");
  if (input?.events && input?.rows)
    throw new Error(
      "Use either events or rows; merging both could double count events",
    );
  const dimensionHeaders =
    (eventEnvelope?.dimensionHeaders || input?.dimensionHeaders)?.map(
      headerName,
    ) || [];
  const metricHeaders =
    (eventEnvelope?.metricHeaders || input?.metricHeaders)?.map(headerName) ||
    [];
  const normalized = [];
  let invalidNames = 0;
  let unnamedGa = 0;
  for (const source of rows) {
    if (!source || typeof source !== "object") {
      invalidNames += 1;
      continue;
    }
    const isGa =
      Array.isArray(source.dimensionValues) ||
      Array.isArray(source.metricValues);
    const row = isGa ? {} : { ...source.params, ...source };
    if (isGa) {
      if (!dimensionHeaders.length) {
        unnamedGa += 1;
        continue;
      }
      dimensionHeaders.forEach((key, i) => {
        row[key] = scalar(source.dimensionValues?.[i]);
      });
      metricHeaders.forEach((key, i) => {
        row[key] = scalar(source.metricValues?.[i]);
      });
    } else {
      for (const [key, value] of Object.entries(row))
        row[aliases[key] || key] = scalar(value);
    }
    const name = scalar(row.eventName);
    if (name === undefined) {
      invalidNames += 1;
      continue;
    }
    const aggregate =
      isGa ||
      Object.hasOwn(source, "eventCount") ||
      Object.hasOwn(source, "count");
    const count = aggregate ? number(row.eventCount ?? row.count, true) : 1;
    normalized.push({ ...row, eventName: String(name), count, aggregate });
  }
  if (invalidNames)
    issues.push(`Events: excluded ${invalidNames} row(s) without eventName.`);
  if (unnamedGa)
    issues.push(
      `Events: excluded ${unnamedGa} GA row(s) without dimensionHeaders; positional dimension guesses are disabled.`,
    );
  if (normalized.some((row) => row.count === null))
    issues.push(
      "Events: invalid or missing eventCount remains NO DATA; known subtotals are not complete totals.",
    );
  const rawWithIds = normalized.filter(
    (row) => !row.aggregate && scalar(row.event_id) !== undefined,
  );
  const deduped = uniqueFacts(
    rawWithIds.map((row) => ({
      ...row,
      _id: `${row.eventName}:${row.event_id}`,
    })),
    "_id",
    "Events",
  ).map(({ _id, ...row }) => row);
  return [
    ...deduped,
    ...normalized.filter(
      (row) => row.aggregate || scalar(row.event_id) === undefined,
    ),
  ];
}
function sum(rows, field, integer = false) {
  if (!rows.length) return NO_DATA;
  const values = rows.map((row) => number(row[field], integer));
  const valid = values.filter((value) => value !== null);
  const subtotal = valid.reduce((a, b) => a + b, 0);
  return valid.length === values.length
    ? format(subtotal)
    : `${NO_DATA} (known subtotal ${format(subtotal)}; ${valid.length}/${values.length} rows numeric)`;
}
function format(value) {
  return String(Number(value.toFixed(6)));
}
function fraction(top, bottom) {
  return bottom
    ? `${top}/${bottom} (${((100 * top) / bottom).toFixed(2)}%)`
    : NO_DATA;
}
function quantile(values, p) {
  if (!values.length) return NO_DATA;
  const sorted = values.toSorted
    ? values.toSorted((a, b) => a - b)
    : [...values].sort((a, b) => a - b);
  return format(sorted[Math.ceil(p * sorted.length) - 1]);
}
function cell(value) {
  return String(value ?? NO_DATA)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ");
}
function table(headers, rows) {
  const data = rows.length ? rows : [headers.map(() => NO_DATA)];
  return [
    `| ${headers.map(cell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...data.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");
}
function sourceRow(label, metadata) {
  const window = metadata.window || {};
  return [
    label,
    text(metadata.source),
    text(metadata.property_id ?? metadata.propertyId ?? metadata.property),
    text(metadata.stream_id ?? metadata.streamId),
    text(metadata.retrieved_at ?? metadata.retrievedAt),
    text(window.start),
    text(window.end),
    text(window.time_zone ?? window.timeZone),
  ];
}
function taskMetrics(rows) {
  return groupRows(uniqueFacts(rows, "task_id", "Tasks")).map((group) => {
    const status = (row) => row.task_status ?? row.taskStatus ?? row.status;
    const terminal = group.rows.filter((row) =>
      ["succeeded", "failed"].includes(status(row)),
    );
    const latencies = terminal
      .map((row) => {
        if (row.latency_ms !== undefined) return number(row.latency_ms);
        const start = time(row.started_at);
        const end = time(row.completed_at);
        return start !== null && end !== null && end >= start
          ? end - start
          : null;
      })
      .filter((value) => value !== null);
    const attempts = group.rows
      .map((row) => number(row.attempt_count, true))
      .filter((value) => value !== null && value >= 1);
    const knownStatuses = group.rows.filter((row) =>
      [
        "queued",
        "processing",
        "succeeded",
        "failed",
        "expired",
        "canceled",
      ].includes(status(row)),
    );
    return [
      ...group.values,
      group.rows.length,
      quantile(latencies, 0.5),
      quantile(latencies, 0.95),
      fraction(
        terminal.filter((row) => status(row) === "failed").length,
        terminal.length,
      ),
      fraction(attempts.filter((value) => value > 1).length, attempts.length),
      knownStatuses.length === group.rows.length
        ? knownStatuses.filter((row) => status(row) === "expired").length
        : NO_DATA,
      `latency ${latencies.length}/${terminal.length} terminal; attempts ${attempts.length}/${group.rows.length}; status ${knownStatuses.length}/${group.rows.length}`,
    ];
  });
}
function purchaseMetrics(purchases, reportMetadata) {
  const quality = {};
  const rows = uniqueFacts(purchases.rows, "order_id", "Purchases", quality);
  const coverage = purchases.metadata.window || {};
  const coverageStart = time(coverage.start);
  const coverageEnd = time(coverage.end);
  const reportStart = time(reportMetadata.window?.start);
  const reportEnd = time(reportMetadata.window?.end);
  if (
    purchases.metadata.complete !== true ||
    coverageStart === null ||
    coverageEnd === null ||
    reportStart === null ||
    reportEnd === null ||
    coverageEnd <= coverageStart ||
    reportEnd <= reportStart
  ) {
    if (rows.length)
      issues.push(
        "Purchases: 30-day repeat requires complete=true, ledger coverage and a valid report cohort window.",
      );
    return [];
  }
  const usable = rows.filter(
    (row) =>
      scalar(row.customer_id) !== undefined && time(row.purchased_at) !== null,
  );
  if (usable.length !== rows.length || quality.excluded) {
    issues.push(
      "Purchases: incomplete/conflicting order identities or timestamps prevent a reliable complete-ledger repeat calculation; metric remains NO DATA.",
    );
    return [];
  }
  const customers = groupRows(usable, (row) => [String(row.customer_id)]);
  const cohort = [];
  for (const customer of customers) {
    const firsts = customer.rows.filter(
      (row) => row.is_first_purchase === true,
    );
    if (firsts.length !== 1) {
      if (firsts.length > 1)
        issues.push(
          "Purchases: excluded a customer with conflicting first-purchase assertions.",
        );
      continue;
    }
    const first = firsts[0];
    const firstAt = time(first.purchased_at);
    if (customer.rows.some((row) => time(row.purchased_at) < firstAt)) {
      issues.push(
        "Purchases: excluded a customer whose asserted first order contradicts an earlier imported order.",
      );
      continue;
    }
    if (firstAt < reportStart || firstAt >= reportEnd) continue;
    const deadline = firstAt + 30 * DAY;
    const mature = coverageStart <= firstAt && coverageEnd >= deadline;
    const repeated =
      mature &&
      customer.rows.some(
        (row) =>
          row.order_id !== first.order_id &&
          time(row.purchased_at) > firstAt &&
          time(row.purchased_at) < deadline,
      );
    cohort.push({ ...first, mature, repeated });
  }
  return groupRows(cohort).map((group) => {
    const mature = group.rows.filter((row) => row.mature);
    return [
      ...group.values,
      group.rows.length,
      mature.length,
      group.rows.length - mature.length,
      fraction(mature.filter((row) => row.repeated).length, mature.length),
    ];
  });
}
function costMetrics(rows) {
  const quality = {};
  const facts = uniqueFacts(rows, "cost_id", "Costs", quality);
  if (quality.excluded) {
    issues.push(
      "Costs: incomplete/conflicting identities prevent reliable totals; cost metrics remain NO DATA.",
    );
    return [];
  }
  return groupRows(facts, (row) => [
    text(row.tool_slug),
    /^[A-Za-z]{3}$/.test(String(row.currency))
      ? row.currency.toUpperCase()
      : NO_DATA,
  ]).map((group) => [
    ...group.values,
    group.rows.length,
    ...["provider_cost", "retry_cost", "storage_cost"].map((field) =>
      group.values[1] === NO_DATA ? NO_DATA : sum(group.rows, field),
    ),
    sum(group.rows, "credits_consumed", true),
  ]);
}
function gscMetrics(gsc) {
  const fields = gsc.dimensions || ["page"];
  if (!Array.isArray(fields) || !fields.includes("page")) {
    if (gsc.rows.length)
      issues.push("GSC: page must be included in the exported dimensions.");
    return [];
  }
  const normalized = [];
  let invalidKeys = 0;
  for (const row of gsc.rows) {
    const record = { ...row };
    fields.forEach((field, index) => {
      record[field] = scalar(row.keys?.[index] ?? row[field]);
    });
    if (fields.some((field) => scalar(record[field]) === undefined)) {
      invalidKeys += 1;
      continue;
    }
    normalized.push({
      ...record,
      _key: JSON.stringify(fields.map((field) => record[field])),
    });
  }
  const quality = {};
  const facts = uniqueFacts(normalized, "_key", "GSC", quality);
  if (invalidKeys || quality.excluded) {
    issues.push(
      "GSC: incomplete/conflicting dimension keys prevent reliable page totals; metrics remain NO DATA.",
    );
    return [];
  }
  return groupRows(facts, (row) => [text(row.page)]).map((group) => {
    const clicks = group.rows.map((row) => number(row.clicks, true));
    const impressions = group.rows.map((row) => number(row.impressions, true));
    const totalClicks = clicks.reduce((a, b) => a + (b ?? 0), 0);
    const totalImpressions = impressions.reduce((a, b) => a + (b ?? 0), 0);
    const complete =
      clicks.every((value) => value !== null) &&
      impressions.every((value) => value !== null);
    const positionComplete = impressions.every(
      (count, index) =>
        count !== null &&
        (count === 0 || (number(group.rows[index].position) ?? 0) > 0),
    );
    const weightedPosition =
      positionComplete && totalImpressions > 0
        ? format(
            group.rows.reduce(
              (total, row, index) =>
                total + (impressions[index] || 0) * (number(row.position) || 0),
              0,
            ) / totalImpressions,
          )
        : NO_DATA;
    return [
      ...group.values,
      sum(group.rows, "impressions", true),
      sum(group.rows, "clicks", true),
      complete && totalImpressions > 0 && totalClicks <= totalImpressions
        ? `${((100 * totalClicks) / totalImpressions).toFixed(2)}%`
        : NO_DATA,
      weightedPosition,
    ];
  });
}

function buildReport(input, inputPath) {
  const metadata = input?.metadata || input?.events?.metadata || {};
  const events = normalizeEvents(input);
  const tasks = dataset(input?.tasks);
  const purchases = dataset(input?.purchases);
  const costs = dataset(input?.costs);
  const gsc = { ...dataset(input?.gsc), dimensions: input?.gsc?.dimensions };
  const totals = groupRows(events, (row) => [row.eventName]).map((group) => [
    ...group.values,
    sum(group.rows, "count", true),
  ]);
  const funnel = groupRows(events).map((group) => [
    ...group.values,
    NO_DATA,
    NO_DATA,
    ...STAGES.map(([, aliases]) =>
      sum(
        group.rows.filter((row) => aliases.includes(row.eventName)),
        "count",
        true,
      ),
    ),
  ]);
  const missing = DIMENSIONS.map((field, index) => [
    field,
    events.length
      ? events.filter((row) => dimensions(row)[index] === NO_DATA).length
      : NO_DATA,
  ]);
  const taskRows = taskMetrics(tasks.rows);
  const purchaseRows = purchaseMetrics(purchases, metadata);
  const costRows = costMetrics(costs.rows);
  const gscRows = gscMetrics(gsc);
  const lines = [
    "# Weekly funnel report",
    "",
    `- Generated at: ${cell(process.env.FUNNEL_RETRIEVED_AT || new Date().toISOString())}`,
    `- Import file: ${cell(inputPath || NO_DATA)}`,
    "- Scope: offline imported observations; no GA4, GSC, payment, provider or database connection was made.",
    "",
    "## Sources and windows",
    "",
    "All window starts are inclusive and ends exclusive. A missing source, retrieval time or query boundary is NO DATA, not a zero-traffic conclusion.",
    "",
    table(
      [
        "Dataset",
        "Source",
        "Property",
        "Stream",
        "Retrieved at",
        "Window start",
        "Window end",
        "Time zone",
      ],
      [
        sourceRow("Events / report cohort", metadata),
        sourceRow("Tasks", tasks.metadata),
        sourceRow("Purchases", purchases.metadata),
        sourceRow("Costs", costs.metadata),
        sourceRow("GSC", gsc.metadata),
      ],
    ),
    "",
    "## Counting contract",
    "",
    "Counts below are event occurrences, not users, sessions or user conversion rates. No event-count ratio is labeled a conversion rate. Missing stages remain NO DATA; an explicit numeric zero in the import is preserved.",
    "",
    "Raw flat events count once per record. Identical raw records with the same eventName + event_id are deduplicated; conflicting records for that key are excluded. Raw events without event_id cannot be deduplicated. Explicit eventCount/count and GA rows are aggregates and are never deduplicated or treated as user-level records; their upstream deduplication is unverified. The funnel maps only the compatibility pairs processing_started/task_processing, processing_completed/task_succeeded, and processing_failed/task_failed; other event names remain separate in totals.",
    "",
    "Dimensions preserve exported attribution. NO DATA dimensions remain in their own group; no locale, auth state or tool is guessed from a URL. Event aggregates are assumed to describe their declared query window; the script does not infer a query window from timestamps.",
    "",
    "## Event totals",
    "",
    table(["Event", "Imported event count"], totals),
    "",
    "## Funnel by page / tool / locale / authentication",
    "",
    table(
      [
        "Page",
        "Tool",
        "Locale",
        "Auth",
        "Impressions",
        "Visits",
        ...STAGES.map(([label]) => label),
      ],
      funnel,
    ),
    "",
    "## Task reliability",
    "",
    "One non-conflicting task_id is one imported logical task. Latency uses explicit latency_ms, otherwise completed_at minus started_at, for succeeded/failed tasks only; p50/p95 use the nearest-rank method in milliseconds. Failure = failed / (succeeded + failed). Retry = attempt_count > 1 / tasks with known positive integer attempt_count. Coverage exposes partial samples; these are imported-cohort rates, not inferred site-wide rates. Canceled/expired tasks are excluded from the failure denominator.",
    "",
    table(
      [
        "Page",
        "Tool",
        "Locale",
        "Auth",
        "Task facts",
        "p50 ms",
        "p95 ms",
        "Failed / terminal",
        "Retried / known attempts",
        "Expired facts",
        "Coverage",
      ],
      taskRows,
    ),
    "",
    "## First-purchase cohort and 30-day repeat",
    "",
    "Only ledger-asserted is_first_purchase=true orders in the report window define a customer cohort. A distinct later order must occur before first purchase + 30 days. Repeat uses distinct mature customers with complete ledger coverage of the entire follow-up interval; immature customers are shown separately. Without complete coverage or first-purchase assertions this metric is NO DATA. Customer/order identifiers are not printed.",
    "",
    table(
      [
        "First-order page",
        "Tool",
        "Locale",
        "Auth",
        "Asserted first customers",
        "Mature customers",
        "Immature customers",
        "30-day repeat / mature",
      ],
      purchaseRows,
    ),
    "",
    "## Imported costs",
    "",
    "One cost_id is one cost fact. Sums are grouped by tool and currency; provider cost excludes separately supplied retry/storage cost. A missing component makes that component NO DATA with its known subtotal. These observations do not approve paid output or establish margin/credit pricing.",
    "",
    table(
      [
        "Tool",
        "Currency",
        "Cost facts",
        "Provider cost",
        "Retry cost",
        "Storage cost",
        "Credits consumed",
      ],
      costRows,
    ),
    "",
    "## Search Console by page",
    "",
    "GSC rows use the declared dimension key for deduplication before page aggregation. CTR = clicks / impressions only when both fields are complete and impressions > 0. Position is impression-weighted, never a simple average. Search clicks are not GA visits or users.",
    "",
    table(
      ["Page", "Impressions", "Clicks", "CTR", "Weighted position"],
      gscRows,
    ),
    "",
    "## Data quality and unimplemented measures",
    "",
    "Missing dimension counts refer to accepted imported event rows, not estimated missing events.",
    "",
    table(["Missing event field", "Rows"], missing),
    "",
    `- Raw event records without event_id: ${events.length ? events.filter((row) => !row.aggregate && scalar(row.event_id) === undefined).length : NO_DATA}.`,
    "- Visits, distinct users, active_users_30d and user-level funnel conversion: NO DATA; identity/session cohorts are not implemented.",
    "- missing_event_count: NO DATA; no authoritative expected-event manifest is imported.",
    "- Revenue/margin, cost per successful output, approved credit cost and cross-source attribution joins: NO DATA; not implemented by this report.",
    "- Empty or unavailable imports do not establish zero traffic, zero failures, or no purchases.",
    ...issues.map((issue) => `- ${cell(issue)}`),
    "",
  ];
  return lines.join("\n");
}

const inputPath = process.argv[2] || process.env.FUNNEL_INPUT;
const outputPath = process.argv[3] || process.env.FUNNEL_OUTPUT;
if (inputPath === "--help") {
  process.stdout.write(
    "Usage: node scripts/weekly-funnel-report.mjs [input.json] [report.md]\nOffline imports only. Contract: openspec/changes/p0-growth-funnel-foundation/weekly-report-input-contract.md\n",
  );
} else {
  try {
    const input =
      inputPath && fs.existsSync(inputPath)
        ? JSON.parse(fs.readFileSync(inputPath, "utf8"))
        : null;
    if (input === null)
      issues.push(
        "Input is unavailable; all absent observations remain NO DATA.",
      );
    const report = buildReport(input, inputPath);
    if (outputPath) fs.writeFileSync(outputPath, report);
    else process.stdout.write(report);
  } catch (error) {
    process.stderr.write(`Weekly report import failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
