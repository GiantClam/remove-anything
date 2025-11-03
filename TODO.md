# 待实施任务清单

## 四、留存 & 裂变：让用户明天再回来

### 1. 邮件/推送通知功能 ⏳
- **状态**: 待实施
- **优先级**: 中
- **预期效果**: 次日回访 ↑ 8%
- **工时**: 1.5 天

#### 实施内容：
- [ ] 处理完弹窗「订阅通知，下次免排队」
- [ ] 集成 OneSignal web push（或其他推送服务）
- [ ] 实现推送通知功能：
  - 标题：「你的移除作品被点赞 52 次」
  - 支持个性化推送内容
  - 追踪推送打开率和转化率
- [ ] 创建订阅/退订管理页面
- [ ] 后端API：记录用户推送token和偏好设置

#### 技术要点：
- 使用 OneSignal SDK 或类似服务
- 需要用户授权浏览器推送权限
- 实现推送点击追踪和分析

---

### 2. 阶梯限制功能 ⏳
- **状态**: 待实施
- **优先级**: 高
- **预期效果**: 付费转化 ↑ 15%，跳出 ↓ 10%
- **工时**: 1 天

#### 实施内容：
- [ ] 修改免费额度限制逻辑：
  - 第 1-2 次：完全免费，无水印，高清
  - 第 3 次起：添加水印 + 480px 分辨率限制
  - 付费后：去水印 + 高清分辨率
- [ ] 实现水印添加功能（后端）
- [ ] 实现分辨率限制功能
- [ ] 在结果页显示升级提示：
  - 「免费用户：图片带水印，点击升级去水印」
  - 添加「立即升级」按钮
- [ ] 修改下载逻辑：
  - 免费用户：下载带水印版本
  - 付费用户：下载高清无水印版本

#### 技术要点：
- 需要追踪用户使用次数
- 后端图片处理：添加水印、分辨率调整
- 前端显示限制提示和升级CTA

---

## 五、SEO & 社媒流量 bonus

### 3. 独立 Case 页面生成 ⏳
- **状态**: 待实施
- **优先级**: 高
- **预期效果**: 日增自然流量 +18%
- **工时**: 2 天

#### 实施内容：
- [ ] 创建路由：`/case/[id]` 或 `/d/[slug]`（已有基础）
- [ ] 为每张「移除前后对比」生成独立页面
- [ ] 标题模板：`Remove people from vacation photo in 3s – case #7841`
- [ ] 实现 ISR (Incremental Static Regeneration)：
  - 初始生成静态页面
  - 定期更新或按需重新生成
  - 配置 revalidate 时间
- [ ] 页面内容：
  - Before/After 对比图
  - 案例描述和标签
  - 相关案例推荐
  - 分享按钮
  - CTA 按钮（引导用户试用）
- [ ] 生成 sitemap，包含所有 case 页面
- [ ] 确保 Google 能索引这些页面

#### 技术要点：
```typescript
// 示例路由结构
app/[locale]/(marketing)/case/[id]/page.tsx

// ISR 配置
export const revalidate = 3600; // 1小时重新验证

// generateStaticParams 用于预生成页面
export async function generateStaticParams() {
  // 从数据库获取所有案例ID
}
```

---

### 4. Instagram 图片代理功能 ⏳
- **状态**: 待实施
- **优先级**: 中
- **预期效果**: 提升上传成功率
- **工时**: 1.5 天

#### 实施内容：
- [ ] 创建后端API：`/api/instagram-proxy`
- [ ] 实现Instagram公开图抓取：
  - 支持 Instagram 公开帖子URL
  - 后端代理获取图片（避免CORS）
  - 返回图片URL给前端
- [ ] 前端集成：
  - URL输入框支持识别Instagram链接
  - 自动触发代理API
  - 显示加载状态
- [ ] 错误处理：
  - Instagram链接无效
  - 图片为私密
  - 网络错误

#### 技术要点：
```typescript
// 后端API示例
// app/api/instagram-proxy/route.ts
// 使用 puppeteer 或 cheerio 抓取Instagram图片
// 或使用第三方Instagram API（如果有）
```

#### 注意事项：
- Instagram 可能限制爬虫，需要合理使用
- 考虑使用官方 API（如果可用）
- 添加缓存机制，避免频繁请求

---

## 其他优化建议

### 5. A/B 测试框架集成 📊
- **状态**: 可选
- **优先级**: 低
- **工时**: 1 天

#### 实施内容：
- [ ] 集成 A/B 测试服务（如 Google Optimize, Optimizely）
- [ ] 测试不同按钮文案效果
- [ ] 测试不同按钮颜色效果
- [ ] 数据分析：CTR、转化率等

---

### 6. 用户行为分析增强 📈
- **状态**: 可选
- **优先级**: 低
- **工时**: 0.5 天

#### 实施内容：
- [ ] 添加更详细的事件追踪：
  - 按钮点击（带位置、文案版本）
  - 示例图片点击（哪个示例）
  - 分享按钮点击
  - 下载次数
- [ ] 漏斗分析：从访问到下载的完整路径
- [ ] 用户留存分析：7天、30天留存率

---

## 任务优先级排序

1. **高优先级**：
   - 阶梯限制功能（直接影响转化）
   - 独立 Case 页面（SEO流量）

2. **中优先级**：
   - 邮件/推送通知（提升留存）
   - Instagram 图片代理（提升用户体验）

3. **低优先级**：
   - A/B 测试框架（优化现有功能）
   - 用户行为分析增强（数据分析）

---

## 已完成任务 ✅

### 点击率优化
- ✅ 主按钮颜色优化（#FF4F5E）
- ✅ 按钮文案优化（紧迫感）
- ✅ 社交证明动态条
- ✅ URL输入框优化
- ✅ 示例图片优化展示

### 留存和裂变
- ✅ localStorage历史保存
- ✅ 分享激励功能
- ✅ 结构化数据（BeforeAndAfterGallery）

---

## 已完成性能优化 ✅

### 1. Webpack代码分割优化
- ✅ 配置splitChunks，将第三方库单独打包
- ✅ React、Next.js、UI库、工具库分别打包
- ✅ 预期：首包 ↓ 180 kB，TBT ↓ 120 ms

### 2. 缓存头配置
- ✅ 静态资源（/_next/static/**）：Cache-Control: public, max-age=31536000, immutable
- ✅ 图片资源（/images/**）：Cache-Control: public, max-age=86400, stale-while-revalidate=604800
- ✅ OG图片API（/api/og/**）：Cache-Control: public, max-age=3600
- ✅ 预期：二访TTI ↓ 60%

### 3. 图片懒加载优化
- ✅ 创建LazyImage组件（支持IntersectionObserver）
- ✅ Examples组件添加decoding="async"
- ✅ 示例图片添加loading="lazy"和decoding="async"
- ✅ 预期：LCP ↓ 0.9 s

## 已完成SEO优化 ✅

### 1. 动态Title和Description
- ✅ 首页：独特title「Remove Anything | 3秒 AI 消除照片中任何物体」
- ✅ 结果页：动态title「移除完成！前后对比 #XXXX | Remove Anything」
- ✅ 客户端动态更新meta标签
- ✅ 预期：Google Search Console有效页面 ↑ 10×

### 2. 动态OG图片
- ✅ 客户端动态更新og:image
- ✅ 生成包含taskId的OG图片URL
- ✅ 更新og:title、og:description、og:url
- ✅ 预期：Twitter/微信卡片点击率 ↑ 3-5倍

### 3. 结构化数据增强
- ✅ 结果页注入BeforeAndAfterGallery Schema.org
- ✅ 包含beforeImage和afterImage
- ✅ 动态生成JSON-LD
- ✅ 预期：Google Image出现「前后对比」badge，CTR ↑ 2%

## 待实施（需要额外配置）

### ⚠️ 文本资源压缩（需要Railway配置）
- **状态**: 需要服务器配置
- **操作**: Railway → Settings → Enable Brotli
- **Nginx配置**: `gzip_static on; brotli_static on;`
- **预期**: FCP ↓ 1.2 s，Lighthouse +18 分

### ⚠️ 图片格式转换（需要构建脚本）
- **状态**: 需要手动转换或构建脚本
- **操作**: 
  - public/images 批量转WebP（质量80）
  - 使用sharp或imagemin
- **预期**: 体积 ↓ 65%

### ⚠️ react-dropzone动态导入
- **状态**: 待检查是否有使用
- **操作**: 如果使用了，改为`const Dropzone = dynamic(() => import('react-dropzone'))`
- **预期**: 首包 ↓ 部分大小

### ⚠️ Service Worker（需要Workbox）
- **状态**: 需要安装workbox
- **操作**: 
  - 安装 `workbox-webpack-plugin`
  - 配置预缓存策略
  - 缓存 /static/** 资源1年
- **预期**: 二访TTI ↓ 60%

## 更新日志

- 2025-01-21: 创建初始待办清单
- 2025-01-21: 完成webpack代码分割和缓存头配置
- 2025-01-21: 完成图片懒加载优化
- 2025-01-21: 完成SEO优化（动态title、OG图片、结构化数据）

