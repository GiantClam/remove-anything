# Remove Anything P0 需求规格

**版本**：v0.1（需求已通过 grill-me 逐轮确认）
**日期**：2026-10-14（Asia/Shanghai）
**目标**：把研究方案收敛为可以进入工程、增长和账户配置排期的 P0 规格。

## 1. 目标和决策边界

90 天的首要目标是建立可信的第一方测量，并验证至少一条“搜索落地页 → 工具完成 → 下载/注册 → 付费”的闭环。月访问量 20 万仍是 6–12 个月的规划假设，不是 P0 的承诺，也不能用第三方 ETV、CPC 或搜索量替代真实结果。

P0 的完成必须同时满足：生产 GA4/GSC 可用、页面与服务端配额一致、核心任务状态和事件可追踪、`/remove-objects` 的索引策略一致、六个页面能完成真实任务，并且有可回滚的测试和发布证据。

研究和证据来源：

- [增长与商业化方案](/Users/beihuang/Documents/ChatGPT/marketing/research/remove-anything-2026-10-13/strategy.md)
- [数据与代码证据台账](/Users/beihuang/Documents/ChatGPT/marketing/research/remove-anything-2026-10-13/evidence.md)
- [Semrush 竞品与关键词证据](/Users/beihuang/Documents/ChatGPT/marketing/research/remove-anything-2026-10-13/competitor-keyword-evidence.md)
- [首轮 backlog](/Users/beihuang/Documents/ChatGPT/marketing/research/remove-anything-2026-10-13/backlog.md)

## 2. P0 范围

### 包含

1. `SEO-001`：将 `/remove-objects` 定为可索引页面，加入工具 sitemap、导航和相关工具链接，删除旧的 `noindex` 断言。
2. `ANA-001/002`：建立目标站 GA4 property 和 GSC，确认生产 `NEXT_PUBLIC_GA_ID`，实现统一漏斗事件和服务端 purchase 对账。
3. `BILL-001`：统一匿名、登录和付费额度；服务端成为 quota 和 credits 的唯一事实源。
4. `SEO-002`：建立工具 registry，驱动 canonical、metadata、sitemap、可用语言、内链和验收。
5. `TOOL-001`：重写六个现有 canonical 页面，统一任务流程、结果页、错误/重试、限制说明、FAQ、Schema 和 CTA。

### 不包含

- Background Removal API 页面、API 定价、限速和销售流程；P1 再决定 `/api/background-removal` 或 `/remove-background-api` 的 canonical。
- 15–20 个新增页面、批量扩张、比较页集群、英文之外的本地化页面。
- 完整 Starter/Pro/Business/API 单位经济重算；P0 只要求成本数据和付费启用前的配置门槛。
- 新模型研发或未经成本验证的格式、分辨率和批处理能力扩张。

## 3. 页面和用户流程

### 3.1 Canonical 页面

保留现有 canonical 路径：

- `/remove-background`
- `/remove-objects`
- `/transparent-png-maker`
- `/white-background-maker`
- `/change-background-color`
- `/remove-watermark`

不在 P0 重命名路径。以后如需更短的关键词路径，必须通过 301/别名和 canonical 评审，不得产生两个页面争夺同一意图。

### 3.2 统一主流程

六个页面都实现：

1. 上传或选择输入；
2. 显示输入预览和限制；
3. 创建带唯一 `task_id` 的任务；
4. 显示 `queued → processing → succeeded/failed/expired` 状态；
5. 成功后展示前后对比、输出信息和一个主 CTA；
6. 结果后再推荐白底、透明 PNG、压缩或其他相关工具。

首个任务前不强制注册。结果产生后，高清、批量、历史记录和商业用途触发注册或升级。

### 3.3 输出契约

各工具可以保留真实且必要的输出格式（例如背景移除 PNG、去水印 ZIP），但每个工具必须在 registry 和页面上声明：

- 预览格式和尺寸；
- 匿名可下载的低分辨率输出；
- 付费完整输出的格式、尺寸和 credits 消耗；
- 结果过期时间和下载权限。

不得在尚未实现完整输出前宣传“高清”或“无损”。

## 4. 配额、身份和计费

### 4.1 免费权益

- 匿名主体：每 24 小时 1 次低分辨率图片任务。
- 登录用户：每 UTC 自然月 5 次图片任务。
- 失败上传不消耗额度；处理暂时失败的重试不重复扣除。
- 高清、批量、历史记录和商业用途必须进入付费额度路径。
- 所有前端文案、FAQ、仪表盘、API 和服务端都读取同一份服务端 quota 配置，不再出现“5/month”与“50/day”并存。

匿名主体使用签名 token/cookie 绑定任务，并叠加 IP/设备级限流和异常检测；不得把原始 IP 作为长期分析身份。登录主体按账户计数。

### 4.2 Credits

工具 registry 的 `creditCost` 是必填字段。已知基线为背景移除 2 credits、去水印 1 credit；物体移除和其他页面必须在付费开启前根据 GPU、队列、存储、失败重试和输出尺寸批准成本。

成本值未批准的工具可以做免费验证，但不得开启付费路径或发送不完整的 `credits_before/after`。详细毛利表、最低价格、限速和异常成本报警属于 `BILL-002`。

### 4.3 任务状态和重试

- 每个任务必须有唯一 `task_id` 和可追踪的外部任务 ID。
- 状态统一为 `queued`、`processing`、`succeeded`、`failed`、`expired`；适配器负责映射供应商状态。
- 暂时失败最多自动重试 1 次；用户手动重试保持幂等，不重复扣额度。
- 永久失败退回预扣额度，并发送 `processing_failed` 和退款/返还审计记录。
- 下载接口必须校验任务主体、任务状态和过期时间。

## 5. 事件和事实源

### 5.1 事件链

`tool_view → upload_started → upload_completed → processing_started → processing_completed/failed → download_clicked → signup_started/completed → paywall_viewed → checkout_started → purchase_completed → credits_consumed`

浏览器负责行为事件；服务端负责处理完成/失败、额度扣除、订单和 webhook purchase。收入事实不得只由浏览器按钮点击产生。

### 5.2 公共字段和去重

适用时所有事件包含：

`tool_slug`、`landing_page`、`locale`、`file_type`、`file_size_bucket`、`is_authenticated`、`plan`、`credits_before`、`credits_after`、`experiment_id`、`event_id`。

任务事件还要包含 `task_id`；支付事件包含 `order_id`。服务端事件和 webhook 必须幂等，重复 webhook 不得重复记账或重复发送 purchase。

### 5.3 发布前数据门槛

账户持有人必须完成 GA4 property、GSC 域名验证、生产环境变量和 GA4 DebugView；工程负责事件、服务端对账、验证脚本和证据截图。生产发布和 28 天基线计时都以这些条件完成为前提。

## 6. 工具 registry 和 SEO

registry 至少包含：

`slug`、`canonicalPath`、`indexable`、`primaryKeyword`、`availableLocales`、`toolType`、输入/输出格式、文件/尺寸限制、`creditCost`、主 CTA、`lastModified`、结果过期时间。

registry 驱动 metadata、canonical、sitemap、相关工具和可用语言。P0 只验证英文；其他 locale 只能显式配置，不自动生成机器翻译页面。

每个可索引页面必须有真实工具状态、前后样例、输入/输出、限制、FAQ、可见 H1、canonical、与可见内容一致的 Schema 和相关工具链接。没有真实能力或长期无展示的页面必须合并或 `noindex`。

## 7. 合规、隐私和容量保护

- 去水印、去 Logo、去人物/文字任务在提交前显示“仅处理自己拥有或获授权的图片”，并记录确认时间、政策版本、主体和 `task_id`。
- 提供滥用举报和删除路径，页面、任务日志、条款和客服处理保持一致。
- 原始上传和结果保留 24 小时后自动删除；用户可提前删除；最小化审计元数据保留 90 天；不用于模型训练。
- 每个工具设置服务端文件大小、分辨率、队列等待、处理超时和并发上限；最多 1 次自动重试；设置每日 GPU 成本告警和必要时的熔断开关。
- 当前代码、线上文案和组件存在 10MB/15MB 等限制差异；最终值必须通过代码、GPU、队列、存储和失败数据核对后批准，不能直接复制现有文案。

## 8. 验收和发布

### 工程验证

- 单元测试：quota、registry、事件 schema、状态机、credits 返还和去重。
- 集成测试：任务创建、状态回调、下载权限、支付 webhook 和 credits 对账。
- 浏览器冒烟：六个 canonical 页面均能完成上传 → 处理 → 结果/失败 → 下载/升级路径。
- 线上检查：GA4 DebugView、GSC、sitemap、canonical、`/remove-objects` indexability、真实 purchase 和审计记录。

### 28 天扩张门槛

连续 28 天满足发布硬门槛后，必须同时看到：

- 至少 3 个核心页面在 GSC 有真实展示；
- 处理完成率和下载率形成稳定基线；
- 至少一条可归因的注册、购买或销售线索信号；
- 每周按页面、工具、国家、语言、认证状态复盘展示 → 访问 → 完成 → 下载 → 注册 → 首购 → 30 日复购；
- 工程复盘失败率、处理延迟、成本和事件缺失。

只有表现最好的 1–2 个意图簇满足这些条件，才进入 P1 的 15–20 个新增页面。

## 9. Issue 映射和责任

| Issue | 交付重点 | 阻塞条件 |
|---|---|---|
| SEO-001 | `/remove-objects` 页面、sitemap、导航、旧测试统一为 `index, follow` | canonical、sitemap、页面 metadata、验证脚本必须一致 |
| ANA-001 | GA4/GSC、生产 GA ID、DebugView | 账户持有人完成授权和域名验证 |
| ANA-002 | 事件 schema、服务端事件、purchase/credits 对账 | 事件去重、任务/订单 ID 可追踪 |
| BILL-001 | 匿名 token、5/月、1/24h、失败不扣、结果升级门 | 服务端 quota 和前端/FAQ/仪表盘一致 |
| SEO-002 | 单一 registry 驱动 SEO 和内链 | `creditCost`、限制和可索引策略不可缺失 |
| TOOL-001 | 六页统一流程、结果契约、状态机、合规提示和 CTA | 六页均有真实任务和浏览器冒烟证据 |

现状差距必须作为 Issue 进入实现，而不是作为已完成能力：当前页面业务事件不完整、部分失败路径无重试、匿名 API 行为未统一、不同工具的输出和限制不一致。

## 10. 证据边界

第三方搜索量、Semrush/DataForSEO ETV、竞品页面和公开价格只用于优先级和假设，不用于证明 remove-anything 的访问量、收入、排名或产品市场匹配。所有增长结论必须以接入后的 GA4/GSC、任务日志、支付 webhook 和页面级实验数据为准。
