import { NextRequest, NextResponse } from "next/server";

import { findObjectRemovalTaskByRunningHubId } from "@/db/queries/object-removal";
import { env } from "@/env.mjs";
import {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "@/lib/analytics-events";
import { emitServerAnalyticsEvent } from "@/lib/server-analytics-events";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import {
  readLimitedResponse,
  ResultSizeLimitError,
} from "@/lib/limited-response";
import {
  createLowResolutionImage,
  LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX,
  UnsupportedOutputFormatError,
} from "@/lib/low-resolution-output";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { createR2S3Service } from "@/lib/r2-s3";
import {
  assertTaskDownloadAccess,
  getTaskPrincipalFromRequest,
  TaskLifecycleError,
} from "@/lib/task-lifecycle";
import {
  assertOutputEntitlement,
  getRequestedOutputTier,
  OutputEntitlementError,
} from "@/lib/output-entitlements";
import { getToolRegistryEntry } from "@/lib/tool-registry";

export const dynamic = "force-dynamic";

/**
 * Return an object-removal result only after checking the task owner, state,
 * and expiry. The default response is a private attachment; preview=1 keeps
 * the same authorization checks while allowing the result canvas to render.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId")?.trim();
    const preview = searchParams.get("preview") === "1";
    const outputTier = getRequestedOutputTier(searchParams.get("output"));

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing taskId parameter" },
        { status: 400 },
      );
    }

    const task = await findObjectRemovalTaskByRunningHubId(taskId);
    if (!task || !task.outputImageUrl) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const user = await getCurrentUser();
    const { userId, principalId } = getTaskPrincipalFromRequest(req, user?.id);

    try {
      assertTaskDownloadAccess(task, { userId, principalId });
    } catch (error) {
      if (error instanceof TaskLifecycleError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }
      throw error;
    }

    assertOutputEntitlement({
      toolSlug: "remove-objects",
      requestedTier: outputTier,
      userId,
    });

    // Result polling migrates provider output to R2. Never fetch arbitrary
    // persisted provider URLs from the download boundary.
    const r2Key = getR2ObjectKey(task.outputImageUrl, env.R2_URL_BASE);
    if (!r2Key) {
      return NextResponse.json(
        {
          error:
            "Result is awaiting secure storage. Refresh the task to retry.",
          code: "RESULT_MIGRATION_REQUIRED",
        },
        { status: 409 },
      );
    }
    const sourceUrl = await createR2S3Service().getSignedUrl(
      r2Key,
      env.R2_BUCKET,
      60,
    );
    const response = await fetch(sourceUrl, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: response.status === 404 ? 404 : 502 },
      );
    }

    const contentType =
      response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase() || "image/png";
    const extensions: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    const extension = extensions[contentType];
    if (!extension) {
      return NextResponse.json(
        { error: "Result is not a supported image" },
        { status: 502 },
      );
    }
    const filename = `object-removed-${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}.${extension}`;

    const maxOutputBytes =
      getToolRegistryEntry("remove-objects")!.limits.maxOutputSizeMb *
      1024 *
      1024;
    const sourceImage = await readLimitedResponse(response, maxOutputBytes);
    const image = await createLowResolutionImage(
      sourceImage,
      contentType,
      maxOutputBytes,
    );
    if (!preview) {
      try {
        await emitServerAnalyticsEvent(
          createTaskAnalyticsEvent(ANALYTICS_EVENTS.resultDownloaded, task.id, {
            tool_slug: "remove-objects",
            is_authenticated: Boolean(userId),
          }),
        );
      } catch (analyticsError) {
        console.warn("Object download analytics failed:", analyticsError);
      }
    }

    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Output-Max-Edge-Px": String(LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX),
        Vary: "Cookie, Authorization",
      },
    });
  } catch (error) {
    if (error instanceof OutputEntitlementError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnsupportedOutputFormatError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    if (error instanceof ResultSizeLimitError) {
      return NextResponse.json(
        { error: error.message, code: "RESULT_TOO_LARGE" },
        { status: 413 },
      );
    }
    console.error("Object download error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
