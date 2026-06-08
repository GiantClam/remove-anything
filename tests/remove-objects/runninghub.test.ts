import assert from "node:assert/strict";
import test from "node:test";

process.env.RUNNINGHUB_OBJECT_DETECT_IMAGE_NODE_ID = "detect-image-node";
process.env.RUNNINGHUB_OBJECT_DETECT_IMAGE_FIELD_NAME = "detect_image";
process.env.RUNNINGHUB_OBJECT_DETECT_PROMPT_NODE_ID = "detect-prompt-node";
process.env.RUNNINGHUB_OBJECT_DETECT_PROMPT_FIELD_NAME = "detect_prompt";
process.env.RUNNINGHUB_OBJECT_SEGMENT_IMAGE_NODE_ID = "segment-image-node";
process.env.RUNNINGHUB_OBJECT_SEGMENT_IMAGE_FIELD_NAME = "segment_image";
process.env.RUNNINGHUB_OBJECT_SEGMENT_FRAME_EDITOR_NODE_ID = "segment-frame-node";
process.env.RUNNINGHUB_OBJECT_SEGMENT_FRAME_EDITOR_FIELD_NAME = "segment_info";
process.env.RUNNINGHUB_OBJECT_REMOVE_IMAGE_NODE_ID = "remove-image-node";
process.env.RUNNINGHUB_OBJECT_REMOVE_IMAGE_FIELD_NAME = "image";
process.env.RUNNINGHUB_OBJECT_REMOVE_MASK_NODE_ID = "remove-mask-node";
process.env.RUNNINGHUB_OBJECT_REMOVE_MASK_FIELD_NAME = "image";
process.env.RUNNINGHUB_OBJECT_REMOVE_PROMPT_NODE_ID = "remove-prompt-node";
process.env.RUNNINGHUB_OBJECT_REMOVE_PROMPT_FIELD_NAME = "text";

const helpersPromise = import("../../lib/remove-objects/runninghub");

test("normalizeRunningHubStatus maps provider statuses to app statuses", async () => {
  const { normalizeRunningHubStatus } = await helpersPromise;

  assert.equal(normalizeRunningHubStatus("RUNNING"), "processing");
  assert.equal(normalizeRunningHubStatus({ status: "SUCCESS" }), "succeeded");
  assert.equal(normalizeRunningHubStatus("FAILED"), "failed");
  assert.equal(normalizeRunningHubStatus(undefined), "pending");
});

test("nodeInfo builders honor env-driven mappings and omit empty prompt", async () => {
  const {
    buildDetectNodeInfoList,
    buildFrameEditorInfo,
    buildRemoveNodeInfoList,
    buildSegmentNodeInfoList,
    getRunningHubOutputFileUrl,
  } = await helpersPromise;

  const detectNodes = buildDetectNodeInfoList("https://example.com/image.png", " person ");
  assert.deepEqual(detectNodes, [
    {
      nodeId: "detect-image-node",
      fieldName: "detect_image",
      fieldValue: "https://example.com/image.png",
    },
    {
      nodeId: "detect-prompt-node",
      fieldName: "detect_prompt",
      fieldValue: "person",
    },
  ]);

  const removeNodes = buildRemoveNodeInfoList("image-url", "mask-url");
  assert.equal(removeNodes.length, 2);
  assert.deepEqual(removeNodes[0], {
    nodeId: "remove-image-node",
    fieldName: "image",
    fieldValue: "image-url",
  });
  assert.deepEqual(removeNodes[1], {
    nodeId: "remove-mask-node",
    fieldName: "image",
    fieldValue: "mask-url",
  });

  const segmentNodes = buildSegmentNodeInfoList("segment-image-url", {
    x: 12,
    y: 34,
    w: 56,
    h: 78,
  });
  assert.deepEqual(segmentNodes, [
    {
      nodeId: "segment-image-node",
      fieldName: "segment_image",
      fieldValue: "segment-image-url",
    },
    {
      nodeId: "segment-frame-node",
      fieldName: "segment_info",
      fieldValue:
        "{\"positive_coords\":[],\"negative_coords\":[],\"bbox\":[{\"x\":12,\"y\":34,\"w\":56,\"h\":78}],\"frame_index\":0}",
    },
  ]);

  assert.equal(
    buildFrameEditorInfo({ x: 1, y: 2, w: 3, h: 4 }),
    "{\"positive_coords\":[],\"negative_coords\":[],\"bbox\":[{\"x\":1,\"y\":2,\"w\":3,\"h\":4}],\"frame_index\":0}",
  );

  assert.equal(
    getRunningHubOutputFileUrl([
      { fileName: "QQ842850240_Comp_00001.png", fileUrl: "https://example.com/comp.png" },
      { fileName: "QQ842850240_mask_00001.png", fileUrl: "https://example.com/mask.png" },
    ]),
    "https://example.com/mask.png",
  );
});
