# 部署指南

本指南说明如何将 modules 文件夹作为独立代码库上传到 GitHub。

## 步骤 1: 初始化 Git 仓库

```bash
cd modules
git init
git add .
git commit -m "Initial commit: 可复用业务模块集合"
```

## 步骤 2: 创建 GitHub 仓库

1. 在 GitHub 上创建一个新仓库（例如：`GiantClam/aiwebmodules`）
2. 不要初始化 README、.gitignore 或 license（我们已经有了）

## 步骤 3: 连接并推送

```bash
git remote add origin https://github.com/GiantClam/aiwebmodules.git
git branch -M main
git push -u origin main
```

## 步骤 4: 在其他项目中使用

### 方式一：Git Submodule

```bash
# 在你的项目中添加 submodule
git submodule add https://github.com/GiantClam/aiwebmodules.git modules

# 更新 submodule
git submodule update --remote modules
```

### 方式二：npm 包（推荐）

1. 更新 `package.json` 中的仓库信息：

```json
{
  "name": "@giantclam/aiwebmodules",
  "repository": {
    "type": "git",
    "url": "https://github.com/GiantClam/aiwebmodules.git"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org/"
  }
}
```

2. 发布到 npm：

```bash
npm login
npm publish --access public
```

3. 在其他项目中使用：

```bash
npm install @your-org/modules
```

### 方式三：直接克隆

```bash
git clone https://github.com/GiantClam/aiwebmodules.git
# 然后复制到你的项目中
```

## 步骤 5: 更新原项目

在原项目中，更新导入路径：

```typescript
// 之前
import { runninghubAPI } from "@/modules/runninghub";

// 如果使用 npm 包
import { runninghubAPI } from "@giantclam/aiwebmodules/runninghub";

// 如果使用 submodule
import { runninghubAPI } from "./modules/runninghub";
```

## 注意事项

1. **版本管理：** 建议使用语义化版本（Semantic Versioning）
2. **依赖管理：** 确保 `package.json` 中的依赖版本合理
3. **文档更新：** 保持 README 和各模块文档的更新
4. **测试：** 在发布前确保各模块功能正常
5. **向后兼容：** 重大变更时考虑版本号升级

## 持续集成

可以考虑添加 GitHub Actions 来自动化：
- 类型检查
- 构建
- 测试
- 发布

示例 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run type-check
      - run: npm run build
```

