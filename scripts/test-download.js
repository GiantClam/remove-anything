#!/usr/bin/env node

/**
 * 测试下载功能的脚本
 */

const fetch = require('node-fetch');

async function testDownloadAPI() {
  console.log('🧪 测试下载API');
  console.log('========================');

  const testCases = [
    {
      name: '背景移除下载',
      url: 'http://localhost:3000/api/download-background?taskId=test123',
      expectedHeaders: ['content-disposition', 'content-type']
    },
    {
      name: '水印移除下载',
      url: 'http://localhost:3000/api/download?taskId=test123&type=watermark-removal',
      expectedHeaders: ['content-disposition', 'content-type']
    },
    {
      name: '通用任务下载',
      url: 'http://localhost:3000/api/download?taskId=test123',
      expectedHeaders: ['content-disposition', 'content-type']
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 测试: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    
    try {
      const response = await fetch(testCase.url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`状态码: ${response.status}`);
      
      // 检查响应头
      const headers = response.headers;
      console.log('响应头:');
      testCase.expectedHeaders.forEach(headerName => {
        const headerValue = headers.get(headerName);
        if (headerValue) {
          console.log(`  ${headerName}: ${headerValue}`);
          
          // 特别检查Content-Disposition
          if (headerName === 'content-disposition') {
            if (headerValue.includes('attachment')) {
              console.log('  ✅ Content-Disposition 正确设置为 attachment');
            } else {
              console.log('  ❌ Content-Disposition 未设置为 attachment');
            }
          }
        } else {
          console.log(`  ❌ 缺少响应头: ${headerName}`);
        }
      });

      // 检查响应体大小
      const contentLength = headers.get('content-length');
      if (contentLength) {
        console.log(`  响应体大小: ${contentLength} bytes`);
      }

    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
    }
  }
}

// 运行测试
testDownloadAPI();
