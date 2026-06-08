import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialMaskHistory,
  deriveEditorState,
  pushMaskSnapshot,
  redoMaskSnapshot,
  undoMaskSnapshot,
} from "../../lib/remove-objects/mask-state";

test("deriveEditorState prefers detecting over ready", () => {
  assert.equal(deriveEditorState(true, true), "detecting");
  assert.equal(deriveEditorState(true, false), "ready");
  assert.equal(deriveEditorState(false, false), "editing");
});

test("undo and redo walk mask history correctly", () => {
  const initial = createInitialMaskHistory();
  const next = pushMaskSnapshot(initial, { hasMask: true, aiPrompt: "person" });
  const undone = undoMaskSnapshot(next);
  const redone = redoMaskSnapshot(undone);

  assert.equal(undone.present.hasMask, false);
  assert.equal(redone.present.aiPrompt, "person");
});
