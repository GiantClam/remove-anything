#!/usr/bin/env node

/**
 * 强制刷新 Sitemap 缓存脚本
 * 通过添加时间戳参数来强制刷新缓存
 */

const https = require('https');

async function forceRefreshSitemap() {
  const site = 'https://www.remove-anything.com';
  const timestamp = Date.now();
  
  console.log('🔄 强制刷新 Sitemap 缓存...\n');
  
  // 检查原始 sitemap
  console.log('📋 检查原始 sitemap...');
  const originalResult = await checkUrl(`${site}/sitemap.xml`);
  console.log(`  状态: ${originalResult.status}`);
  console.log(`  缓存控制: ${originalResult.headers['cache-control'] || '无'}`);
  console.log(`  ETag: ${originalResult.headers['etag'] || '无'}`);
  
  // 检查带时间戳的 sitemap（强制刷新）
  console.log('\n📋 检查带时间戳的 sitemap（强制刷新）...');
  const refreshResult = await checkUrl(`${site}/sitemap.xml?t=${timestamp}`);
  console.log(`  状态: ${refreshResult.status}`);
  console.log(`  缓存控制: ${refreshResult.headers['cache-control'] || '无'}`);
  
  // 检查 robots.txt
  console.log('\n📋 检查 robots.txt...');
  const robotsResult = await checkUrl(`${site}/robots.txt?t=${timestamp}`);
  console.log(`  状态: ${robotsResult.status}`);
  
  if (robotsResult.status === 200) {
    const sitemapMatch = robotsResult.content.match(/Sitemap:\s*(.+)/i);
    if (sitemapMatch) {
      console.log(`  📍 sitemap URL: ${sitemapMatch[1]}`);
    }
  }
  
  console.log('\n✅ 缓存刷新检查完成！');
  console.log('\n💡 建议操作：');
  console.log('1. 在 Google Search Console 中删除旧的 sitemap 条目');
  console.log('2. 重新提交 sitemap URL: https://www.remove-anything.com/sitemap.xml');
  console.log('3. 等待 24-48 小时让 Google 重新抓取');
}

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          content: data
        });
      });
    }).on('error', (err) => {
      resolve({
        status: 'ERROR',
        error: err.message
      });
    });
  });
}

// 运行脚本
forceRefreshSitemap().catch(console.error);

