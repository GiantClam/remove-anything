#!/usr/bin/env node

/**
 * 这个脚本用于生成示例图片的占位符
 * 您可以运行这个脚本来创建更多示例图片
 */

const fs = require('fs');
const path = require('path');

// 示例图片配置
const exampleTypes = [
  {
    name: 'portrait',
    description: 'Portrait background removal'
  },
  {
    name: 'product',
    description: 'Product background removal'
  },
  {
    name: 'object',
    description: 'Object background removal'
  },
  {
    name: 'watermark',
    description: 'Watermark removal'
  },
  {
    name: 'text',
    description: 'Text removal from images'
  }
];

console.log('🎨 示例图片生成脚本');
console.log('========================');

exampleTypes.forEach(type => {
  const beforePath = path.join(__dirname, '../public/images', `${type.name}_before.png`);
  const afterPath = path.join(__dirname, '../public/images', `${type.name}_after.png`);
  
  console.log(`\n📸 ${type.description}:`);
  
  if (fs.existsSync(beforePath)) {
    console.log(`  ✅ ${type.name}_before.png - 已存在`);
  } else {
    console.log(`  ❌ ${type.name}_before.png - 需要创建`);
  }
  
  if (fs.existsSync(afterPath)) {
    console.log(`  ✅ ${type.name}_after.png - 已存在`);
  } else {
    console.log(`  ❌ ${type.name}_after.png - 需要创建`);
  }
});

console.log('\n📋 建议的图片规格:');
console.log('  - 尺寸: 400x400 像素 (1:1 比例)');
console.log('  - 格式: PNG (支持透明背景)');
console.log('  - 文件大小: 建议小于 2MB');
console.log('  - 内容: 清晰展示处理前后的对比效果');

console.log('\n🚀 使用方法:');
console.log('  1. 将您的示例图片放在 public/images/ 目录下');
console.log('  2. 命名格式: {type}_before.png 和 {type}_after.png');
console.log('  3. 刷新页面即可看到效果');

console.log('\n💡 提示:');
console.log('  - 可以使用 Canva、Photoshop 等工具创建示例图片');
console.log('  - 建议使用真实的处理效果图片');
console.log('  - 确保图片质量清晰，展示效果更好');
