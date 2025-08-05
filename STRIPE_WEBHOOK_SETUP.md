# Stripe Webhook 配置指南

## 🚨 重要：Webhook 配置已修复

我已经修复了项目中的 Stripe webhook 处理程序，现在支持完整的事件处理。

## 📋 需要配置的 Webhook 事件

在 Stripe Dashboard 中，你需要为以下事件配置 webhook：

### 🔥 必需事件（一次性付款）
1. **`checkout.session.completed`** - 支付完成
2. **`payment_intent.succeeded`** - 支付意图成功

### 📅 可选事件（订阅功能）
3. **`invoice.payment_succeeded`** - 订阅付款成功
4. **`customer.subscription.created`** - 订阅创建
5. **`customer.subscription.updated`** - 订阅更新
6. **`customer.subscription.deleted`** - 订阅删除

## 🔧 配置步骤

### 1. 获取 Webhook Secret

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com)
2. 进入 **Developers** > **Webhooks**
3. 点击 **Add endpoint**
4. 设置端点 URL：`https://yourdomain.com/api/webhooks/stripe`
5. 选择上述事件类型
6. 点击 **Add endpoint**
7. 复制 **Signing secret**（以 `whsec_` 开头）

### 2. 配置环境变量

在 `.env.local` 文件中添加：

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 3. 测试 Webhook

使用 Stripe CLI 测试 webhook：

```bash
# 安装 Stripe CLI
brew install stripe/stripe-cli/stripe

# 登录
stripe login

# 监听 webhook 事件
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 触发测试事件
stripe trigger checkout.session.completed
```

## 🔍 Webhook 处理逻辑

### 一次性付款流程

1. **用户点击购买** → 创建 `ChargeOrder` 记录
2. **跳转到 Stripe Checkout** → 用户完成支付
3. **Stripe 发送 webhook** → `checkout.session.completed`
4. **更新订单状态** → `OrderPhase.Pending` → `OrderPhase.Paid`
5. **增加用户积分** → 更新 `UserCredit` 表
6. **记录交易历史** → 创建 `UserCreditTransaction` 记录

### 订阅流程

1. **用户订阅** → 创建 Stripe 订阅
2. **Stripe 发送 webhook** → `customer.subscription.created`
3. **更新用户信息** → 更新 `UserPaymentInfo` 表
4. **定期付款** → `invoice.payment_succeeded`
5. **订阅更新** → `customer.subscription.updated`

## 🛡️ 安全特性

### 签名验证
- ✅ 验证 Stripe webhook 签名
- ✅ 防止重放攻击
- ✅ 确保数据完整性

### 错误处理
- ✅ 详细的错误日志
- ✅ 事务性数据库操作
- ✅ 幂等性处理

### 数据验证
- ✅ 验证必需字段
- ✅ 检查订单状态
- ✅ 防止重复处理

## 📊 监控和调试

### 日志输出
webhook 处理程序会输出详细的日志：

```
✅ Webhook signature verified
📨 Event type: checkout.session.completed
💰 Processing checkout.session.completed
📋 Order details: { orderId: "abc123", userId: "user123" }
✅ Order processed successfully: abc123
```

### 错误处理
如果出现错误，会记录详细的错误信息：

```
❌ Webhook signature verification failed
❌ Order not found or already processed
❌ Error processing order
```

## 🧪 测试建议

### 1. 开发环境测试
```bash
# 使用 Stripe CLI 测试
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 2. 生产环境测试
1. 在 Stripe Dashboard 中查看 webhook 事件
2. 检查应用日志
3. 验证数据库记录

### 3. 测试场景
- ✅ 正常支付流程
- ✅ 支付失败处理
- ✅ 重复 webhook 处理
- ✅ 无效签名处理

## 🚀 部署检查清单

- [ ] Webhook 端点已配置
- [ ] 环境变量已设置
- [ ] 事件类型已选择
- [ ] 签名验证已启用
- [ ] 错误处理已测试
- [ ] 日志监控已配置

## 📞 故障排除

### 常见问题

1. **Webhook 未收到**
   - 检查端点 URL 是否正确
   - 确认服务器可访问
   - 查看 Stripe Dashboard 中的 webhook 状态

2. **签名验证失败**
   - 确认 `STRIPE_WEBHOOK_SECRET` 正确
   - 检查 webhook 端点配置
   - 验证请求头包含 `stripe-signature`

3. **订单未更新**
   - 检查数据库连接
   - 查看应用日志
   - 确认订单状态为 `Pending`

4. **积分未增加**
   - 检查用户积分记录
   - 查看交易历史
   - 确认 webhook 处理成功

### 调试命令

```bash
# 查看 webhook 事件
stripe events list

# 重发 webhook 事件
stripe events resend evt_1234567890

# 查看 webhook 端点状态
stripe webhook_endpoints list
``` 