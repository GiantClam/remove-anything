# Cloudflare 快速设置指南

## 前提条件
- 注册并登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
- 确保你有一个活跃的Cloudflare账户

---

## 第一步：创建 Cloudflare KV 存储

### 1. 进入KV管理页面
1. 登录 Cloudflare Dashboard
2. 在左侧菜单中点击 **Workers & Pages**
3. 点击 **KV** 标签

### 2. 创建KV命名空间
1. 点击 **Create a namespace** 按钮
2. 输入命名空间名称：`next-money-kv`
3. 点击 **Add** 按钮
4. **复制生成的 Namespace ID**（类似：`abcd1234efgh5678`）

### 3. 获取账户ID
1. 在右侧栏找到 **Account ID**
2. **复制账户ID**（类似：`1234567890abcdef`）

---

## 第二步：创建 Cloudflare R2 存储

### 1. 进入R2管理页面
1. 在Cloudflare Dashboard左侧菜单中点击 **R2 Object Storage**

### 2. 创建R2存储桶
1. 点击 **Create bucket** 按钮
2. 输入存储桶名称：`next-money-storage`
3. 选择位置：**Automatic** (推荐)
4. 点击 **Create bucket**

### 3. 创建R2 API Token
1. 点击 **Manage R2 API tokens**
2. 点击 **Create API token**
3. 配置权限：
   - **Token name**: `Next Money API Token`
   - **Permissions**: 选择 **Object Read & Write**
   - **Specify bucket**: 选择刚创建的 `next-money-storage`
4. 点击 **Create API token**
5. **复制以下信息**：
   - Access Key ID
   - Secret Access Key
   - Endpoint URL（形如：`https://1234567890abcdef.r2.cloudflarestorage.com`）

---

## 第三步：创建 Cloudflare AI Gateway

### 1. 进入AI Gateway页面
1. 在Cloudflare Dashboard左侧菜单中点击 **AI**
2. 点击 **AI Gateway** 标签

### 2. 创建AI Gateway
1. 点击 **Create Gateway** 按钮
2. 输入网关名称：`next-money-gateway`
3. 点击 **Create Gateway**
4. **复制Gateway URL**（形如：`https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/next-money-gateway`）

---

## 第四步：创建 API Token（用于KV访问）

### 1. 进入API Token管理页面
1. 点击右上角头像，选择 **My Profile**
2. 点击 **API Tokens** 标签
3. 点击 **Create Token** 按钮

### 2. 创建自定义Token
1. 选择 **Custom token** 模板
2. 配置Token权限：

**Token名称**: `Next Money KV Token`

**权限设置**:
- **Account** - `Cloudflare Workers:Edit`
- **Account** - `Account:Read`
- **Zone** - `Zone:Read` (可选)

**账户资源**:
- **Include** - `All accounts` 或选择特定账户

**Zone资源**: 
- 如果你有域名：选择 `All zones` 或特定Zone
- 如果没有域名：选择 `All zones`

3. 点击 **Continue to summary**
4. 点击 **Create Token**
5. **复制生成的API Token**（以 `_` 开头的长字符串）

---

## 第五步：获取AI模型API密钥

### Replicate API Token
1. 访问 [Replicate](https://replicate.com)
2. 注册并登录账户
3. 进入 **Account** → **API tokens**
4. 点击 **Create token**
5. **复制API Token**（以 `r8_` 开头）

### Google Gemini API Key
1. 访问 [Google AI Studio](https://aistudio.google.com)
2. 点击 **Get API key**
3. 创建新项目或选择现有项目
4. 点击 **Create API key**
5. **复制API密钥**

---

## 第六步：配置环境变量

创建 `.env.local` 文件并填入以下信息：

```bash
# 数据库
DATABASE_URL=file:./dev.db

# Cloudflare KV （从第一步获取）
CLOUDFLARE_KV_NAMESPACE_ID=你的KV命名空间ID
CLOUDFLARE_KV_ACCOUNT_ID=你的账户ID
CLOUDFLARE_KV_API_TOKEN=你的API_Token

# Cloudflare R2 （从第二步获取）
R2_ENDPOINT=https://你的账户ID.r2.cloudflarestorage.com
R2_REGION=auto
R2_ACCESS_KEY=你的R2_Access_Key
R2_SECRET_KEY=你的R2_Secret_Key
R2_URL_BASE=https://你的自定义域名.com
R2_BUCKET=next-money-storage
R2_ACCOUNT_ID=你的账户ID

# Cloudflare AI Gateway （从第三步获取）
CLOUDFLARE_AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/你的账户ID/next-money-gateway
CLOUDFLARE_AI_GATEWAY_TOKEN=你的AI_Gateway_Token

# AI 模型 API （从第五步获取）
REPLICATE_API_TOKEN=r8_你的Replicate_Token
GEMINI_API_KEY=你的Gemini_API_Key
FLUX_AI_PROMPT=你的Flux提示词

# 应用基础配置
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_EMAIL_FROM=noreply@localhost
NEXTAUTH_SECRET=你的NextAuth密钥
NEXTAUTH_URL=http://localhost:3000

# 其他服务（可选）
STRIPE_API_KEY=sk_test_你的Stripe密钥
STRIPE_WEBHOOK_SECRET=whsec_你的Stripe_Webhook密钥
RESEND_API_KEY=re_你的Resend密钥
HASHID_SALT=你的哈希盐值
WEBHOOK_SECRET=你的Webhook密钥
LOG_SNAG_TOKEN=你的LogSnag_Token
TASK_HEADER_KEY=你的任务头部密钥
FLUX_HEADER_KEY=你的Flux头部密钥
FLUX_CREATE_URL=https://你的Flux服务地址
```

---

## 第七步：验证配置

1. 保存 `.env.local` 文件
2. 运行构建命令验证配置：

```bash
npm run build
```

如果配置正确，构建应该成功完成。

---

## 常见问题

### Q: 找不到Workers & Pages菜单
A: 确保你的Cloudflare账户已经激活。如果是新账户，可能需要先添加一个域名。

### Q: 无法创建API Token
A: 确保你有足够的账户权限。如果是团队账户，需要管理员权限。

### Q: R2存储桶无法访问
A: 检查R2 API Token的权限设置，确保包含对应存储桶的读写权限。

### Q: AI Gateway连接失败
A: 确保Gateway URL格式正确，包含完整的账户ID和网关名称。

---

## 安全提醒

⚠️ **重要**：
- 不要将 `.env.local` 文件提交到Git仓库
- 定期轮换API密钥
- 为不同环境使用不同的服务实例
- 在生产环境中使用更严格的权限设置

---

## 后续步骤

配置完成后，你可以：
1. 运行开发服务器：`npm run dev`
2. 部署到Cloudflare Pages
3. 监控服务使用情况
4. 根据需要调整配置

有任何问题，请参考 [Cloudflare 文档](https://developers.cloudflare.com) 或项目的详细文档。 