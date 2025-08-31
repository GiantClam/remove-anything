#!/usr/bin/env node

/**
 * 验证 Sitemap 配置脚本
 * 用于检查 sitemap.xml 和 robots.txt 是否正确配置
 */

const https = require('https');
const http = require('http');

const sites = [
  'https://www.remove-anything.com',
  'https://remove-anything.pages.dev'
];

async function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    protocol.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          contentType: res.headers['content-type'],
          content: data,
          headers: res.headers
        });
      });
    }).on('error', (err) => {
      resolve({
        url,
        error: err.message,
        status: 'ERROR'
      });
    });
  });
}

async function verifySitemap() {
  console.log('🔍 开始验证 Sitemap 配置...\n');
  
  for (const site of sites) {
    console.log(`📋 检查网站: ${site}`);
    
    // 检查 robots.txt
    const robotsResult = await checkUrl(`${site}/robots.txt`);
    console.log(`  🤖 robots.txt: ${robotsResult.status} ${robotsResult.error || ''}`);
    
    if (robotsResult.status === 200) {
      const sitemapMatch = robotsResult.content.match(/Sitemap:\s*(.+)/i);
      if (sitemapMatch) {
        console.log(`  📍 发现 sitemap URL: ${sitemapMatch[1]}`);
        
        // 检查 sitemap 是否可访问
        const sitemapResult = await checkUrl(sitemapMatch[1]);
        console.log(`  🗺️  sitemap.xml: ${sitemapResult.status} ${sitemapResult.error || ''}`);
        
        if (sitemapResult.status === 200) {
          // 验证 XML 格式
          if (sitemapResult.content.includes('<?xml') && sitemapResult.content.includes('<urlset')) {
            console.log(`  ✅ sitemap.xml 格式正确`);
            
            // 统计 URL 数量
            const urlCount = (sitemapResult.content.match(/<url>/g) || []).length;
            console.log(`  📊 包含 ${urlCount} 个 URL`);
          } else {
            console.log(`  ❌ sitemap.xml 格式错误`);
          }
        }
      } else {
        console.log(`  ❌ robots.txt 中未找到 sitemap URL`);
      }
    }
    
    // 直接检查 sitemap.xml
    const directSitemapResult = await checkUrl(`${site}/sitemap.xml`);
    console.log(`  🗺️  直接访问 sitemap.xml: ${directSitemapResult.status} ${directSitemapResult.error || ''}`);
    
    console.log('');
  }
  
  console.log('✅ 验证完成！');
}

// 运行验证
verifySitemap().catch(console.error);

