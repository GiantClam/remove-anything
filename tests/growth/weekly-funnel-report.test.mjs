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
  assert.match(
    report,
    /Visits, distinct users, active_users_30d and user-level funnel conversion: NO DATA/,
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
