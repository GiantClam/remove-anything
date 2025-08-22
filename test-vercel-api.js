#!/usr/bin/env node

/**
 * Vercel 生产环境 API 路由测试脚本
 * 用于验证 watermark removal API 是否正常工作
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://www.remove-anything.com';

// 测试函数
async function testAPI(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-API-Test/1.0'
      }
    };

    const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 测试用例
async function runTests() {
  console.log('🧪 开始测试 Vercel 生产环境 API 路由...\n');

  const tests = [
    {
      name: '测试主 API 路由 (POST)',
      url: `${BASE_URL}/api/watermark-removal`,
      method: 'POST',
      data: { test: 'data' }
    },
    {
      name: '测试状态查询 API 路由 (GET)',
      url: `${BASE_URL}/api/watermark-removal/test-task-id`,
      method: 'GET'
    },
    {
      name: '测试 webhook 路由 (POST)',
      url: `${BASE_URL}/api/webhooks/runninghub`,
      method: 'POST',
      data: { test: 'webhook' }
    },
    {
      name: '测试账户 API 路由 (GET)',
      url: `${BASE_URL}/api/account`,
      method: 'GET'
    }
  ];

  for (const test of tests) {
    try {
      console.log(`🔍 ${test.name}...`);
      const result = await testAPI(test.url, test.method, test.data);
      
      if (result.status === 404) {
        console.log(`❌ ${test.name}: 404 Not Found`);
        console.log(`   URL: ${test.url}`);
        console.log(`   Method: ${test.method}`);
      } else if (result.status >= 200 && result.status < 300) {
        console.log(`✅ ${test.name}: ${result.status} OK`);
      } else if (result.status >= 400 && result.status < 500) {
        console.log(`⚠️  ${test.name}: ${result.status} Client Error`);
        console.log(`   Response: ${result.body.substring(0, 200)}...`);
      } else if (result.status >= 500) {
        console.log(`❌ ${test.name}: ${result.status} Server Error`);
        console.log(`   Response: ${result.body.substring(0, 200)}...`);
      } else {
        console.log(`ℹ️  ${test.name}: ${result.status} Other`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }
    console.log('');
  }

  console.log('📋 测试完成！');
  console.log('\n💡 如果看到 404 错误，请检查：');
  console.log('   1. Vercel 部署是否成功');
  console.log('   2. 环境变量是否正确设置');
  console.log('   3. API 路由是否正确构建');
  console.log('   4. 数据库连接是否正常');
}

// 运行测试
runTests().catch(console.error);
