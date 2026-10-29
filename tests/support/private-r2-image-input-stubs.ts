export const privateR2ImageState = {
  signedCalls: [] as Array<{ key: string; bucket: string; expiresIn: number }>,
  reset() {
    this.signedCalls.length = 0;
  },
};

export const env = {
  R2_ENDPOINT: "https://r2-s3.example.test",
  R2_BUCKET: "remove-anything-test",
  R2_URL_BASE: "https://placeholder.com",
  R2_ACCESS_KEY: "test",
  R2_SECRET_KEY: "test",
  R2_REGION: "auto",
};

export function createR2S3Service() {
  return {
    async getSignedUrl(key: string, bucket: string, expiresIn: number) {
      privateR2ImageState.signedCalls.push({ key, bucket, expiresIn });
      return `https://r2-s3.example.test/${bucket}/${encodeURIComponent(key)}?signature=test`;
    },
  };
}
