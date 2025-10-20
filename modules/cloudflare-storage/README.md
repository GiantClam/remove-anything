# Cloudflare Storage 模块接入说明

- 环境变量
  - R2_ENDPOINT
  - R2_ACCESS_KEY
  - R2_SECRET_KEY
  - R2_BUCKET
  - R2_URL_BASE（公共访问域名，如 https://s.remove-anything.com）

- 使用方式
```ts
import { uploadBufferToR2, generatePresignedPutUrl, generatePresignedGetUrl } from "@/modules/cloudflare-storage/sdk";

const publicUrl = await uploadBufferToR2(Buffer.from("hi"), "uploads/test.txt", "text/plain");
const putUrl = generatePresignedPutUrl("file.bin", "application/octet-stream");
const getUrl = generatePresignedGetUrl("uploads/file.bin");
```

