export type RemoveObjectViewState =
  | "idle"
  | "editing"
  | "detecting"
  | "ready"
  | "processing"
  | "succeeded"
  | "failed";

export type MaskSnapshot = {
  hasMask: boolean;
  aiPrompt: string;
};

export type MaskHistoryState = {
  past: MaskSnapshot[];
  present: MaskSnapshot;
  future: MaskSnapshot[];
};

export function createInitialMaskHistory(): MaskHistoryState {
  return {
    past: [],
    present: { hasMask: false, aiPrompt: "" },
    future: [],
  };
}

export function pushMaskSnapshot(
  history: MaskHistoryState,
  snapshot: MaskSnapshot,
): MaskHistoryState {
  return {
    past: [...history.past, history.present],
    present: snapshot,
    future: [],
  };
}

export function undoMaskSnapshot(history: MaskHistoryState): MaskHistoryState {
  const previous = history.past.at(-1);
  if (!previous) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoMaskSnapshot(history: MaskHistoryState): MaskHistoryState {
  const next = history.future[0];
  if (!next) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function deriveEditorState(
  hasMask: boolean,
  isDetecting: boolean,
): RemoveObjectViewState {
  if (isDetecting) {
    return "detecting";
  }

  if (hasMask) {
    return "ready";
  }

  return "editing";
}
