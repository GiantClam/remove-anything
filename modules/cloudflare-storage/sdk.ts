import { S3Client, PutObjectCommand, GetObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
  return new S3Client({
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    region: 'auto',
    forcePathStyle: true,
  });
}

export async function uploadBufferToR2(buffer: Buffer, key: string, contentType: string, overrides?: R2Config): Promise<string> {
  const cfg = getR2Config(overrides);
  const s3 = createR2Client(cfg);
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3.send(command);
  const publicUrl = `${cfg.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  return publicUrl;
}

export async function generatePresignedPutUrl(filename: string, contentType: string, overrides?: R2Config): Promise<string> {
  const cfg = getR2Config(overrides);
  const s3 = createR2Client(cfg);
  const key = `uploads/${filename}`;
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function generatePresignedGetUrl(key: string, overrides?: R2Config): Promise<string> {
  const cfg = getR2Config(overrides);
  const s3 = createR2Client(cfg);
  const command = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}

/**
 * 配置 R2 存储桶的 CORS 规则
 * 需要在 Cloudflare 控制台或通过 API 配置
 * 此函数用于程序化配置 CORS
 */
export async function configureBucketCORS(
  allowedOrigins: string[] = ['*'],
  allowedMethods: string[] = ['GET', 'PUT', 'HEAD', 'POST', 'DELETE'],
  allowedHeaders: string[] = ['Content-Type', 'Authorization'],
  overrides?: R2Config
): Promise<void> {
  const cfg = getR2Config(overrides);
  const s3 = createR2Client(cfg);
  
  const command = new PutBucketCorsCommand({
    Bucket: cfg.bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: allowedHeaders,
          AllowedMethods: allowedMethods,
          AllowedOrigins: allowedOrigins,
          ExposeHeaders: ['ETag', 'Content-Length'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  });
  
  await s3.send(command);
}


