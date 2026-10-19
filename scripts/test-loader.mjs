import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as ts from "typescript";

const root = process.cwd();

function candidates(filePath) {
  return [
    filePath,
    `${filePath}.ts`,
    `${filePath}.tsx`,
    `${filePath}.js`,
    `${filePath}.mjs`,
    path.join(filePath, "index.ts"),
    path.join(filePath, "index.tsx"),
    path.join(filePath, "index.js"),
  ];
}

async function resolveFile(filePath) {
  for (const candidate of candidates(filePath)) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // Keep checking the next extension.
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // Next's server-only marker is a build-time boundary. In a Node unit test
  // there is no client/server graph, so an empty module is the correct shim.
  if (specifier === "server-only") {
    return {
      url: "data:text/javascript,export default undefined;",
      shortCircuit: true,
    };
  }

  // Exercise the actual download route while replacing only its application
  // boundaries. Ownership, expiry, signed principal, and event builders remain
  // real code; database, auth, storage, and transport are deterministic fakes.
  const parentPath = context.parentURL?.startsWith("file:")
    ? fileURLToPath(context.parentURL)
    : "";
  if (parentPath === path.join(root, "app/api/webhooks/runninghub/route.ts")) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set(["@/db/prisma", "@/env.mjs", "@/lib/task-queue"]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/runninghub-webhook-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (parentPath === path.join(root, "lib/task-queue.ts")) {
    if (
      new Set([
        "@/db/prisma",
        "@/config/constants",
        "@/modules/runninghub",
        "@/lib/background-task-status",
        "@/lib/task-lifecycle",
      ]).has(specifier) ||
      specifier === "./task-processor"
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/task-queue-watcher-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    parentPath === path.join(root, "lib/runninghub-output.ts") &&
    new Set(["@/env.mjs", "@/lib/r2-s3"]).has(specifier)
  ) {
    return {
      url: pathToFileURL(
        path.join(root, "tests/support/runninghub-webhook-stubs.ts"),
      ).href,
      shortCircuit: true,
    };
  }
  if (
    new Set([
      path.join(root, "app/api/download-background/route.ts"),
      path.join(root, "app/api/download/route.ts"),
    ]).has(parentPath)
  ) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/db/queries/background-removal",
        "@/lib/auth-utils",
        "@/lib/handle-error",
        "@/lib/kv",
        "../_cloudflare-adapter",
        "@/lib/hashid",
        "@/db/prisma",
        "@/env.mjs",
        "@/lib/r2-s3",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/legacy-download-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (parentPath === path.join(root, "app/api/download-object/route.ts")) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (
      new Set([
        "@/db/queries/object-removal",
        "@/env.mjs",
        "@/lib/auth-utils",
        "@/lib/handle-error",
        "@/lib/r2-s3",
        "@/lib/analytics-events",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/download-route-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (parentPath === path.join(root, "app/api/webhooks/stripe/route.ts")) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (
      new Set([
        "@/lib/stripe",
        "@/env.mjs",
        "@/lib/analytics-events",
        "@/lib/handle-error",
        "@/env.mjs",
        "@/lib/runninghub-output",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/payment-webhook-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    parentPath === path.join(root, "lib/hashid.ts") &&
    specifier === "@/env.mjs"
  ) {
    return {
      url: pathToFileURL(
        path.join(root, "tests/support/payment-webhook-stubs.ts"),
      ).href,
      shortCircuit: true,
    };
  }
  if (parentPath === path.join(root, "app/api/cron/cleanup-tasks/route.ts")) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (specifier === "@/lib/r2-s3") {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/retention-route-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (parentPath === path.join(root, "app/api/generate/route.ts")) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/lib/auth-utils",
        "@/lib/handle-error",
        "@/lib/kv",
        "@/env.mjs",
        "@/modules/runninghub",
        "@/lib/r2-s3",
        "@/lib/task-queue",
        "@/db/queries/account",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/generate-route-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    parentPath === path.join(root, "app/api/batch-remove-background/route.ts")
  ) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/lib/auth-utils",
        "@/lib/handle-error",
        "@/lib/kv",
        "@/lib/ai-gateway",
        "@/db/queries/background-removal",
        "@/db/queries/account",
        "@/db/prisma",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/batch-route-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    new Set([
      path.join(root, "app/api/background-composition/route.ts"),
      path.join(root, "app/api/background-images/route.ts"),
    ]).has(parentPath)
  ) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/lib/auth-utils",
        "@/db/prisma",
        "@/lib/upload",
        "@/lib/handle-error",
      ]).has(specifier)
    ) {
      const stub = parentPath.endsWith("background-composition/route.ts")
        ? "background-composition-route-stubs.ts"
        : "background-images-route-stubs.ts";
      return {
        url: pathToFileURL(path.join(root, "tests/support", stub)).href,
        shortCircuit: true,
      };
    }
  }
  if (
    new Set([
      path.join(root, "app/api/upload/route.ts"),
      path.join(root, "app/api/remove-objects/assets/route.ts"),
    ]).has(parentPath)
  ) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set(["@/lib/auth-utils", "@/lib/handle-error", "@/lib/upload"]).has(
        specifier,
      )
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/image-input-route-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    new Set([
      path.join(root, "app/api/watermark-removal/route.ts"),
      path.join(root, "app/api/remove-objects/route.ts"),
    ]).has(parentPath)
  ) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/lib/auth-utils",
        "@/lib/handle-error",
        "@/db/queries/watermark-removal",
        "@/db/queries/object-removal",
        "@/modules/runninghub",
        "@/lib/upload",
        "@/lib/remove-objects/runninghub",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/image-task-route-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    new Set([
      path.join(root, "app/api/remove-objects/detect/route.ts"),
      path.join(root, "app/api/remove-objects/segment/route.ts"),
    ]).has(parentPath)
  ) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set(["@/lib/handle-error", "@/modules/runninghub"]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/object-geometry-route-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    new Set([
      path.join(root, "app/api/task/[id]/route.ts"),
      path.join(root, "app/api/task-status-stream/[taskId]/route.ts"),
      path.join(root, "lib/background-task-status.ts"),
    ]).has(parentPath)
  ) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/db/queries/background-removal",
        "@/modules/runninghub",
        "@/lib/auth-utils",
        "@/lib/handle-error",
        "@/env.mjs",
        "@/lib/runninghub-output",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/background-status-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    parentPath === path.join(root, "app/api/watermark-removal/[id]/route.ts")
  ) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/db/queries/watermark-removal",
        "@/db/prisma",
        "@/env.mjs",
        "@/lib/runninghub-output",
        "@/modules/runninghub",
        "@/lib/auth-utils",
        "@/lib/handle-error",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/watermark-status-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (parentPath === path.join(root, "app/api/remove-objects/[id]/route.ts")) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/db/queries/object-removal",
        "@/db/prisma",
        "@/lib/auth-utils",
        "@/lib/handle-error",
        "@/modules/runninghub",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/object-status-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    parentPath === path.join(root, "lib/remove-objects/output-image.ts") &&
    new Set(["@/env.mjs", "@/lib/runninghub-output"]).has(specifier)
  ) {
    return {
      url: pathToFileURL(
        path.join(root, "tests/support/object-status-stubs.ts"),
      ).href,
      shortCircuit: true,
    };
  }
  if (parentPath === path.join(root, "app/api/webhooks/task/route.ts")) {
    if (specifier === "next/server")
      return nextResolve("next/server.js", context);
    if (
      new Set([
        "@/env.mjs",
        "@/lib/handle-error",
        "@/lib/log-snag",
        "@/lib/analytics-events",
      ]).has(specifier)
    ) {
      return {
        url: pathToFileURL(
          path.join(root, "tests/support/task-refund-stubs.ts"),
        ).href,
        shortCircuit: true,
      };
    }
  }
  if (
    parentPath === path.join(root, "lib/task-lifecycle.ts") &&
    specifier === "@/lib/analytics-events"
  ) {
    return {
      url: pathToFileURL(path.join(root, "tests/support/task-refund-stubs.ts"))
        .href,
      shortCircuit: true,
    };
  }

  let candidate;
  if (specifier.startsWith("@/")) {
    // Keep lifecycle tests hermetic: they replace the Prisma singleton with a
    // small in-memory fake before importing the module under test.
    candidate =
      specifier === "@/db/prisma"
        ? await resolveFile(path.join(root, "tests/support/prisma-stub"))
        : await resolveFile(path.join(root, specifier.slice(2)));
  } else if (
    specifier.startsWith(".") &&
    context.parentURL?.startsWith("file:")
  ) {
    candidate = await resolveFile(
      path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier),
    );
  }

  if (candidate) {
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:")) return nextLoad(url, context);

  const filePath = fileURLToPath(url);
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
    return nextLoad(url, context);
  }

  const source = await fs.readFile(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      sourceMap: false,
      inlineSourceMap: false,
    },
    fileName: filePath,
  });

  return {
    format: "module",
    source: transpiled.outputText,
    shortCircuit: true,
  };
}
