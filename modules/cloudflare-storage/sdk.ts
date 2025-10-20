import AWS from 'aws-sdk';

export interface R2Config {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  publicBaseUrl?: string; // 如 https://s.remove-anything.com
}

function getR2Config(overrides?: R2Config): Required<R2Config> {
  return {
    endpoint: overrides?.endpoint || process.env.R2_ENDPOINT || "",
    accessKeyId: overrides?.accessKeyId || process.env.R2_ACCESS_KEY || "",
    secretAccessKey: overrides?.secretAccessKey || process.env.R2_SECRET_KEY || "",
    bucket: overrides?.bucket || process.env.R2_BUCKET || "",
    publicBaseUrl: overrides?.publicBaseUrl || process.env.R2_URL_BASE || "",
  };
}

export function createR2Client(overrides?: R2Config) {
  const cfg = getR2Config(overrides);
  return new AWS.S3({
    endpoint: cfg.endpoint,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    signatureVersion: 'v4',
    region: 'auto',
    s3ForcePathStyle: true,
  });
}

export async function uploadBufferToR2(buffer: Buffer, key: string, contentType: string, overrides?: R2Config): Promise<string> {
  const cfg = getR2Config(overrides);
  const s3 = createR2Client(cfg);
  await s3.upload({ Bucket: cfg.bucket, Key: key, Body: buffer, ContentType: contentType }).promise();
  const publicUrl = `${cfg.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  return publicUrl;
}

export function generatePresignedPutUrl(filename: string, contentType: string, overrides?: R2Config): string {
  const cfg = getR2Config(overrides);
  const s3 = createR2Client(cfg);
  const key = `uploads/${filename}`;
  return s3.getSignedUrl('putObject', { Bucket: cfg.bucket, Key: key, ContentType: contentType, Expires: 3600 });
}

export function generatePresignedGetUrl(key: string, overrides?: R2Config): string {
  const cfg = getR2Config(overrides);
  const s3 = createR2Client(cfg);
  return s3.getSignedUrl('getObject', { Bucket: cfg.bucket, Key: key, Expires: 3600 });
}


