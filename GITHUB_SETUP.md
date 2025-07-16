# 🐙 GitHub 仓库设置指南

本指南将帮助你创建 GitHub 仓库并推送 Remove Anything 项目代码。

## 📋 前置要求

- GitHub 账户
- Git 已安装
- GitHub CLI (可选，推荐)

## 🚀 方法一：使用 GitHub CLI (推荐)

### 1. 安装 GitHub CLI

**Windows:**
```bash
winget install GitHub.cli
```

**macOS:**
```bash
brew install gh
```

**Linux:**
```bash
sudo apt install gh
```

### 2. 登录 GitHub CLI

```bash
gh auth login
```

### 3. 运行设置脚本

```bash
node scripts/setup-github-repo.js
```

这个脚本会自动：
- 创建新的 GitHub 仓库
- 更新远程仓库配置
- 推送代码
- 创建 GitHub Actions 工作流

## 🖱️ 方法二：手动创建

### 1. 在 GitHub 上创建仓库

1. 访问 [https://github.com/new](https://github.com/new)
2. 仓库名称：`remove-anything`
3. 描述：`🎨 Remove Anything - AI 背景去除工具，基于 Next.js 和 Cloudflare Workers`
4. 选择 **Public**
5. **不要**勾选 "Add a README file"
6. **不要**勾选 "Add .gitignore"
7. **不要**勾选 "Choose a license"
8. 点击 "Create repository"

### 2. 更新远程仓库配置

```bash
# 移除旧的远程仓库
git remote remove origin

# 添加新的远程仓库 (替换 YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/remove-anything.git

# 推送代码
git push -u origin main
```

### 3. 创建 GitHub Actions 工作流

创建文件 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## 🔐 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

1. 进入仓库设置：`Settings` > `Secrets and variables` > `Actions`
2. 点击 `New repository secret`
3. 添加以下 Secrets：

### 必需的 Secrets

- **CLOUDFLARE_API_TOKEN**: 你的 Cloudflare API Token
- **CLOUDFLARE_ACCOUNT_ID**: 你的 Cloudflare Account ID

### 获取 Cloudflare 凭据

1. **Account ID**: 
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 在右侧边栏找到 Account ID

2. **API Token**:
   - 进入 [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - 点击 "Create Token"
   - 选择 "Custom token"
   - 权限设置：
     - Account: Cloudflare Workers:Edit
     - Account: Cloudflare Workers Scripts:Edit
     - Zone: Cloudflare Workers Routes:Edit
   - 创建并复制 Token

## 📝 验证设置

1. 访问你的 GitHub 仓库：`https://github.com/YOUR_USERNAME/remove-anything`
2. 确认代码已成功推送
3. 检查 GitHub Actions 是否正常工作
4. 验证仓库设置中的 Secrets 已配置

## 🔄 后续步骤

设置完成后，你可以：

1. **配置环境变量**：
   ```bash
   cp env.template .env.local
   # 编辑 .env.local 文件
   ```

2. **设置 Cloudflare 服务**：
   - 参考 `CLOUDFLARE_QUICK_SETUP.md`

3. **部署应用**：
   ```bash
   npm run build
   npx wrangler deploy
   ```

4. **查看部署指南**：
   - 参考 `DEPLOYMENT_GUIDE.md`

## 🆘 常见问题

### Q: 推送代码时提示权限错误
A: 确保你已正确配置 GitHub 凭据，或使用 Personal Access Token

### Q: GitHub Actions 部署失败
A: 检查 Secrets 是否正确配置，参考 Cloudflare 文档

### Q: 如何更新远程仓库 URL
A: 使用 `git remote set-url origin NEW_URL`

## 📞 支持

如果遇到问题：

1. 查看 [GitHub 文档](https://docs.github.com/)
2. 检查项目 Issues
3. 参考 `DEPLOYMENT_GUIDE.md`

---

🎉 恭喜！你的 Remove Anything 项目已成功上传到 GitHub！ 