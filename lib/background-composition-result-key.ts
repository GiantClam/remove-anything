const COMPOSITION_RESULT_PREFIX = "background-compositions";
const COMPOSITION_RESULT_NONCE_LENGTH = 21;

export function makeBackgroundCompositionResultKey(
  compositionId: number,
  nonce: string,
) {
  if (!Number.isSafeInteger(compositionId) || compositionId < 1)
    throw new Error("Invalid composition id");
  if (!/^[A-Za-z0-9_-]{21}$/.test(nonce))
    throw new Error("Invalid composition result nonce");
  return `${COMPOSITION_RESULT_PREFIX}/${compositionId}/${nonce}.png`;
}

export function isBackgroundCompositionResultKey(
  compositionId: number,
  value: unknown,
): value is string {
  if (!Number.isSafeInteger(compositionId) || compositionId < 1) return false;
  if (typeof value !== "string") return false;
  const keyPattern = new RegExp(
    `^${COMPOSITION_RESULT_PREFIX}/${compositionId}/[A-Za-z0-9_-]{21}\\.png$`,
  );
  return keyPattern.test(value);
}
