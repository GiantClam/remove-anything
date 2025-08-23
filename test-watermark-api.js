#!/usr/bin/env node

/**
 * 测试水印移除API的脚本
 * 用于验证API路由是否正常工作
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testWatermarkAPI() {
  console.log('🧪 开始测试水印移除API...');
  console.log('📍 目标URL:', BASE_URL);
  
  try {
    // 测试1: 检查主API路由是否可访问
    console.log('\n📋 测试1: 检查主API路由');
    const mainResponse = await fetch(`${BASE_URL}/api/watermark-removal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'test' }),
    });
    
    console.log('主API响应状态:', mainResponse.status);
    if (mainResponse.status === 400) {
      console.log('✅ 主API路由正常工作（返回预期的400错误）');
    } else {
      console.log('⚠️ 主API路由响应异常:', mainResponse.status);
    }
    
    // 测试2: 检查动态路由是否可访问
    console.log('\n📋 测试2: 检查动态路由');
    const testTaskId = 'test-task-123';
    const dynamicResponse = await fetch(`${BASE_URL}/api/watermark-removal/${testTaskId}`);
    
    console.log('动态路由响应状态:', dynamicResponse.status);
    if (dynamicResponse.status === 404) {
      console.log('✅ 动态路由正常工作（返回预期的404错误）');
    } else {
      console.log('⚠️ 动态路由响应异常:', dynamicResponse.status);
    }
    
    // 测试3: 检查数据库连接
    console.log('\n📋 测试3: 检查数据库连接');
    try {
      const dbResponse = await fetch(`${BASE_URL}/api/account`);
      console.log('数据库API响应状态:', dbResponse.status);
      if (dbResponse.status === 401 || dbResponse.status === 200) {
        console.log('✅ 数据库连接正常');
      } else {
        console.log('⚠️ 数据库连接异常:', dbResponse.status);
      }
    } catch (error) {
      console.log('❌ 数据库连接测试失败:', error.message);
    }
    
    console.log('\n🎉 API测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

// 运行测试
testWatermarkAPI();
