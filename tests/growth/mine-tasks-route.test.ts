import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  resetMineTasksState,
  mineTasksState as state,
} from "../support/mine-tasks-stubs";

const routePromise = import("../../app/api/mine-tasks/route");

beforeEach(resetMineTasksState);

function request() {
  return new NextRequest(
    "https://remove-anything.test/api/mine-tasks?page=1&pageSize=20",
  );
}

function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 17,
    userId: "owner",
    taskStatus: "succeeded",
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    executeStartTime: null,
    executeEndTime: null,
    ...overrides,
  };
}

test("history API returns only protected preview/download paths for private R2 results", async () => {
  state.backgroundRemovalTask = [
    {
      ...baseTask(),
      replicateId: "background-17",
      outputImageUrl:
        "https://files.example.test/background-removal/processed/result.png",
      inputImageUrl: "https://provider.example.test/source.png",
      resolution: "1024x1024",
      model: "men1scus/birefnet",
      isPublic: false,
    },
  ];
  state.watermarkRemovalTask = [
    {
      ...baseTask(),
      id: 18,
      runninghubTaskId: "watermark-18",
      outputZipUrl:
        "https://files.example.test/watermark-removal/processed/result.zip",
      inputZipUrl: "https://provider.example.test/input.zip",
      isPublic: false,
    },
  ];
  state.taskData = [
    {
      ...baseTask(),
      id: 19,
      replicateId: "sora-19",
      model: "sora2-video-watermark-removal",
      imageUrl:
        "https://files.example.test/watermark-removal/processed/video.mp4",
      inputImageUrl: "https://provider.example.test/input.mp4",
      isPrivate: true,
      aspectRatio: "16:9",
    },
  ];

  const { GET } = await routePromise;
  const response = await GET(request());
  const body = await response.json();
  assert.equal(response.status, 200);
  const rows = body.data.data;
  assert.equal(rows.length, 3);
  assert.ok(
    rows.every(
      (row: any) => !JSON.stringify(row).includes("provider.example.test"),
    ),
  );
  assert.deepEqual(
    new Set(rows.map((row: any) => row.taskType)),
    new Set([
      "sora2-video-watermark-removal",
      "watermark-removal",
      "background-removal",
    ]),
  );

  const background = rows.find(
    (row: any) => row.taskType === "background-removal",
  );
  assert.equal(
    background.imageUrl,
    "/api/download-background?taskId=background-17&preview=1",
  );
  assert.equal(
    background.downloadUrl,
    "/api/download-background?taskId=background-17",
  );
  assert.equal(background.inputImageUrl, null);

  const watermark = rows.find(
    (row: any) => row.taskType === "watermark-removal",
  );
  assert.equal(
    watermark.imageUrl,
    null,
    "ZIP results must not be rendered as an image",
  );
  assert.equal(
    watermark.downloadUrl,
    "/api/download?type=watermark-removal&taskId=watermark-18",
  );

  const video = rows.find(
    (row: any) => row.taskType === "sora2-video-watermark-removal",
  );
  assert.equal(
    video.imageUrl,
    "/api/download?type=sora2-video-watermark-removal&taskId=sora-19&preview=1",
  );
  assert.equal(
    video.downloadUrl,
    "/api/download?type=sora2-video-watermark-removal&taskId=sora-19",
  );
  assert.equal(video.inputImageUrl, null);
});

test("history API keeps unmigrated provider results processing and exposes no source URL", async () => {
  state.backgroundRemovalTask = [
    {
      ...baseTask(),
      replicateId: "background-legacy",
      outputImageUrl: "https://provider.example.test/output.png",
      inputImageUrl: "https://provider.example.test/input.png",
      resolution: "1024x1024",
      model: "men1scus/birefnet",
      isPublic: false,
    },
  ];
  state.watermarkRemovalTask = [
    {
      ...baseTask(),
      runninghubTaskId: "watermark-legacy",
      outputZipUrl: "https://provider.example.test/output.zip",
      inputZipUrl: "https://provider.example.test/input.zip",
      isPublic: false,
    },
  ];
  state.taskData = [
    {
      ...baseTask(),
      id: 21,
      replicateId: "sora-legacy",
      model: "sora2-video-watermark-removal",
      imageUrl: "https://provider.example.test/output.mp4",
      inputImageUrl: "https://provider.example.test/input.mp4",
      isPrivate: true,
      aspectRatio: "16:9",
    },
  ];

  const { GET } = await routePromise;
  const response = await GET(request());
  const body = await response.json();
  assert.equal(response.status, 200);
  for (const row of body.data.data) {
    assert.equal(row.taskStatus, "processing");
    assert.equal(row.imageUrl, null);
    assert.equal(row.inputImageUrl, null);
    assert.equal(row.downloadUrl, null);
  }
  assert.ok(!JSON.stringify(body).includes("provider.example.test"));
});
