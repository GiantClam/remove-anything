import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import sharp from "sharp";

import { GET, POST, PUT } from "../../app/api/background-composition/route";
import {
  resetCompositionRouteState,
  compositionRouteState as state,
} from "../support/background-composition-route-stubs";
import { TINY_PNG_BYTES } from "../support/image-fixtures";

const previousAllowedOrigins = process.env.IMAGE_INPUT_ALLOWED_ORIGINS;

beforeEach(() => {
  process.env.IMAGE_INPUT_ALLOWED_ORIGINS = "https://files.example.test";
  resetCompositionRouteState();
});

after(() => {
  if (previousAllowedOrigins === undefined)
    delete process.env.IMAGE_INPUT_ALLOWED_ORIGINS;
  else process.env.IMAGE_INPUT_ALLOWED_ORIGINS = previousAllowedOrigins;
});

const createBody = {
  foregroundImageUrl: "https://files.example.test/foreground.png",
  backgroundType: "solid",
  backgroundData: { color: "#ffffff" },
  compositionParams: {
    position: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    blendMode: "normal",
  },
};
const updateBody = {
  compositionId: 17,
  resultImageDataUrl: `data:image/png;base64,${Buffer.from(TINY_PNG_BYTES).toString("base64")}`,
};

function request(
  method: "POST" | "PUT",
  body: unknown,
  malformed = false,
  extraHeaders: Record<string, string> = {},
) {
  const req = new NextRequest(
    "https://remove-anything.test/api/background-composition",
    {
      method,
      headers: { "content-type": "application/json", ...extraHeaders },
      body: malformed ? "{" : JSON.stringify(body),
    },
  );
  Object.defineProperty(req, "headers", {
    configurable: true,
    value: new Headers({
      ...Object.fromEntries(req.headers.entries()),
      ...extraHeaders,
    }),
  });
  const requestBody = req.body;
  Object.defineProperty(req, "body", {
    configurable: true,
    get() {
      state.bodyReads++;
      state.events.push("body");
      return requestBody;
    },
  });
  return req;
}

function assertNoDatabaseOrStorage() {
  assert.deepEqual(state.creates, []);
  assert.deepEqual(state.lookups, []);
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.listQueries, []);
  assert.deepEqual(state.countQueries, []);
  assert.deepEqual(state.uploads, []);
}

for (const [label, user] of [
  ["anonymous", null],
  ["missing user id", {}],
  ["empty user id", { id: "" }],
] as const) {
  for (const [method, handler] of [
    ["POST", POST],
    ["PUT", PUT],
  ] as const) {
    test(`${method} rejects ${label} before parsing the body or accessing database/storage`, async () => {
      state.user = user;
      const response = await handler(request(method, {}, true));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
      assert.equal(state.bodyReads, 0);
      assertNoDatabaseOrStorage();
    });
  }
}

test("anonymous PUT cannot upload or overwrite an existing user's composition", async () => {
  state.user = null;
  const response = await PUT(request("PUT", updateBody));
  assert.equal(response.status, 401);
  assert.equal(state.bodyReads, 0);
  assertNoDatabaseOrStorage();
  assert.equal(state.composition!.status, "pending");
});

test("authenticated POST binds the new composition to the session owner", async () => {
  const response = await POST(
    request("POST", { ...createBody, userId: "claimed-other-owner" }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: { id: 18, status: "pending" },
  });
  assert.deepEqual(state.creates, [
    { ...createBody, userId: "owner-1", status: "pending" },
  ]);
  assert.deepEqual(state.uploads, []);
});

test("POST accepts the existing template background shape", async () => {
  const templateBody = {
    ...createBody,
    backgroundType: "template",
    backgroundData: {
      templateId: "office",
      imageUrl: "/templates/office.jpg",
    },
  };
  const response = await POST(request("POST", templateBody));
  assert.equal(response.status, 200);
  assert.deepEqual(state.creates[0], {
    ...templateBody,
    userId: "owner-1",
    status: "pending",
  });
});

test("POST accepts a safe URL-based image background", async () => {
  const imageBody = {
    ...createBody,
    backgroundType: "image",
    backgroundData: { imageUrl: "https://files.example.test/background.png" },
  };
  const response = await POST(request("POST", imageBody));
  assert.equal(response.status, 200);
  assert.deepEqual(state.creates[0], {
    ...imageBody,
    userId: "owner-1",
    status: "pending",
  });
});

test("POST rejects malformed composition parameters without persisting a record", async () => {
  const response = await POST(
    request("POST", { ...createBody, compositionParams: [] }),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_COMPOSITION_INPUT");
  assertNoDatabaseOrStorage();
});

test("POST rejects an oversized body before creating a composition", async () => {
  const response = await POST(
    request("POST", createBody, false, {
      "content-length": String(15 * 1024 * 1024 + 1),
    }),
  );
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "PAYLOAD_TOO_LARGE");
  assertNoDatabaseOrStorage();
});

test("POST enforces the request size limit even without a declared content length", async () => {
  const response = await POST(
    request("POST", {
      ...createBody,
      backgroundData: { color: "#fff", extra: "x".repeat(15 * 1024 * 1024) },
    }),
  );
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "PAYLOAD_TOO_LARGE");
  assertNoDatabaseOrStorage();
});

test("POST rejects oversized background metadata before creating a composition", async () => {
  const response = await POST(
    request("POST", {
      ...createBody,
      backgroundData: { color: "#fff", extra: "x".repeat(70 * 1024) },
    }),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_COMPOSITION_INPUT");
  assertNoDatabaseOrStorage();
});

test("POST rejects inline background data URLs rather than persisting base64", async () => {
  const response = await POST(
    request("POST", {
      ...createBody,
      backgroundType: "image",
      backgroundData: {
        imageUrl: `data:image/png;base64,${Buffer.from(TINY_PNG_BYTES).toString("base64")}`,
      },
    }),
  );
  assert.equal(response.status, 400);
  assertNoDatabaseOrStorage();
});

test("POST rejects remote foreground and background references outside the configured origins", async () => {
  const foreground = await POST(
    request("POST", {
      ...createBody,
      foregroundImageUrl: "https://attacker.example.test/foreground.png",
    }),
  );
  assert.equal(foreground.status, 400);
  assert.equal((await foreground.json()).code, "INVALID_COMPOSITION_INPUT");

  const background = await POST(
    request("POST", {
      ...createBody,
      backgroundType: "image",
      backgroundData: {
        imageUrl: "https://attacker.example.test/background.png",
      },
    }),
  );
  assert.equal(background.status, 400);
  assert.equal((await background.json()).code, "INVALID_COMPOSITION_INPUT");
  assertNoDatabaseOrStorage();
});

test("POST accepts configured HTTPS foreground and background references", async () => {
  const response = await POST(
    request("POST", {
      ...createBody,
      foregroundImageUrl: "https://files.example.test/foreground.png?sig=1",
      backgroundType: "image",
      backgroundData: {
        imageUrl: "https://files.example.test/background.png?sig=2",
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(state.creates.length, 1);
});

for (const missing of [false, true]) {
  test(`PUT rejects ${missing ? "missing" : "another owner's"} composition before uploading`, async () => {
    if (missing) state.composition = null;
    else state.composition!.userId = "other-owner";
    const response = await PUT(request("PUT", updateBody));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Composition not found" });
    assert.deepEqual(state.lookups, [{ id: 17, userId: "owner-1" }]);
    assert.deepEqual(state.uploads, []);
    assert.deepEqual(state.updates, []);
  });
}

test("PUT checks ownership before upload and constrains the final write to the same owner", async () => {
  const response = await PUT(request("PUT", updateBody));
  assert.equal(response.status, 200);
  assert.deepEqual(state.lookups, [{ id: 17, userId: "owner-1" }]);
  assert.deepEqual(state.events, ["body", "findFirst", "upload", "update"]);
  assert.equal(state.uploads.length, 1);
  assert.equal(state.uploads[0].name, "composition-17.png");
  assert.deepEqual(
    new Uint8Array(await state.uploads[0].arrayBuffer()),
    TINY_PNG_BYTES,
  );
  assert.equal(state.updates.length, 1);
  assert.deepEqual(state.updates[0].where, {
    id: 17,
    userId: "owner-1",
  });
  assert.equal(state.composition!.status, "completed");
  assert.equal(state.composition!.resultImageSize, TINY_PNG_BYTES.length);
});

test("PUT rejects a malformed image data URL before upload or persistence", async () => {
  const response = await PUT(
    request("PUT", {
      ...updateBody,
      resultImageDataUrl: "data:image/png;base64,%%%",
    }),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(state.events, ["body"]);
  assert.deepEqual(state.uploads, []);
  assert.deepEqual(state.updates, []);
});

test("PUT rejects a declared MIME that does not match the accepted image type before lookup", async () => {
  const response = await PUT(
    request("PUT", {
      ...updateBody,
      resultImageDataUrl: `data:image/jpeg;base64,${Buffer.from(TINY_PNG_BYTES).toString("base64")}`,
    }),
  );
  assert.equal(response.status, 415);
  assert.deepEqual(state.events, ["body"]);
  assert.deepEqual(state.uploads, []);
  assert.deepEqual(state.updates, []);
});

test("PUT rejects base64 bytes that are not a decodable PNG before upload or persistence", async () => {
  const response = await PUT(
    request("PUT", {
      ...updateBody,
      resultImageDataUrl: "data:image/png;base64,AQID",
    }),
  );
  assert.equal(response.status, 415);
  assert.deepEqual(state.events, ["body", "findFirst"]);
  assert.deepEqual(state.uploads, []);
  assert.deepEqual(state.updates, []);
});

test("PUT rejects an oversized decoded image before upload or persistence", async () => {
  const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
  const response = await PUT(
    request("PUT", {
      ...updateBody,
      resultImageDataUrl: `data:image/png;base64,${tooLarge}`,
    }),
  );
  assert.equal(response.status, 413);
  assert.deepEqual(state.events, ["body"]);
  assert.deepEqual(state.uploads, []);
  assert.deepEqual(state.updates, []);
});

test("PUT rejects a decodable image above the pixel limit before upload or persistence", async () => {
  const tooManyPixels = await sharp({
    create: {
      width: 6_401,
      height: 6_250,
      channels: 4,
      background: { r: 12, g: 34, b: 56, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const response = await PUT(
    request("PUT", {
      ...updateBody,
      resultImageDataUrl: `data:image/png;base64,${tooManyPixels.toString("base64")}`,
    }),
  );
  assert.equal(response.status, 413);
  assert.deepEqual(state.events, ["body", "findFirst"]);
  assert.deepEqual(state.uploads, []);
  assert.deepEqual(state.updates, []);
});

test("a changed owner between lookup and final write cannot receive the prior owner's update", async (t) => {
  t.mock.method(console, "error", () => {});
  state.beforeUpload = () => {
    state.composition!.userId = "new-owner";
  };
  const response = await PUT(request("PUT", updateBody));
  assert.equal(response.status, 500);
  assert.deepEqual(state.updates[0].where, {
    id: 17,
    userId: "owner-1",
  });
  assert.equal(state.composition!.status, "pending");
  assert.equal(state.composition!.resultImageUrl, undefined);
});

test("GET still requires login before listing history", async () => {
  state.user = null;
  const response = await GET(
    new NextRequest("https://remove-anything.test/api/background-composition"),
  );
  assert.equal(response.status, 401);
  assertNoDatabaseOrStorage();
});

test("GET lists and counts only the authenticated owner's history", async () => {
  const response = await GET(
    new NextRequest("https://remove-anything.test/api/background-composition"),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(state.listQueries[0].where, { userId: "owner-1" });
  assert.deepEqual(state.countQueries, [{ where: { userId: "owner-1" } }]);
  const body = await response.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].userId, "owner-1");
});

test("GET caps page size and page offset", async () => {
  const response = await GET(
    new NextRequest(
      "https://remove-anything.test/api/background-composition?page=999999&limit=100000",
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(state.listQueries[0].take, 100);
  assert.equal(state.listQueries[0].skip, 999_900);
  const body = await response.json();
  assert.equal(body.pagination.page, 10_000);
  assert.equal(body.pagination.limit, 100);
});

test("GET rejects invalid pagination before listing history", async () => {
  const response = await GET(
    new NextRequest(
      "https://remove-anything.test/api/background-composition?page=1.5&limit=20",
    ),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(state.listQueries, []);
  assert.deepEqual(state.countQueries, []);
});

test("GET redacts legacy inline data URLs from nested historical values", async () => {
  const legacyDataUrl = `data:image/png;base64,${"A".repeat(32_000)}`;
  const whitespaceDataUrl = ` \nDATA:${legacyDataUrl.slice("data:".length)}`;
  state.composition!.backgroundData = {
    imageUrl: legacyDataUrl,
    metadata: { backup: whitespaceDataUrl },
    template: { templateId: "office", imageUrl: "/templates/office.jpg" },
  };
  const response = await GET(
    new NextRequest("https://remove-anything.test/api/background-composition"),
  );
  assert.equal(response.status, 200);
  const responseText = await response.text();
  assert.equal(responseText.includes(legacyDataUrl), false);
  assert.equal(responseText.includes(whitespaceDataUrl), false);
  const body = JSON.parse(responseText);
  assert.equal(body.data[0].backgroundData.imageUrl, "data:[omitted]");
  assert.equal(body.data[0].backgroundData.metadata.backup, "data:[omitted]");
  assert.equal(
    body.data[0].backgroundData.template.imageUrl,
    "/templates/office.jpg",
  );
});
