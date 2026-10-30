import assert from "node:assert/strict";
import test from "node:test";

import { getBackgroundToolAnalyticsSlug } from "@/lib/background-tool-analytics";

test("maps background marketing variants to registry tool slugs", () => {
  assert.equal(getBackgroundToolAnalyticsSlug("remove-background"), "remove-background");
  assert.equal(getBackgroundToolAnalyticsSlug("transparent-png"), "transparent-png-maker");
  assert.equal(getBackgroundToolAnalyticsSlug("white-background"), "white-background-maker");
  assert.equal(
    getBackgroundToolAnalyticsSlug("change-background-color"),
    "change-background-color",
  );
});
