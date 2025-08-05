# Stripe 支付配置指南

## 当前项目支持的支付通道

### 1. Stripe（主要支付通道）
- 支持信用卡支付
- 支持多种货币（USD、CNY）
- 集成 Stripe Checkout 和 Billing Portal

### 2. GiftCode（礼品码支付）
- 代码中已定义但未完全实现
- 可用于内部测试或特殊促销

## 环境变量配置

### 必需的环境变量

在你的 `.env.local` 文件中添加以下配置：

```bash
# Stripe 配置
STRIPE_API_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe 产品价格 ID（用于订阅计划）
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID=price_your_pro_monthly_id
NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID=price_your_pro_yearly_id
NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID=price_your_business_monthly_id
NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID=price_your_business_yearly_id
```

### 获取 Stripe 配置的步骤

1. **注册 Stripe 账户**
   - 访问 [stripe.com](https://stripe.com) 注册账户
   - 完成账户验证

2. **获取 API 密钥**
   - 登录 Stripe Dashboard
   - 进入 Developers > API keys
   - 复制 Secret key（以 `sk_test_` 或 `sk_live_` 开头）

3. **创建产品价格**
   - 进入 Products 页面
   - 创建产品并设置价格
   - 复制价格 ID（以 `price_` 开头）

4. **设置 Webhook**
   - 进入 Developers > Webhooks
   - 添加端点：`https://yourdomain.com/api/webhooks/stripe`
   - 选择事件：`checkout.session.completed`, `invoice.payment_succeeded`
   - 复制 Webhook secret（以 `whsec_` 开头）

## 测试模式 vs 生产模式

### 测试模式
- 使用 `sk_test_` 开头的 API 密钥
- 使用测试信用卡号进行支付测试
- 不会产生真实费用

### 生产模式
- 使用 `sk_live_` 开头的 API 密钥
- 处理真实支付
- 需要完成 Stripe 账户验证

## 常见问题解决

### 1. "This page could not be found" 错误
- 检查环境变量是否正确配置
- 确保 Stripe API 密钥有效
- 验证产品价格 ID 是否存在

### 2. 支付失败
- 检查 Stripe Dashboard 中的错误日志
- 验证 Webhook 配置
- 确认货币设置正确

### 3. 路由问题
- 确保中间件配置正确
- 检查国际化路由设置
- 验证 API 路由是否正常工作

## 安全注意事项

1. **永远不要提交 API 密钥到版本控制**
2. **使用环境变量存储敏感信息**
3. **在生产环境中使用 HTTPS**
4. **定期轮换 API 密钥**
5. **监控支付异常**

## 开发调试

### 启用 Stripe 日志
```bash
# 在开发环境中启用详细日志
STRIPE_LOG_LEVEL=debug
```

### 测试支付流程
1. 使用测试信用卡号：`4242 4242 4242 4242`
2. 任意未来日期作为过期日期
3. 任意 3 位数字作为 CVC

## 部署检查清单

- [ ] 环境变量已正确配置
- [ ] Stripe Webhook 端点已设置
- [ ] 域名已在 Stripe 中验证
- [ ] SSL 证书已安装
- [ ] 支付流程已测试
- [ ] 错误处理已实现 