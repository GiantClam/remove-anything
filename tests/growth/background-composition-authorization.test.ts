import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { GET, POST, PUT } from "../../app/api/background-composition/route";
import {
  resetCompositionRouteState,
  compositionRouteState as state,
} from "../support/background-composition-route-stubs";

beforeEach(resetCompositionRouteState);

const createBody = {
  foregroundImageUrl: "https://files.example.test/foreground.png",
  backgroundType: "color",
  backgroundData: "#ffffff",
  compositionParams: { x: 0, y: 0 },
};
const updateBody = {
  compositionId: 17,
  resultImageDataUrl: "data:image/png;base64,AQID",
};

function request(method: "POST" | "PUT", body: unknown, malformed = false) {
  const req = new NextRequest(
    "https://remove-anything.test/api/background-composition",
    {
      method,
      headers: { "content-type": "application/json" },
      body: malformed ? "{" : JSON.stringify(body),
    },
  );
  const parseJson = req.json.bind(req);
  req.json = async () => {
    state.bodyReads++;
    state.events.push("body");
    return parseJson();
  };
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
    new Uint8Array([1, 2, 3]),
  );
  assert.equal(state.updates.length, 1);
  assert.deepEqual(state.updates[0].where, {
    id: 17,
    userId: "owner-1",
  });
  assert.equal(state.composition!.status, "completed");
  assert.equal(state.composition!.resultImageSize, 3);
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
