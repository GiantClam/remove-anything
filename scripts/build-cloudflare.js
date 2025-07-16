#!/usr/bin/env node

/**
 * Cloudflare Workers 构建脚本
 * 构建 Next.js 应用并准备部署到 Cloudflare Workers
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildForCloudflare() {
  console.log('🚀 开始构建 Cloudflare Workers 应用...\n');

  try {
    // 1. 清理之前的构建
    console.log('🧹 清理之前的构建...');
    if (fs.existsSync('.next')) {
      fs.rmSync('.next', { recursive: true, force: true });
    }
    if (fs.existsSync('out')) {
      fs.rmSync('out', { recursive: true, force: true });
    }

    // 2. 生成 Prisma 客户端
    console.log('🗄️ 生成 Prisma 客户端...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // 3. 构建 Next.js 应用（静态导出）
    console.log('🔨 构建 Next.js 应用（静态导出）...');
    execSync('npm run build', { stdio: 'inherit' });

    // 4. 检查构建输出目录
    const buildDir = 'out';
    if (!fs.existsSync(buildDir)) {
      throw new Error(`构建目录 ${buildDir} 不存在`);
    }

    // 5. 创建 Cloudflare Workers 所需的文件
    console.log('📄 创建 Cloudflare Workers 配置文件...');
    
    // 创建 _headers 文件
    const headersContent = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-XSS-Protection: 1; mode=block

/api/*
  Cache-Control: no-cache, no-store, must-revalidate

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable`;

    fs.writeFileSync(path.join(buildDir, '_headers'), headersContent);

    // 创建 _redirects 文件
    const redirectsContent = `/api/* /api/:splat 200
/* /index.html 200`;

    fs.writeFileSync(path.join(buildDir, '_redirects'), redirectsContent);

    console.log('✅ Build completed successfully!');
    console.log(`📁 构建输出目录: ${path.resolve(buildDir)}`);
    console.log('\n🎉 构建完成！现在可以部署到 Cloudflare Workers 了');
    console.log('\n📋 部署命令:');
    console.log('  npx wrangler deploy');
    console.log('\n🔧 开发命令:');
    console.log('  npx wrangler dev');

  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
  }
}

buildForCloudflare(); 