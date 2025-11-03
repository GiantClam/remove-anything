#!/usr/bin/env node

/**
 * 检查R2配置脚本
 * 用于验证R2环境变量是否正确配置
 */

console.log("🔍 检查R2配置...\n");

// 检查环境变量
const requiredEnvVars = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY', 
  'R2_SECRET_KEY',
  'R2_BUCKET',
  'R2_URL_BASE'
];

let allConfigured = true;

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value === 'placeholder' || value === 'https://placeholder.com') {
    console.log(`❌ ${varName}: 未配置或使用默认值`);
    allConfigured = false;
  } else {
    // 隐藏敏感信息
    const displayValue = varName.includes('KEY') || varName.includes('SECRET') 
      ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

console.log("\n📋 R2配置检查结果:");
if (allConfigured) {
  console.log("✅ 所有必需的R2环境变量都已正确配置");
  console.log("\n💡 如果仍然遇到上传问题，请检查:");
  console.log("1. R2 API Token是否有正确的读写权限");
  console.log("2. R2存储桶是否已创建并配置为公共访问");
  console.log("3. R2端点URL是否正确");
  console.log("4. 网络连接是否正常");
} else {
  console.log("❌ 部分R2环境变量未正确配置");
  console.log("\n🔧 请在Vercel项目设置中配置以下环境变量:");
  console.log("- R2_ENDPOINT: R2服务端点 (例如: https://xxx.r2.cloudflarestorage.com)");
  console.log("- R2_ACCESS_KEY: R2 API Token的Access Key ID");
  console.log("- R2_SECRET_KEY: R2 API Token的Secret Access Key");
  console.log("- R2_BUCKET: R2存储桶名称");
  console.log("- R2_URL_BASE: R2公共访问URL (例如: https://pub-xxx.r2.dev)");
}

console.log("\n📖 获取R2 API Token的步骤:");
console.log("1. 登录Cloudflare Dashboard");
console.log("2. 进入 R2 > Manage R2 API tokens");
console.log("3. 创建新的API Token");
console.log("4. 选择适当的权限 (Object Read & Write)");
console.log("5. 复制Access Key ID和Secret Access Key");
