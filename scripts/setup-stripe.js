#!/usr/bin/env node

/**
 * Stripe 配置设置脚本
 * 用于快速配置 Stripe 环境变量
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupStripe() {
  console.log('🔧 Stripe 配置设置向导\n');
  
  console.log('请按照以下步骤配置 Stripe：\n');
  
  console.log('1. 访问 https://stripe.com 注册账户');
  console.log('2. 登录 Stripe Dashboard');
  console.log('3. 进入 Developers > API keys');
  console.log('4. 复制 Secret key（以 sk_test_ 或 sk_live_ 开头）\n');
  
  const stripeApiKey = await question('请输入你的 Stripe API Key: ');
  
  console.log('\n接下来设置 Webhook：');
  console.log('1. 进入 Developers > Webhooks');
  console.log('2. 添加端点：https://yourdomain.com/api/webhooks/stripe');
  console.log('3. 选择事件：checkout.session.completed, invoice.payment_succeeded');
  console.log('4. 复制 Webhook secret（以 whsec_ 开头）\n');
  
  const webhookSecret = await question('请输入你的 Webhook Secret: ');
  
  console.log('\n现在创建产品价格：');
  console.log('1. 进入 Products 页面');
  console.log('2. 创建产品并设置价格');
  console.log('3. 复制价格 ID（以 price_ 开头）\n');
  
  const proMonthlyId = await question('请输入 Pro 月付价格 ID: ');
  const proYearlyId = await question('请输入 Pro 年付价格 ID: ');
  const businessMonthlyId = await question('请输入 Business 月付价格 ID: ');
  const businessYearlyId = await question('请输入 Business 年付价格 ID: ');
  
  // 读取现有的 .env.local 文件
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // 准备新的环境变量
  const newEnvVars = [
    '',
    '# Stripe 配置',
    `STRIPE_API_KEY=${stripeApiKey}`,
    `STRIPE_WEBHOOK_SECRET=${webhookSecret}`,
    '',
    '# Stripe 产品价格 ID',
    `NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID=${proMonthlyId}`,
    `NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID=${proYearlyId}`,
    `NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID=${businessMonthlyId}`,
    `NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID=${businessYearlyId}`,
    ''
  ].join('\n');
  
  // 移除现有的 Stripe 配置（如果存在）
  const lines = envContent.split('\n');
  const filteredLines = lines.filter(line => {
    return !line.includes('STRIPE_API_KEY') && 
           !line.includes('STRIPE_WEBHOOK_SECRET') &&
           !line.includes('NEXT_PUBLIC_STRIPE_') &&
           !line.startsWith('# Stripe');
  });
  
  // 添加新的配置
  const updatedContent = filteredLines.join('\n') + newEnvVars;
  
  // 写入文件
  fs.writeFileSync(envPath, updatedContent);
  
  console.log('\n✅ Stripe 配置已更新到 .env.local 文件');
  console.log('\n📋 下一步：');
  console.log('1. 重启开发服务器：npm run dev');
  console.log('2. 测试支付流程');
  console.log('3. 检查 Stripe Dashboard 中的支付记录');
  
  rl.close();
}

setupStripe().catch(console.error); 