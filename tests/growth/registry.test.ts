import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPaidToolEnabled,
  getIndexableTools,
  getRelatedToolRegistryEntries,
  getToolRegistryEntry,
  hasApprovedCreditCost,
  isPaidToolEnabled,
  toolRegistry,
  type ToolRegistryEntry,
} from "../../lib/tool-registry";

test("registry entries have unique identity and complete release metadata", () => {
  const slugs = toolRegistry.map((entry) => entry.slug);
  const paths = toolRegistry.map((entry) => entry.canonicalPath);

  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(new Set(paths).size, paths.length);

  for (const entry of toolRegistry) {
    assert.match(entry.canonicalPath, /^\//);
    assert.ok(entry.primaryKeyword.length > 0);
    assert.ok(entry.availableLocales.length > 0);
    assert.ok(entry.inputFormats.length > 0);
    assert.ok(entry.outputFormats.length > 0);
    assert.ok(entry.limits.maxFileSizeMb > 0);
    assert.ok(entry.limits.maxFiles > 0);
    assert.ok(entry.lastModified.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(entry.resultExpiryHours > 0);
    assert.ok(entry.sitemapPriority > 0 && entry.sitemapPriority <= 1);

    if (entry.paidEnabled) assert.ok(hasApprovedCreditCost(entry));
  }
});

test("a positive baseline cannot enable paid output without a recorded cost decision", () => {
  const removeBackground = getToolRegistryEntry("remove-background")!;
  assert.equal(removeBackground.creditCost, 2);
  assert.equal(hasApprovedCreditCost(removeBackground), true);
  assert.equal(isPaidToolEnabled(removeBackground), true);
  assert.equal(assertPaidToolEnabled(removeBackground).slug, "remove-background");

  // Strip the recorded approval to prove paidEnabled alone is insufficient.
  const { costApproval: _ignored, ...withoutApproval } = removeBackground;
  const baseline: ToolRegistryEntry = {
    ...withoutApproval,
    paidEnabled: false,
  };
  assert.equal(hasApprovedCreditCost(baseline), false);
  assert.equal(isPaidToolEnabled({ ...baseline, paidEnabled: true }), false);
  assert.throws(() => assertPaidToolEnabled(baseline), /approved credit cost/);

  const approved: ToolRegistryEntry = {
    ...baseline,
    paidEnabled: true,
    costApproval: {
      creditCost: 2,
      approvedBy: "Test cost owner",
      approvedAt: "2026-10-15",
      evidenceReference: "test-fixture-only",
    },
  };
  assert.equal(isPaidToolEnabled(approved), true);
  assert.equal(isPaidToolEnabled({ ...approved, creditCost: 3 }), false);
  for (const field of [
    "approvedBy",
    "approvedAt",
    "evidenceReference",
  ] as const) {
    assert.equal(
      isPaidToolEnabled({
        ...approved,
        costApproval: { ...approved.costApproval!, [field]: "" },
      }),
      false,
    );
  }
});

test("remove-objects is indexable and resolves by slug or canonical path", () => {
  const bySlug = getToolRegistryEntry("remove-objects");
  const byPath = getToolRegistryEntry("/remove-objects");

  assert.equal(bySlug?.canonicalPath, "/remove-objects");
  assert.equal(bySlug?.indexable, true);
  assert.deepEqual(byPath, bySlug);
  assert.ok(
    getIndexableTools().some((entry) => entry.slug === "remove-objects"),
  );
});

test("related links point only to existing indexable tools", () => {
  for (const entry of toolRegistry) {
    const related = getRelatedToolRegistryEntries(entry.slug);
    assert.deepEqual(
      related.map((item) => item.slug),
      entry.relatedSlugs,
      `${entry.slug} has a stale or non-indexable related-tool reference`,
    );
  }
});
