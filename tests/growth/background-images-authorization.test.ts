import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { backgroundImagesRouteState as state } from "../support/background-images-route-stubs";

const route = import("../../app/api/background-images/route");

beforeEach(() => {
  state.reset();
});

function listRequest(query = "") {
  return new NextRequest(
    `https://app.example.test/api/background-images${query}`,
  );
}

function createRequest(contentType: "json" | "multipart") {
  if (contentType === "json") {
    return new NextRequest("https://app.example.test/api/background-images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Studio", type: "solid", color: "#ffffff" }),
    });
  }
  const body = new FormData();
  body.set(
    "file",
    new File([new Uint8Array([1, 2, 3])], "background.png", {
      type: "image/png",
    }),
  );
  body.set("name", "Studio");
  body.set("type", "image");
  body.set("isPublic", "true");
  return new NextRequest("https://app.example.test/api/background-images", {
    method: "POST",
    body,
  });
}

function assertNoImageOperations() {
  assert.equal(state.listQueries.length, 0);
  assert.equal(state.countQueries.length, 0);
  assert.equal(state.createQueries.length, 0);
  assert.equal(state.uploads.length, 0);
}

function assertDatabaseAdminLookup(id: string) {
  assert.deepEqual(state.adminQueries, [
    {
      where: { id },
      select: { isAdmin: true },
    },
  ]);
}

for (const query of ["", "?isPublic=true", "?type=solid&category=studio"]) {
  test(`public background list ${query || "(default)"} only returns public images without authentication`, async () => {
    const { GET } = await route;
    const response = await GET(listRequest(query));
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      data.data.map((image: { id: string }) => image.id),
      ["public-image"],
    );
    assert.equal(data.pagination.total, 1);
    assert.equal(state.listQueries[0].where.isPublic, true);
    assert.equal(state.countQueries[0].where.isPublic, true);
    assert.equal(state.adminQueries.length, 0);
    assert.deepEqual(state.events, ["list", "count"]);
    if (query.includes("type=")) {
      assert.equal(state.listQueries[0].where.type, "solid");
      assert.equal(state.listQueries[0].where.category, "studio");
    }
  });
}

for (const user of [null, { isAdmin: true }, { id: "", isAdmin: true }]) {
  test(`management list rejects a missing authenticated id (${JSON.stringify(user)}) before listing`, async () => {
    state.sessionUser = user;
    const { GET } = await route;
    const response = await GET(listRequest("?isPublic=false"));

    assert.equal(response.status, 401);
    assert.equal(state.adminQueries.length, 0);
    assertNoImageOperations();
  });
}

for (const databaseUser of [null, { isAdmin: false }]) {
  test(`management list rejects a session admin claim when DB permission is ${JSON.stringify(databaseUser)}`, async () => {
    state.sessionUser = { id: "regular-user", isAdmin: true };
    state.databaseUser = databaseUser;
    const { GET } = await route;
    const response = await GET(listRequest("?isPublic=false"));

    assert.equal(response.status, 403);
    assertDatabaseAdminLookup("regular-user");
    assertNoImageOperations();
  });
}

test("database administrator can list public and private images without a session admin claim", async () => {
  state.sessionUser = { id: "admin-user" };
  state.databaseUser = { isAdmin: true };
  const { GET } = await route;
  const response = await GET(listRequest("?isPublic=false"));
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    data.data.map((image: { id: string }) => image.id),
    ["public-image", "private-image"],
  );
  assert.equal(data.pagination.total, 2);
  assertDatabaseAdminLookup("admin-user");
  assert.deepEqual(state.events, ["session", "admin", "list", "count"]);
});

for (const contentType of ["json", "multipart"] as const) {
  for (const user of [null, { isAdmin: true }, { id: "", isAdmin: true }]) {
    test(`anonymous ${contentType} creation rejects a missing id before body/upload/create (${JSON.stringify(user)})`, async () => {
      state.sessionUser = user;
      const request = createRequest(contentType);
      const { POST } = await route;
      const response = await POST(request);

      assert.equal(response.status, 401);
      assert.equal(request.bodyUsed, false);
      assert.equal(state.adminQueries.length, 0);
      assertNoImageOperations();
    });
  }

  for (const databaseUser of [null, { isAdmin: false }]) {
    test(`non-admin ${contentType} creation checks DB permission ${JSON.stringify(databaseUser)} before body/upload/create`, async () => {
      state.sessionUser = { id: "regular-user", isAdmin: true };
      state.databaseUser = databaseUser;
      const request = createRequest(contentType);
      const { POST } = await route;
      const response = await POST(request);

      assert.equal(response.status, 403);
      assert.equal(request.bodyUsed, false);
      assertDatabaseAdminLookup("regular-user");
      assertNoImageOperations();
    });
  }
}

test("database administrator can create a solid background after the DB permission check", async () => {
  state.sessionUser = { id: "admin-user" };
  state.databaseUser = { isAdmin: true };
  const { POST } = await route;
  const response = await POST(createRequest("json"));
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assertDatabaseAdminLookup("admin-user");
  assert.deepEqual(state.events, ["session", "admin", "create"]);
  assert.equal(state.uploads.length, 0);
  assert.equal(state.createQueries[0].data.name, "Studio");
  assert.equal(state.createQueries[0].data.type, "solid");
  assert.equal(state.createQueries[0].data.isPublic, true);
  assert.match(
    state.createQueries[0].data.imageUrl,
    /^data:image\/svg\+xml;base64,/,
  );
});

test("database administrator can upload a background after the DB permission check", async (t) => {
  t.mock.method(console, "warn", () => {});
  state.sessionUser = { id: "admin-user" };
  state.databaseUser = { isAdmin: true };
  const { POST } = await route;
  const response = await POST(createRequest("multipart"));
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assertDatabaseAdminLookup("admin-user");
  assert.deepEqual(state.events, ["session", "admin", "upload", "create"]);
  assert.equal(state.uploads.length, 1);
  assert.equal(
    state.createQueries[0].data.imageUrl,
    "https://files.example.test/background.png",
  );
});
