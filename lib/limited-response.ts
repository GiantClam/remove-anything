/** Read a remote result without trusting Content-Length or buffering unbounded data. */
export class ResultSizeLimitError extends Error {
  constructor(public readonly maxBytes: number) {
    super("Result exceeds the supported output size");
    this.name = "ResultSizeLimitError";
  }
}

export async function readLimitedResponse(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
    throw new Error("Invalid result size limit");
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    await response.body?.cancel();
    throw new ResultSizeLimitError(maxBytes);
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ResultSizeLimitError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
