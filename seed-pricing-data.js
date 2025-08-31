#!/usr/bin/env node

/**
 * 插入示例定价产品数据的脚本
 */

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const pricingProducts = [
  // 英文产品
  {
    amount: 300,
    originalAmount: 500,
    credit: 100,
    currency: 'USD',
    locale: 'en',
    title: 'Starter',
    tag: 'Popular',
    message: '100 credits,Basic models,Standard support',
    state: 'active'
  },
  {
    amount: 500,
    originalAmount: 800,
    credit: 200,
    currency: 'USD',
    locale: 'en',
    title: 'Pro',
    tag: 'Best Value',
    message: '200 credits,All models,Priority support,Commercial license',
    state: 'active'
  },
  {
    amount: 1000,
    originalAmount: 1500,
    credit: 500,
    currency: 'USD',
    locale: 'en',
    title: 'Business',
    tag: 'Enterprise',
    message: '500 credits,All models,Priority support,Commercial license,API access',
    state: 'active'
  },
  
  // 繁体中文产品
  {
    amount: 300,
    originalAmount: 500,
    credit: 100,
    currency: 'USD',
    locale: 'tw',
    title: '入門版',
    tag: '熱門',
    message: '100積分,基礎模型,標準支持',
    state: 'active'
  },
  {
    amount: 500,
    originalAmount: 800,
    credit: 200,
    currency: 'USD',
    locale: 'tw',
    title: '專業版',
    tag: '超值',
    message: '200積分,所有模型,優先支持,商業許可',
    state: 'active'
  },
  {
    amount: 1000,
    originalAmount: 1500,
    credit: 500,
    currency: 'USD',
    locale: 'tw',
    title: '企業版',
    tag: '企業級',
    message: '500積分,所有模型,優先支持,商業許可,API訪問',
    state: 'active'
  }
];

async function seedPricingData() {
  console.log('🌱 开始插入定价产品数据...\n');

  try {
    // 清空现有数据
    console.log('🗑️ 清空现有定价产品数据...');
    await prisma.chargeProduct.deleteMany();
    console.log('✅ 现有数据已清空');

    // 插入新数据
    console.log('📝 插入新的定价产品数据...');
    const createdProducts = await prisma.chargeProduct.createMany({
      data: pricingProducts
    });

    console.log(`✅ 成功插入 ${createdProducts.count} 个定价产品`);

    // 验证插入的数据
    console.log('\n🔍 验证插入的数据...');
    const allProducts = await prisma.chargeProduct.findMany();
    
    const productsByLocale = {};
    allProducts.forEach(product => {
      if (!productsByLocale[product.locale]) {
        productsByLocale[product.locale] = [];
      }
      productsByLocale[product.locale].push(product);
    });

    Object.entries(productsByLocale).forEach(([locale, products]) => {
      console.log(`\n🌐 ${locale} 语言的产品:`);
      products.forEach(product => {
        console.log(`  - ${product.title}: $${product.amount} (${product.credit} credits)`);
        console.log(`    标签: ${product.tag || '无'}`);
        console.log(`    状态: ${product.state}`);
      });
    });

    console.log('\n🎉 定价产品数据插入完成！');
    console.log('💡 现在可以访问定价页面查看产品信息了');

  } catch (error) {
    console.error('❌ 插入定价数据时出错:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行数据插入
seedPricingData(); 