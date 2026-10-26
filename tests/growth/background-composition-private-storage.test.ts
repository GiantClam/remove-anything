import assert from "node:assert/strict";
import test from "node:test";

import { isBackgroundCompositionResultKey } from "../../lib/background-composition-result-key";
import { requirePrivateCompositionBucket } from "../../lib/r2-s3";
import { S3Service } from "../../lib/s3";

test("private composition uploads use a scoped key and do not send an ACL", async () => {
  const service = new S3Service({
    endpoint: "https://r2.example.test",
    region: "auto",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    url: "https://public.example.test",
    bucket: "private-composition-results",
  });
  const sent: Array<{ input: Record<string, unknown> }> = [];
  const client = (
    service as unknown as {
      s3Client: {
        send: (command: { input: Record<string, unknown> }) => Promise<unknown>;
      };
    }
  ).s3Client;
  client.send = async (command) => {
    sent.push(command);
    return {};
  };

  await service.putPrivateItemInBucket(
    "background-compositions/17/abcdefghijklmnopqrstu.png",
    new Uint8Array([1, 2, 3]),
    "image/png",
  );

  assert.equal(sent.length, 1);
  assert.equal(sent[0].input.Bucket, "private-composition-results");
  assert.equal(
    sent[0].input.Key,
    "background-compositions/17/abcdefghijklmnopqrstu.png",
  );
  assert.equal(sent[0].input.ContentType, "image/png");
  assert.equal(Object.hasOwn(sent[0].input, "ACL"), false);
  assert.equal(
    isBackgroundCompositionResultKey(
      17,
      "background-compositions/17/abcdefghijklmnopqrstu.png",
    ),
    true,
  );
  assert.equal(
    isBackgroundCompositionResultKey(
      18,
      "background-compositions/17/abcdefghijklmnopqrstu.png",
    ),
    false,
  );
  assert.equal(
    isBackgroundCompositionResultKey(
      17,
      "https://public.example.test/result.png",
    ),
    false,
  );
});

test("private composition storage refuses missing and public-bucket configuration", () => {
  assert.throws(() => requirePrivateCompositionBucket(undefined, "public"));
  assert.throws(() => requirePrivateCompositionBucket("public", "public"));
  assert.equal(requirePrivateCompositionBucket("private", "public"), "private");
});
