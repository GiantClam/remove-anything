# 从 Redis 迁移到 Cloudflare KV 指南

本指南将帮助您将项目从 Upstash Redis 迁移到 Cloudflare KV，以获得更好的性能和成本效益。

## 🔄 迁移概述

本次迁移将：
- 替换所有 Redis 调用为 Cloudflare KV
- 保持现有 API 接口的兼容性
- 实现基于 KV 的速率限制功能
- 移除 Redis 相关依赖

## 📋 已完成的更改

### 1. 环境变量更新
- ✅ 移除了 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`
- ✅ 添加了 `CLOUDFLARE_KV_NAMESPACE_ID`、`CLOUDFLARE_KV_ACCOUNT_ID` 和 `CLOUDFLARE_KV_API_TOKEN`

### 2. 代码更改
- ✅ 创建了 `lib/kv.ts` - Cloudflare KV 客户端
- ✅ 更新了 `lib/redis.ts` - 现在使用 KV 客户端
- ✅ 实现了基于 KV 的速率限制器

### 3. 依赖更新
- ✅ 移除了 `@upstash/redis` 和 `@upstash/ratelimit`
- ✅ 更新了 `package.json`

## 🛠️ 设置 Cloudflare KV

### 1. 创建 KV 命名空间

在 Cloudflare 控制台中：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择您的账户
3. 导航到 `Workers & Pages` > `KV`
4. 点击 `Create namespace`
5. 命名您的命名空间（例如：`remove-anything-kv`）
6. 记录生成的 `Namespace ID`

### 2. 获取 API 令牌

1. 在 Cloudflare 控制台中，导航到 `My Profile` > `API Tokens`
2. 点击 `Create Token`
3. 选择 `Custom token`
4. 配置权限：
   - **Account**: `Cloudflare Workers:Edit`
   - **Zone Resources**: `Include All zones`
   - **Account Resources**: `Include All accounts`
5. 记录生成的 API 令牌

### 3. 配置环境变量

更新您的 `.env.local` 文件：

```bash
# 移除这些旧的 Redis 环境变量
# UPSTASH_REDIS_REST_URL=...
# UPSTASH_REDIS_REST_TOKEN=...

# 添加新的 Cloudflare KV 环境变量
CLOUDFLARE_KV_NAMESPACE_ID=your-kv-namespace-id
CLOUDFLARE_KV_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_KV_API_TOKEN=your-cloudflare-api-token
```

## 🔧 API 兼容性

新的 KV 客户端完全兼容原有的 Redis API：

```typescript
// 这些调用保持不变
await redis.get('key')
await redis.set('key', 'value', { ex: 3600 })
await redis.incr('counter')
await redis.del('key')
await redis.exists('key')

// 速率限制也保持不变
const { success } = await ratelimit.limit('user:123')
```

## 🚀 部署到 Cloudflare Pages

### 1. 在 Pages 项目中配置环境变量

1. 打开您的 Cloudflare Pages 项目
2. 导航到 `Settings` > `Environment variables`
3. 添加以下环境变量：
   - `CLOUDFLARE_KV_NAMESPACE_ID`
   - `CLOUDFLARE_KV_ACCOUNT_ID`
   - `CLOUDFLARE_KV_API_TOKEN`

### 2. 绑定 KV 命名空间（可选）

如果您想在 Edge Runtime 中直接使用 KV 绑定：

1. 在 Pages 项目设置中
2. 导航到 `Functions` > `KV namespace bindings`
3. 添加绑定：
   - **Variable name**: `KV`
   - **KV namespace**: 选择您创建的命名空间

## 📊 性能对比

| 功能 | Redis (Upstash) | Cloudflare KV |
|------|-----------------|---------------|
| 读取延迟 | ~50-200ms | ~10-50ms |
| 写入延迟 | ~100-300ms | ~50-200ms |
| 全球分布 | 区域性 | 全球 CDN |
| 免费额度 | 有限 | 100K 读/天 |
| 成本 | 按使用量 | 更低成本 |

## 🔍 验证迁移

运行以下命令检查迁移是否成功：

```bash
# 安装依赖
npm install
# 或
pnpm install

# 启动开发服务器
npm run dev
# 或
pnpm dev
```

检查控制台输出，确认看到：
- `Cloudflare KV environment variables not configured, using mock KV client`（开发环境）
- 或者 KV 客户端成功初始化的消息

## 🐛 故障排除

### 1. 环境变量问题
```bash
# 检查环境变量是否正确设置
echo $CLOUDFLARE_KV_NAMESPACE_ID
echo $CLOUDFLARE_KV_ACCOUNT_ID
echo $CLOUDFLARE_KV_API_TOKEN
```

### 2. API 权限问题
确保您的 API 令牌具有正确的权限：
- `Cloudflare Workers:Edit`
- 对应账户的访问权限

### 3. 命名空间 ID 问题
在 Cloudflare 控制台中双重检查命名空间 ID 是否正确。

## 📈 监控和调试

### 1. 开发环境
在开发环境中，系统会自动使用模拟的 KV 客户端，存储在内存中。

### 2. 生产环境
在生产环境中，可以通过 Cloudflare Analytics 监控 KV 使用情况：
- 请求数量
- 响应时间
- 错误率

## 🔄 回滚计划

如果需要回滚到 Redis：

1. 恢复 `package.json` 中的 Redis 依赖
2. 恢复原始的 `lib/redis.ts` 文件
3. 更新环境变量为 Redis 配置
4. 重新部署应用

## 📝 注意事项

1. **数据一致性**: KV 是最终一致性存储，不同于 Redis 的强一致性
2. **事务支持**: KV 不支持事务，复杂的原子操作需要重新设计
3. **数据类型**: KV 主要存储字符串，复杂数据结构需要序列化
4. **TTL 精度**: KV 的 TTL 精度较低，最小单位为秒

## 🎉 完成！

您已成功将项目从 Redis 迁移到 Cloudflare KV！现在您可以享受更快的全球访问速度和更低的成本。

如果遇到任何问题，请查看：
- [Cloudflare KV 文档](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/) 