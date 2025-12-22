# Tasks 适配器

本目录原本包含项目特定的 Prisma 适配器实现。

**注意：** 这些适配器已移至 `examples/prisma-adapters/` 目录作为示例。

如果你需要 Prisma 适配器，请：

1. 查看 [examples/prisma-adapters/](../../examples/prisma-adapters/) 中的示例代码
2. 根据你的数据库模型调整实现
3. 在你的项目中创建适配器文件

适配器示例：
- `prisma-repo.example.ts` - TaskRepository 的 Prisma 实现
- `prisma-queue.example.ts` - TaskQueue 的 Prisma 实现

