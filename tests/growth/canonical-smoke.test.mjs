import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const paths = [
  "/remove-background",
  "/remove-objects",
  "/transparent-png-maker",
  "/white-background-maker",
  "/change-background-color",
  "/remove-watermark",
];

async function checkSite(options = {}) {
  let origin;
  const requested = [];
  const gaId = options.gaId || "G-TEST.1";
  const loaderUrl = new URL("https://www.googletagmanager.com/gtag/js");
  loaderUrl.searchParams.set("id", options.wrongGa ? "G-TESTx1" : gaId);
  const gaMarkup = options.gaTextOnly
    ? `<script>const loader = ${JSON.stringify(loaderUrl.href)};</script>`
    : options.preload
      ? `<link rel="preload" as="${options.preloadAs || "script"}" href="${loaderUrl.href}">`
      : `<script src="${loaderUrl.href}"></script>`;
  const server = createServer((req, res) => {
    requested.push(req.url);
    if (req.url === "/sitemap.xml") {
      res.setHeader("Content-Type", "application/xml");
      res.end(
        `<sitemapindex><sitemap><loc>${options.foreign ? "https://other.test" : origin}/sitemap-tools.xml</loc></sitemap></sitemapindex>`,
      );
    } else if (req.url === "/sitemap-tools.xml") {
      res.setHeader("Content-Type", "application/xml");
      res.end(
        `<urlset>${paths
          .filter((path) => path !== options.omit)
          .map((path) => `<url><loc>${origin}${path}</loc></url>`)
          .join("")}</urlset>`,
      );
    } else if (paths.includes(req.url)) {
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<html><head><link rel="canonical" href="${origin}${req.url}">${options.noSchema ? "" : '<script type="application/ld+json">{"@type":"SoftwareApplication"}</script>'}${gaMarkup}</head><body><h1>Image tool</h1></body></html>`,
      );
    } else {
      res.statusCode = 404;
      res.end("Not found");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const child = spawn(
      process.execPath,
      ["scripts/smoke-canonical-pages.mjs"],
      {
        cwd: root,
        env: {
          ...process.env,
          SMOKE_BASE_URL: origin,
          SMOKE_GA_ID: gaId,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => child.kill(), 10_000);
    try {
      const [code] = await once(child, "exit");
      return { code, output, requested };
    } finally {
      clearTimeout(timer);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("release smoke follows a sitemap index and verifies canonical pages and the GA loader", async () => {
  const result = await checkSite();
  assert.equal(result.code, 0, result.output);
  assert.ok(result.requested.includes("/sitemap-tools.xml"));
  assert.match(result.output, /children contain 6 canonical tools/);
  assert.match(result.output, /schedules GA4 loader G-TEST\.1/);
  assert.match(
    result.output,
    /hydrated config and receipt require browser verification/,
  );
});

test("release smoke accepts an afterInteractive script preload without SSR config", async () => {
  const result = await checkSite({ preload: true });
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /schedules GA4 loader G-TEST\.1/);
});

test("release smoke fails when a required page is absent from a child sitemap", async () => {
  const result = await checkSite({ omit: "/remove-objects" });
  assert.equal(result.code, 1);
  assert.match(result.output, /children: missing \/remove-objects/);
});

test("release smoke fails on missing structured data and foreign sitemap children", async () => {
  const missingSchema = await checkSite({ noSchema: true });
  assert.equal(missingSchema.code, 1);
  assert.match(missingSchema.output, /JSON-LD structured data is missing/);
  const foreign = await checkSite({ foreign: true });
  assert.equal(foreign.code, 1);
  assert.match(foreign.output, /Sitemap points outside the checked site/);
  assert.equal(foreign.requested.includes("/sitemap-tools.xml"), false);
});

test("release smoke compares the exact GA measurement ID instead of a regex wildcard", async () => {
  const result = await checkSite({ wrongGa: true });
  assert.equal(result.code, 1);
  assert.match(result.output, /loader was not found/);
  const regexCharacters = await checkSite({
    gaId: "G-TEST.1+[x]",
    preload: true,
  });
  assert.equal(regexCharacters.code, 0, regexCharacters.output);
});

test("release smoke rejects a GA URL in script text and a preload for another resource type", async () => {
  const textOnly = await checkSite({ gaTextOnly: true });
  assert.equal(textOnly.code, 1);
  assert.match(textOnly.output, /loader was not found/);
  const imagePreload = await checkSite({ preload: true, preloadAs: "image" });
  assert.equal(imagePreload.code, 1);
  assert.match(imagePreload.output, /loader was not found/);
});
