# Stripe 支付模块接入说明

- 环境变量
  - STRIPE_SECRET_KEY

- 使用方式
```ts
import { createStripeClient } from "@/modules/payments/stripe/adapter";

const stripeClient = createStripeClient();
const session = await stripeClient.createCheckoutSession({
  priceId: 'price_XXXX',
  quantity: 1,
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
});
```

- 自定义金额（无需 priceId）
在本项目示例中，使用旧逻辑通过 `payment_intent_data` 自定义金额；你可以在适配层自行扩展，或在业务端路由中组装。

