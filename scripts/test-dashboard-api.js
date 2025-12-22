#!/usr/bin/env node

/**
 * 测试dashboard API的脚本
 */

const fetch = require('node-fetch');

async function testDashboardAPI() {
  console.log('🧪 测试Dashboard API');
  console.log('========================');

  try {
    // 测试mine-tasks API
    const response = await fetch('http://localhost:3000/api/mine-tasks?page=1&pageSize=12', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ API响应成功');
      console.log('📊 总任务数:', result.data?.total || 0);
      console.log('📄 当前页数据量:', result.data?.data?.length || 0);
      
      if (result.data?.data && result.data.data.length > 0) {
        console.log('\n📋 任务详情:');
        result.data.data.forEach((task, index) => {
          console.log(`\n任务 ${index + 1}:`);
          console.log(`  ID: ${task.id}`);
          console.log(`  类型: ${task.taskType}`);
          console.log(`  状态: ${task.taskStatus}`);
          console.log(`  创建时间: ${task.createdAt}`);
        });
      } else {
        console.log('⚠️  没有找到任务数据');
      }
    } else {
      console.log('❌ API响应失败:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testDashboardAPI();
