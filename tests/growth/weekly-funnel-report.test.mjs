import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const script = path.join(root, "scripts/weekly-funnel-report.mjs");
const fixtures = path.join(root, "tests/fixtures/weekly-report");

function reportFor(name) {
  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "remove-anything-weekly-"),
  );
  const output = path.join(outputDir, `${name}.md`);
  const result = spawnSync(
    process.execPath,
    [script, path.join(fixtures, `${name}.json`), output],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return fs.readFileSync(output, "utf8");
}

function reportFromInput(input) {
  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "remove-anything-weekly-input-"),
  );
  const inputPath = path.join(outputDir, "input.json");
  const outputPath = path.join(outputDir, "report.md");
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const result = spawnSync(process.execPath, [script, inputPath, outputPath], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return fs.readFileSync(outputPath, "utf8");
}

const REPORT_WINDOW = {
  start: "2026-10-01T00:00:00Z",
  end: "2026-10-08T00:00:00Z",
  time_zone: "UTC",
};

function provenance(overrides = {}) {
  return {
    source: "test export",
    retrieved_at: "2026-10-08T01:00:00Z",
    property_id: "property-test",
    stream_id: "stream-test",
    window: { ...REPORT_WINDOW },
    ...overrides,
  };
}

function metricDimensions(overrides = {}) {
  return {
    landing_page: "/remove-background",
    tool_slug: "remove-background",
    locale: "en",
    is_authenticated: false,
    ...overrides,
  };
}

function tableRows(report, section) {
  const lines = report
    .split(`## ${section}\n`)[1]
    .split("\n## ")[0]
    .split("\n")
    .filter((line) => line.startsWith("|"));
  const cells = (line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((value) => value.trim());
  const headers = cells(lines[0]);
  return lines
    .slice(2)
    .map((line) =>
      Object.fromEntries(
        cells(line).map((value, index) => [headers[index], value]),
      ),
    );
}

test("complete fixture preserves grouping, deduplication, reliability, repeat, cost, and GSC semantics", () => {
  const report = reportFor("complete");
  assert.match(report, /\| tool_view \| 4 \|/); // 3 aggregate/records + one explicit zero; identical event_id duplicate removed.
  const funnel = tableRows(
    report,
    "Funnel by page / tool / locale / authentication",
  );
  const background = funnel.find(
    (row) => row.Tool === "remove-background" && row.Auth === "anonymous",
  );
  assert.deepEqual(
    [
      background.tool_view,
      background.upload_started,
      background.task_created,
      background.processing_completed,
      background.Impressions,
      background.Visits,
    ],
    ["4", "1", "1", "1", "NO DATA", "NO DATA"],
  );
  const watermark = funnel.find((row) => row.Tool === "remove-watermark");
  assert.equal(
    watermark.tool_view,
    "0",
    "explicit zero survives, while absent stages remain unavailable",
  );
  assert.equal(watermark.processing_completed, "NO DATA");
  assert.match(report, /\| 200 \| 400 \| 1\/4 \(25\.00%\) \| 2\/4 \(50\.00%\)/);
  assert.match(report, /\| 3 \| 2 \| 1 \| 1\/2 \(50\.00%\)/);
  assert.match(
    report,
    /remove-background \| USD \| 2 \| 0\.03 \| 0\.01 \| 0\.001 \| 4/,
  );
  assert.match(
    report,
    /remove-background \| 300 \| 30 \| 10\.00% \| 3\.333333/,
  );
  assert.match(
    report,
    /Counts below are event occurrences, not users, sessions or user conversion rates/,
  );
  assert.match(report, /Visits use only imported session_count rows/);
  assert.match(
    report,
    /Missing events: NO DATA; provide an expected_events manifest/,
  );
  assert.match(
    report,
    /Distinct users, active_users_30d and user-level funnel conversion remain NO DATA/,
  );
});

test("complete session aggregates populate visits only for exact explicit dimensions", () => {
  const report = reportFromInput({
    metadata: provenance(),
    events: {
      metadata: provenance({ complete: true }),
      rows: [
        {
          eventName: "tool_view",
          ...metricDimensions(),
          count: 2,
        },
      ],
    },
    sessions: {
      metadata: provenance(),
      rows: [
        { ...metricDimensions(), session_count: 8 },
        {
          ...metricDimensions({
            landing_page: "/remove-watermark",
            tool_slug: "remove-watermark",
            locale: "zh-tw",
            is_authenticated: true,
          }),
          session_count: 0,
        },
      ],
    },
  });
  const funnel = tableRows(
    report,
    "Funnel by page / tool / locale / authentication",
  );
  assert.equal(
    funnel.find((row) => row.Tool === "remove-background").Visits,
    "8",
  );
  assert.equal(
    funnel.find((row) => row.Tool === "remove-watermark").Visits,
    "0",
  );
  assert.match(
    report,
    /Visits use only imported session_count rows with exact page\/tool\/locale\/auth dimensions/,
  );
});

test("session visits fail closed for missing dimensions, conflicting rows, and mismatched windows", () => {
  const metadata = provenance();
  const base = {
    metadata,
    events: [
      { eventName: "tool_view", ...metricDimensions(), event_id: "view-1" },
    ],
  };

  const missingDimensions = reportFromInput({
    ...base,
    sessions: {
      metadata: provenance(),
      rows: [{ landing_page: "/remove-background", session_count: 3 }],
    },
  });
  assert.match(
    missingDimensions,
    /Visits: NO DATA; 1 row\(s\) lack explicit dimensions/,
  );
  assert.equal(
    tableRows(
      missingDimensions,
      "Funnel by page / tool / locale / authentication",
    )[0].Visits,
    "NO DATA",
  );

  const conflicting = reportFromInput({
    ...base,
    sessions: {
      metadata: provenance(),
      rows: [
        { ...metricDimensions(), session_count: 3 },
        { ...metricDimensions(), session_count: 4 },
      ],
    },
  });
  assert.match(
    conflicting,
    /0 row\(s\) lack explicit dimensions.*1 dimension group\(s\) have conflicting counts/,
  );
  assert.equal(
    tableRows(conflicting, "Funnel by page / tool / locale / authentication")[0]
      .Visits,
    "NO DATA",
  );

  const mismatchedWindow = reportFromInput({
    ...base,
    sessions: {
      metadata: provenance({
        window: {
          ...REPORT_WINDOW,
          end: "2026-10-09T00:00:00Z",
        },
      }),
      rows: [{ ...metricDimensions(), session_count: 3 }],
    },
  });
  assert.match(
    mismatchedWindow,
    /Visits: NO DATA; the sessions dataset must declare the exact report window and time zone/,
  );
});

test("missing event counts require complete imports, matching provenance, and conflict-free exact dimensions", () => {
  const dimensions = metricDimensions();
  const report = reportFromInput({
    metadata: provenance(),
    events: {
      metadata: provenance({ complete: true }),
      rows: [
        { eventName: "tool_view", ...dimensions, count: 2 },
        { eventName: "upload_started", ...dimensions, count: 1 },
      ],
    },
    expected_events: {
      metadata: provenance({ complete: true }),
      rows: [
        { eventName: "tool_view", ...dimensions, expected_count: 3 },
        { eventName: "upload_started", ...dimensions, expected_count: 1 },
        { eventName: "processing_completed", ...dimensions, expected_count: 0 },
      ],
    },
  });
  const funnel = tableRows(
    report,
    "Funnel by page / tool / locale / authentication",
  );
  assert.equal(funnel[0]["Missing events"], "1");
  assert.match(
    report,
    /Missing events are expected_count minus observed event counts/,
  );

  const incompleteExpected = reportFromInput({
    metadata: provenance(),
    events: {
      metadata: provenance({ complete: true }),
      rows: [{ eventName: "tool_view", ...dimensions, count: 2 }],
    },
    expected_events: {
      metadata: provenance({ complete: false }),
      rows: [{ eventName: "tool_view", ...dimensions, expected_count: 3 }],
    },
  });
  assert.match(
    incompleteExpected,
    /Missing events: NO DATA; expected_events metadata must declare complete=true/,
  );
  assert.equal(
    tableRows(
      incompleteExpected,
      "Funnel by page / tool / locale / authentication",
    )[0]["Missing events"],
    "NO DATA",
  );

  const incompleteEvents = reportFromInput({
    metadata: provenance(),
    events: {
      metadata: provenance({ complete: false }),
      rows: [{ eventName: "tool_view", ...dimensions, count: 2 }],
    },
    expected_events: {
      metadata: provenance({ complete: true }),
      rows: [{ eventName: "tool_view", ...dimensions, expected_count: 3 }],
    },
  });
  assert.match(
    incompleteEvents,
    /Missing events: NO DATA; events metadata must declare complete=true/,
  );

  const conflictingExpected = reportFromInput({
    metadata: provenance(),
    events: {
      metadata: provenance({ complete: true }),
      rows: [{ eventName: "tool_view", ...dimensions, count: 2 }],
    },
    expected_events: {
      metadata: provenance({ complete: true }),
      rows: [
        { eventName: "tool_view", ...dimensions, expected_count: 3 },
        { eventName: "tool_view", ...dimensions, expected_count: 4 },
      ],
    },
  });
  assert.match(
    conflictingExpected,
    /Missing events: NO DATA; 0 manifest row\(s\).*1 event\/dimension key\(s\) conflict/,
  );

  const mismatchedWindow = reportFromInput({
    metadata: provenance(),
    events: {
      metadata: provenance({ complete: true }),
      rows: [{ eventName: "tool_view", ...dimensions, count: 2 }],
    },
    expected_events: {
      metadata: provenance({
        complete: true,
        window: { ...REPORT_WINDOW, end: "2026-10-09T00:00:00Z" },
      }),
      rows: [{ eventName: "tool_view", ...dimensions, expected_count: 3 }],
    },
  });
  assert.match(
    mismatchedWindow,
    /Missing events: NO DATA; events, expected_events, and report metadata must declare the same valid start, end, and time zone/,
  );
});

test("complete empty event export uses zero observed counts for explicit expectations", () => {
  const report = reportFromInput({
    metadata: provenance(),
    events: {
      metadata: provenance({ complete: true }),
      rows: [
        {
          ...metricDimensions({
            landing_page: "/remove-watermark",
            tool_slug: "remove-watermark",
          }),
          eventName: "tool_view",
          count: 1,
        },
      ],
    },
    expected_events: {
      metadata: provenance({ complete: true }),
      rows: [
        {
          ...metricDimensions(),
          eventName: "tool_view",
          expected_count: 2,
        },
        {
          ...metricDimensions({
            landing_page: "/remove-watermark",
            tool_slug: "remove-watermark",
          }),
          eventName: "upload_started",
          expected_count: 0,
        },
      ],
    },
  });
  const funnel = tableRows(
    report,
    "Funnel by page / tool / locale / authentication",
  );
  assert.equal(
    funnel.find((row) => row.Tool === "remove-background")["Missing events"],
    "2",
  );
  assert.equal(
    funnel.find((row) => row.Tool === "remove-watermark")["Missing events"],
    "0",
  );

  const unmanifested = reportFromInput({
    metadata: provenance(),
    events: {
      metadata: provenance({ complete: true }),
      rows: [
        {
          ...metricDimensions({
            landing_page: "/remove-watermark",
            tool_slug: "remove-watermark",
          }),
          eventName: "tool_view",
          count: 1,
        },
      ],
    },
    expected_events: {
      metadata: provenance({ complete: true }),
      rows: [
        {
          ...metricDimensions(),
          eventName: "tool_view",
          expected_count: 1,
        },
      ],
    },
  });
  assert.equal(
    tableRows(
      unmanifested,
      "Funnel by page / tool / locale / authentication",
    ).find((row) => row.Tool === "remove-watermark")["Missing events"],
    "NO DATA",
  );
});

test("GA4 dimensions follow headers and missing aggregate counts remain NO DATA", () => {
  const report = reportFor("ga-reordered");
  const funnel = tableRows(
    report,
    "Funnel by page / tool / locale / authentication",
  );
  const watermark = funnel.find(
    (row) => row.Page === "/zh-tw/remove-watermark",
  );
  assert.deepEqual(
    [watermark.Locale, watermark.Auth, watermark.tool_view],
    ["zh-tw", "authenticated", "7"],
  );
  const background = funnel.find((row) => row.Locale === "en");
  assert.deepEqual(
    [background.Page, background.Tool, background.Auth, background.tool_view],
    ["/remove-background", "remove-background", "anonymous", "11"],
  );
  assert.match(
    report,
    /task_succeeded \| NO DATA \(known subtotal 0; 0\/1 rows numeric\)/,
  );
  assert.doesNotMatch(report, /18.*users/);
});

test("sparse and unavailable inputs expose NO DATA instead of inventing zeros", () => {
  const sparse = reportFor("sparse");
  assert.match(
    sparse,
    /task_succeeded \| NO DATA \(known subtotal 0; 0\/1 rows numeric\)/,
  );
  assert.match(sparse, /30-day repeat requires complete=true/);
  assert.match(sparse, /\| remove-objects \| NO DATA \| 1 \| NO DATA \|/);

  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "remove-anything-weekly-missing-"),
  );
  const output = path.join(outputDir, "missing.md");
  const result = spawnSync(
    process.execPath,
    [script, path.join(outputDir, "missing.json"), output],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0);
  const missing = fs.readFileSync(output, "utf8");
  assert.match(missing, /Input is unavailable/);
  assert.match(
    missing,
    /Empty or unavailable imports do not establish zero traffic, zero failures, or no purchases/,
  );
});

test("conflicting identities are excluded and unnamed GA rows are rejected", () => {
  const conflicts = reportFor("conflicts");
  assert.match(conflicts, /Events: excluded all records for 1 conflicting _id/);
  assert.match(
    conflicts,
    /Tasks: excluded all records for 1 conflicting task_id/,
  );
  assert.match(
    conflicts,
    /Costs: incomplete\/conflicting identities prevent reliable totals/,
  );
  assert.match(
    conflicts,
    /GSC: incomplete\/conflicting dimension keys prevent reliable page totals/,
  );
  assert.match(
    conflicts,
    /incomplete\/conflicting order identities or timestamps prevent a reliable complete-ledger repeat calculation/,
  );

  const unnamed = reportFor("unnamed-ga");
  assert.match(unnamed, /excluded 1 GA row\(s\) without dimensionHeaders/);
  assert.match(unnamed, /\| NO DATA \| NO DATA \|/);
});
