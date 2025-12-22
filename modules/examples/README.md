# 适配器示例

本目录包含各种适配器的示例实现，展示如何将模块集成到你的项目中。

## 目录结构

- `prisma-adapters/` - Prisma ORM 适配器示例
  - `prisma-repo.example.ts` - TaskRepository 的 Prisma 实现
  - `prisma-queue.example.ts` - TaskQueue 的 Prisma 实现
- `auth/` - 认证适配器示例
  - `adapter.example.ts` - 各种认证系统的适配器示例

## 使用说明

这些示例文件展示了如何为模块创建适配器。你需要：

1. 复制示例文件到你的项目中
2. 根据你的数据库模型和认证系统调整实现
3. 在项目中使用这些适配器

## 注意事项

- 示例中的 Prisma schema 结构仅供参考，你需要根据实际模型调整
- 认证适配器需要根据你使用的认证库（Clerk、NextAuth 等）进行实现
- 所有适配器都使用依赖注入模式，便于测试和替换

