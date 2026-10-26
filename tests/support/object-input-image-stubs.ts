export const objectInputImageState = {
  signedCalls: [] as Array<{ key: string; bucket: string; expiresIn: number }>,
  fetchUrls: [] as string[],
  allowlistChecks: [] as Array<{ value: string; prefixes?: string }>,
  reset() {
    this.signedCalls.length = 0;
    this.fetchUrls.length = 0;
    this.allowlistChecks.length = 0;
  },
};

export const env = {
  R2_ENDPOINT: "https://r2-s3.example.test",
  R2_BUCKET: "remove-anything-test",
  R2_URL_BASE: "https://files.example.test",
  RUNNINGHUB_OUTPUT_URL_PREFIXES: "https://provider.example.test/outputs",
};

export function createR2S3Service() {
  return {
    async getSignedUrl(key: string, bucket: string, expiresIn: number) {
      objectInputImageState.signedCalls.push({ key, bucket, expiresIn });
      return `https://r2-s3.example.test/${bucket}/${encodeURIComponent(key)}?signature=test`;
    },
  };
}

export function isAllowedRunningHubOutput(
  value: string,
  prefixes = env.RUNNINGHUB_OUTPUT_URL_PREFIXES,
) {
  objectInputImageState.allowlistChecks.push({ value, prefixes });
  return (prefixes || "").split(",").some((entry) => {
    try {
      const prefix = new URL(entry.trim());
      const output = new URL(value);
      return (
        prefix.protocol === "https:" &&
        output.protocol === "https:" &&
        prefix.origin === output.origin &&
        prefix.pathname !== "/" &&
        output.pathname.startsWith(`${prefix.pathname.replace(/\/$/, "")}/`)
      );
    } catch {
      return false;
    }
  });
}
