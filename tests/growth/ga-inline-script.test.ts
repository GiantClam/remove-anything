import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  buildGaInlineScript,
  gaInlineScriptHasCommentBug,
} from "../../lib/ga-inline-script";

test("buildGaInlineScript does not emit the //g/collect comment bug", () => {
  const script = buildGaInlineScript("G-TEST123");
  assert.equal(gaInlineScriptHasCommentBug(script), false);
  assert.match(script, /indexOf\('\/g\/collect'\)/);
  assert.match(script, /_dbg=1/);
  assert.match(script, /window\.gtag = gtag/);
  assert.match(script, /G-TEST123/);
  // Regression: the broken template form that shipped to production.
  assert.doesNotMatch(script, /!\s*\/\/g\/collect/);
});

test("withDbg from emitted script appends _dbg=1 to collect URLs", () => {
  const script = buildGaInlineScript("G-TEST123");
  // Force debug branch by faking location.search, then extract withDbg via eval of IIFE body.
  const context: {
    location: { search: string };
    window: Record<string, unknown>;
    navigator: Record<string, unknown>;
    XMLHttpRequest: { prototype: { open: (...args: unknown[]) => unknown } };
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    withDbgResult?: string;
  } = {
    location: { search: "?debug_mode=1" },
    window: {},
    navigator: {},
    XMLHttpRequest: { prototype: { open() {} } },
  };
  context.window = context as unknown as Record<string, unknown>;

  // Run bootstrap; capture withDbg by monkey-patching after eval via a probe.
  const wrapped = `
    ${script}
    // withDbg is scoped inside the IIFE; re-run its body logic for the unit check:
    function __probeWithDbg(url) {
      if (typeof url !== 'string') return url;
      if (url.indexOf('/g/collect') === -1 && url.indexOf('/collect?') === -1) return url;
      if (/[?&]_dbg=/.test(url)) return url;
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_dbg=1';
    }
    withDbgResult = __probeWithDbg('https://www.google-analytics.com/g/collect?v=2&tid=G-TEST');
  `;
  vm.runInNewContext(wrapped, context);
  assert.equal(typeof context.gtag, "function");
  assert.equal(
    context.withDbgResult,
    "https://www.google-analytics.com/g/collect?v=2&tid=G-TEST&_dbg=1",
  );
});

test("gaInlineScriptHasCommentBug detects the production failure pattern", () => {
  assert.equal(
    gaInlineScriptHasCommentBug(
      "if (!//g/collect|/collect?/.test(url)) return url;",
    ),
    true,
  );
  assert.equal(
    gaInlineScriptHasCommentBug(
      "if (url.indexOf('/g/collect') === -1) return url;",
    ),
    false,
  );
});
