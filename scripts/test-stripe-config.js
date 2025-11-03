#!/usr/bin/env node

/**
 * Stripe 配置测试脚本
 * 用于验证 Stripe 环境变量是否正确配置
 */

const fs = require('fs');
const path = require('path');

function testStripeConfig() {
  console.log('🔍 检查 Stripe 配置...\n');
  
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local 文件不存在');
    console.log('请运行: node scripts/setup-stripe.js');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  const config = {};
  
  lines.forEach(line => {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      config[key.trim()] = value.trim();
    }
  });
  
  console.log('📋 当前配置状态：\n');
  
  // 检查必需的配置
  const requiredConfigs = [
    'STRIPE_API_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID',
    'NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID',
    'NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID',
    'NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID'
  ];
  
  let allConfigured = true;
  
  requiredConfigs.forEach(key => {
    const value = config[key];
    if (value && value !== 'placeholder' && !value.includes('your')) {
      console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
    } else {
      console.log(`❌ ${key}: 未配置或使用默认值`);
      allConfigured = false;
    }
  });
  
  console.log('\n🔧 配置建议：');
  
  if (!allConfigured) {
    console.log('1. 运行配置脚本：node scripts/setup-stripe.js');
    console.log('2. 或者手动编辑 .env.local 文件');
    console.log('3. 参考 STRIPE_SETUP_GUIDE.md 获取详细说明');
  } else {
    console.log('✅ 所有配置看起来都正确！');
    console.log('现在可以测试支付功能了。');
  }
  
  console.log('\n📖 测试步骤：');
  console.log('1. 重启开发服务器：npm run dev');
  console.log('2. 访问 /pricing 页面');
  console.log('3. 点击购买按钮测试支付流程');
  console.log('4. 使用测试信用卡：4242 4242 4242 4242');
  console.log('\n🔧 Webhook 配置：');
  console.log('1. 在 Stripe Dashboard 中配置 webhook 端点');
  console.log('2. 选择事件：checkout.session.completed, payment_intent.succeeded');
  console.log('3. 复制 webhook secret 到环境变量');
  console.log('4. 参考 STRIPE_WEBHOOK_SETUP.md 获取详细说明');
}

testStripeConfig(); 