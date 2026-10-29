import assert from "node:assert/strict";
import test from "node:test";

import {
  assertOutputEntitlement,
  getRequestedOutputTier,
  isFullOutputImplementationEnabled,
  OutputEntitlementError,
} from "../../lib/output-entitlements";

test("output tier defaults to the protected low-resolution preview", () => {
  assert.equal(getRequestedOutputTier(null), "preview");
  assert.equal(getRequestedOutputTier("preview"), "preview");
  assert.equal(getRequestedOutputTier("full"), "full");
  assert.equal(
    assertOutputEntitlement({
      toolSlug: "remove-background",
      requestedTier: "preview",
      userId: null,
    }).tier,
    "preview",
  );
});

test("anonymous full output is rejected before storage access", () => {
  assert.throws(
    () =>
      assertOutputEntitlement({
        toolSlug: "remove-background",
        requestedTier: "full",
        userId: null,
      }),
    (error: unknown) =>
      error instanceof OutputEntitlementError &&
      error.code === "FULL_OUTPUT_REQUIRES_AUTHENTICATION" &&
      error.status === 401,
  );
});

test("approved authenticated tools unlock full output when implementation is enabled", () => {
  assert.equal(isFullOutputImplementationEnabled(), true);
  const result = assertOutputEntitlement({
    toolSlug: "remove-background",
    requestedTier: "full",
    userId: "user-1",
  });
  assert.equal(result.tier, "full");
  assert.equal(result.tool.slug, "remove-background");
});

test("tools without cost approval stay blocked for full output", () => {
  // Free converters keep creditCost 0 / paidEnabled false.
  assert.throws(
    () =>
      assertOutputEntitlement({
        toolSlug: "png-to-jpg",
        requestedTier: "full",
        userId: "user-1",
      }),
    (error: unknown) =>
      error instanceof OutputEntitlementError &&
      error.code === "FULL_OUTPUT_NOT_ENABLED" &&
      error.status === 402,
  );
});
