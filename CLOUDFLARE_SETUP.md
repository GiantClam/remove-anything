# Cloudflare 服务设置指南

本项目已移除所有mock服务，必须使用真实的Cloudflare服务。请按照以下步骤设置所需的Cloudflare服务。

## 1. 创建 Cloudflare KV 存储

### 步骤：
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择您的账户
3. 进入 **Workers & Pages** → **KV**
4. 点击 **Create a namespace**
5. 输入命名空间名称（例如：`next-money-kv`）
6. 点击 **Add**
7. 复制生成的 **Namespace ID**

### 环境变量：
```bash
CLOUDFLARE_KV_NAMESPACE_ID=your_namespace_id_here
```

## 2. 创建 Cloudflare R2 存储

### 步骤：
1. 在 Cloudflare Dashboard 中进入 **R2 Object Storage**
2. 点击 **Create bucket**
3. 输入存储桶名称（例如：`next-money-storage`）
4. 选择区域（推荐 `auto`）
5. 点击 **Create bucket**
6. 进入 **Manage R2 API tokens**
7. 点击 **Create API token**
8. 设置权限：
   - **Permissions**: Read and Write
   - **Bucket**: 选择您创建的存储桶
9. 点击 **Create API token**
10. 复制生成的 **Access Key ID** 和 **Secret Access Key**

### 环境变量：
```bash
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_REGION=auto
R2_ACCESS_KEY=your_access_key_here
R2_SECRET_KEY=your_secret_key_here
R2_URL_BASE=https://your-custom-domain.com  # 或者使用 R2 的公共URL
R2_BUCKET=next-money-storage
R2_ACCOUNT_ID=your_account_id_here
```

## 3. 创建 Cloudflare AI Gateway

### 步骤：
1. 在 Cloudflare Dashboard 中进入 **AI** → **AI Gateway**
2. 点击 **Create Gateway**
3. 输入网关名称（例如：`next-money-gateway`）
4. 选择要代理的AI提供商（Replicate、OpenAI等）
5. 点击 **Create Gateway**
6. 复制生成的网关URL

### 环境变量：
```bash
CLOUDFLARE_AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/your-account-id/your-gateway-name
CLOUDFLARE_AI_GATEWAY_TOKEN=your_ai_gateway_token_here
```

## 4. 创建 Cloudflare API Token

### 步骤：
1. 进入 **My Profile** → **API Tokens**
2. 点击 **Create Token**
3. 选择 **Custom token**
4. 设置以下权限：
   - **Account**: `Cloudflare Workers:Edit`
   - **Zone**: `Zone:Read` (如果需要)
   - **Account**: `Account:Read`
5. 设置账户资源：选择您的账户
6. 点击 **Continue to summary**
7. 点击 **Create Token**
8. 复制生成的 API Token

### 环境变量：
```bash
CLOUDFLARE_KV_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_KV_API_TOKEN=your_api_token_here
```

## 5. 配置 AI 模型 API 密钥

### Replicate API：
1. 访问 [Replicate](https://replicate.com)
2. 注册并登录
3. 进入 **Account** → **API tokens**
4. 创建新的API token
5. 复制 API token

### Google Gemini API：
1. 访问 [Google AI Studio](https://aistudio.google.com)
2. 创建 API 密钥
3. 复制 API 密钥

### 环境变量：
```bash
REPLICATE_API_TOKEN=r8_your_replicate_token_here
GEMINI_API_KEY=your_gemini_api_key_here
FLUX_AI_PROMPT=your_flux_ai_prompt_here
```

## 6. 完整的环境变量示例

创建 `.env.local` 文件：

```bash
# 数据库
DATABASE_URL=file:./dev.db

# Cloudflare KV
CLOUDFLARE_KV_NAMESPACE_ID=your_namespace_id_here
CLOUDFLARE_KV_ACCOUNT_ID=your_account_id_here  
CLOUDFLARE_KV_API_TOKEN=your_api_token_here

# Cloudflare R2
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_REGION=auto
R2_ACCESS_KEY=your_access_key_here
R2_SECRET_KEY=your_secret_key_here
R2_URL_BASE=https://your-custom-domain.com
R2_BUCKET=next-money-storage
R2_ACCOUNT_ID=your_account_id_here

# Cloudflare AI Gateway
CLOUDFLARE_AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/your-account-id/your-gateway-name
CLOUDFLARE_AI_GATEWAY_TOKEN=your_ai_gateway_token_here

# AI 模型 API
REPLICATE_API_TOKEN=r8_your_replicate_token_here
GEMINI_API_KEY=your_gemini_api_key_here
FLUX_AI_PROMPT=your_flux_ai_prompt_here

# 其他必需的环境变量
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=https://your-domain.com
STRIPE_API_KEY=sk_test_your_stripe_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## 7. 验证配置

运行以下命令验证配置：

```bash
npm run build
```

如果配置正确，应该能够成功构建项目。如果有任何环境变量缺失，会显示详细的错误信息。

## 8. 部署到 Cloudflare Pages

1. 在 Cloudflare Dashboard 中进入 **Workers & Pages**
2. 点击 **Create application**
3. 选择 **Pages** → **Connect to Git**
4. 连接您的 Git 仓库
5. 配置构建设置：
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
6. 添加所有环境变量
7. 点击 **Save and Deploy**

## 9. 故障排除

如果遇到以下错误：

### KV 相关错误：
- 检查 Namespace ID 是否正确
- 确认 API Token 有正确的权限
- 验证 Account ID 是否正确

### R2 相关错误：
- 检查存储桶名称是否正确
- 确认 Access Key 和 Secret Key 是否有效
- 验证存储桶的区域设置

### AI Gateway 相关错误：
- 检查网关URL格式是否正确
- 确认网关已正确配置
- 验证 AI 模型 API 密钥是否有效

有任何问题请参考 [Cloudflare 文档](https://developers.cloudflare.com) 或联系技术支持。 