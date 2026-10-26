import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import {
  resetSora2RouteState,
  sora2RouteState,
  TaskCreationOutcomeUnknownError,
  TaskCreationRejectedError,
} from "../support/sora2-route-stubs";

const urlRoute = import(
  "../../app/api/sora2-video-watermark-removal-url/route"
);
const r2Route = import("../../app/api/sora2-video-watermark-removal-r2/route");
const uploadRoute = import("../../app/api/sora2-video-watermark-removal/route");
const originalR2UrlBase = process.env.R2_URL_BASE;
const originalLandscapeWorkflow = process.env.SORA2_LANDSCAPE_WORKFLOW_ID;
const originalPortraitWorkflow = process.env.SORA2_PORTRAIT_WORKFLOW_ID;

beforeEach(() => {
  resetSora2RouteState();
  process.env.R2_URL_BASE = "https://files.example.test";
  process.env.SORA2_LANDSCAPE_WORKFLOW_ID = "landscape-workflow";
  process.env.SORA2_PORTRAIT_WORKFLOW_ID = "portrait-workflow";
});

after(() => {
  if (originalR2UrlBase === undefined) delete process.env.R2_URL_BASE;
  else process.env.R2_URL_BASE = originalR2UrlBase;
  if (originalLandscapeWorkflow === undefined)
    delete process.env.SORA2_LANDSCAPE_WORKFLOW_ID;
  else process.env.SORA2_LANDSCAPE_WORKFLOW_ID = originalLandscapeWorkflow;
  if (originalPortraitWorkflow === undefined)
    delete process.env.SORA2_PORTRAIT_WORKFLOW_ID;
  else process.env.SORA2_PORTRAIT_WORKFLOW_ID = originalPortraitWorkflow;
});

function formRequest(path: string, fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest(`https://app.example.test${path}`, {
    method: "POST",
    body: form,
  });
}

function uploadRequest() {
  const form = new FormData();
  form.set("orientation", "landscape");
  form.set(
    "video",
    new File([new Uint8Array(1024 * 1024)], "input.mp4", { type: "video/mp4" }),
  );
  return new NextRequest(
    "https://app.example.test/api/sora2-video-watermark-removal",
    {
      method: "POST",
      body: form,
    },
  );
}

test("URL route reports queued only after the pre-provider queue row is stored", async () => {
  const { POST } = await urlRoute;
  const response = await POST(
    formRequest("/sora2-video-watermark-removal-url", {
      url: "https://external.example.test/video.mp4",
      orientation: "portrait",
    }),
  );

  assert.equal(response.status, 202);
  assert.equal((await response.json()).status, "queued");
  assert.equal(sora2RouteState.queueRows.length, 1);
  assert.deepEqual(sora2RouteState.queueRows[0]?.payload, {
    taskRecordId: 71,
    userId: "sora-owner",
    orientation: "portrait",
    r2Url: "https://external.example.test/video.mp4",
  });
  assert.equal(sora2RouteState.orchestratorCalls.length, 0);
});

test("URL route never converts an unknown provider result into a queued success", async () => {
  const { POST } = await urlRoute;
  sora2RouteState.orchestratorResult = {
    ok: false,
    recordId: 71,
    error: "provider transport timed out",
    submissionOutcome: "unknown",
  };

  const response = await POST(
    formRequest("/sora2-video-watermark-removal-url", {
      url: "https://files.example.test/video.mp4",
      orientation: "portrait",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.status, "submission-unknown");
  assert.equal(body.success, false);
  assert.equal("queued" in body, false);
  assert.equal(sora2RouteState.queueRows.length, 0);
  assert.equal(
    sora2RouteState.taskUpdates.some(
      (update) => (update.data as any).taskStatus === "failed",
    ),
    false,
  );
});

test("URL route retries only the local link for a known-created provider task", async () => {
  const { POST } = await urlRoute;
  sora2RouteState.orchestratorResult = {
    ok: false,
    recordId: 71,
    taskId: "created-but-not-linked",
    error: "repository write failed",
    submissionOutcome: "created",
  };

  const response = await POST(
    formRequest("/sora2-video-watermark-removal-url", {
      url: "https://files.example.test/video.mp4",
      orientation: "portrait",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskId, "created-but-not-linked");
  assert.equal(sora2RouteState.orchestratorCalls.length, 1);
  assert.equal(sora2RouteState.providerCreateCalls, 1);
  assert.equal(sora2RouteState.taskUpdates.length, 1);
  assert.deepEqual(sora2RouteState.taskUpdates[0]?.data, {
    replicateId: "created-but-not-linked",
    taskStatus: "Processing",
  });
  assert.equal(sora2RouteState.queueRows.length, 0);
});

test("URL route keeps a known-created task reconcilable when the link retry fails", async () => {
  const { POST } = await urlRoute;
  sora2RouteState.orchestratorResult = {
    ok: false,
    recordId: 71,
    taskId: "created-but-not-linked",
    error: "repository write failed",
    submissionOutcome: "created",
  };
  sora2RouteState.taskUpdateError = new Error("database unavailable");

  const response = await POST(
    formRequest("/sora2-video-watermark-removal-url", {
      url: "https://files.example.test/video.mp4",
      orientation: "portrait",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.success, true);
  assert.equal(body.taskId, "created-but-not-linked");
  assert.equal(body.recordId, 71);
  assert.equal(body.status, "processing");
  assert.equal(sora2RouteState.orchestratorCalls.length, 1);
  assert.equal(sora2RouteState.providerCreateCalls, 1);
  assert.equal(sora2RouteState.taskUpdates.length, 1);
  assert.equal(sora2RouteState.records[0]?.taskStatus, "pending");
  assert.equal(sora2RouteState.queueRows.length, 0);
  assert.equal(sora2RouteState.watchers.length, 0);
  assert.equal(sora2RouteState.creditUpdates.length, 0);
});

test("R2 route never retries or reports queued after an unknown provider result", async () => {
  const { POST } = await r2Route;
  sora2RouteState.orchestratorResult = {
    ok: false,
    recordId: 71,
    error: "provider transport timed out",
    submissionOutcome: "unknown",
  };

  const response = await POST(
    formRequest("/sora2-video-watermark-removal-r2", {
      r2Url: "https://files.example.test/video.mp4",
      orientation: "portrait",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.status, "submission-unknown");
  assert.equal(body.success, false);
  assert.equal("queued" in body, false);
  assert.equal(sora2RouteState.queueRows.length, 0);
});

test("R2 route relinks a known-created provider task without replaying it", async () => {
  const { POST } = await r2Route;
  sora2RouteState.orchestratorResult = {
    ok: false,
    recordId: 71,
    taskId: "created-but-not-linked",
    error: "repository write failed",
    submissionOutcome: "created",
  };

  const response = await POST(
    formRequest("/sora2-video-watermark-removal-r2", {
      r2Url: "https://files.example.test/video.mp4",
      orientation: "portrait",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskId, "created-but-not-linked");
  assert.equal(sora2RouteState.taskUpdates.length, 1);
  assert.equal(sora2RouteState.queueRows.length, 0);
});

test("R2 upload route submits a short-lived signed object URL to RunningHub", async () => {
  const { POST } = await r2Route;
  const response = await POST(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-r2",
      {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.set("orientation", "landscape");
          form.set(
            "video",
            new File([new Uint8Array(1024 * 1024)], "input.mp4", {
              type: "video/mp4",
            }),
          );
          return form;
        })(),
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(sora2RouteState.orchestratorCalls.length, 1);
  assert.equal(
    sora2RouteState.orchestratorCalls[0]?.r2Url,
    "https://signed.example.test/uploaded.mp4?expires=3600",
  );
  assert.equal(
    sora2RouteState.records[0]?.inputImageUrl,
    "https://files.example.test/uploaded.mp4",
  );
});

test("R2 upload route binds anonymous tasks to the signed browser principal", async () => {
  const { POST } = await r2Route;
  sora2RouteState.user = null;
  const response = await POST(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-r2",
      {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.set("orientation", "landscape");
          form.set("r2Url", "https://files.example.test/uploaded.mp4");
          return form;
        })(),
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(sora2RouteState.records[0]?.userId, null);
  assert.equal(sora2RouteState.records[0]?.principalId, "anonymous-principal");
  assert.match(response.headers.get("set-cookie") ?? "", /remove_anything_principal=/);
});

test("upload route keeps unknown submission reconcilable and never enqueues it", async () => {
  const { POST } = await uploadRoute;
  sora2RouteState.providerError = new TaskCreationOutcomeUnknownError(
    "provider timed out",
  );

  const response = await POST(uploadRequest());
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.status, "submission-unknown");
  assert.equal(body.success, false);
  assert.equal("queued" in body, false);
  assert.equal(sora2RouteState.providerCreateCalls, 1);
  assert.equal(sora2RouteState.queueRows.length, 0);
  assert.equal(sora2RouteState.uploadCreateArguments[0]?.[1], 71);
  assert.equal(sora2RouteState.records[0]?.taskStatus, "Processing");
});

test("upload route returns a failed response for an explicit rejection without replay", async () => {
  const { POST } = await uploadRoute;
  sora2RouteState.providerError = new TaskCreationRejectedError(
    "TASK_QUEUE_MAXED",
  );

  const response = await POST(uploadRequest());
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.code, "TASK_CREATION_REJECTED");
  assert.equal("queued" in body, false);
  assert.equal(sora2RouteState.providerCreateCalls, 1);
  assert.equal(sora2RouteState.queueRows.length, 0);
  assert.equal(sora2RouteState.records[0]?.taskStatus, "Failed");
});

test("upload route preserves a known-created task when its database link fails", async () => {
  const { POST } = await uploadRoute;
  sora2RouteState.taskUpdateError = new Error("database unavailable");

  const response = await POST(uploadRequest());
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.taskId, "runninghub-created-1");
  assert.equal(body.status, "processing");
  assert.equal("queued" in body, false);
  assert.equal(sora2RouteState.providerCreateCalls, 1);
  assert.equal(sora2RouteState.queueRows.length, 0);
  assert.equal(
    sora2RouteState.taskUpdates.some(
      (update) => (update.data as any).taskStatus === "Failed",
    ),
    false,
  );
});
