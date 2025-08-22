# RunningHub API 配置说明

## 问题诊断

当前 RunningHub 状态返回 `undefined` 是因为环境变量未正确配置。

## 问题原因

1. **环境变量缺失**: `RUNNINGHUB_API_KEY` 等关键配置使用的是默认的 "placeholder" 值
2. **API 调用失败**: 由于无效的凭据，RunningHub API 调用失败或返回错误格式

## 解决方案

### 1. 创建 `.env.local` 文件

在项目根目录创建 `.env.local` 文件，包含以下配置：

```bash
# RunningHub API Configuration
RUNNINGHUB_API_BASE_URL=https://www.runninghub.cn
RUNNINGHUB_API_KEY=your_actual_api_key_here
RUNNINGHUB_WORKFLOW_ID=your_actual_workflow_id_here

# 数据库配置
DATABASE_URL=your_database_url_here
```

### 2. 获取 RunningHub 凭据

1. 访问 [RunningHub 官网](https://www.runninghub.cn)
2. 注册账户并登录控制台
3. 获取 API Key
4. 创建或获取去水印工作流的 Workflow ID

### 3. 验证配置

配置完成后重启开发服务器：

```bash
npm run dev
```

检查控制台输出，应该看到：
- ✅ RunningHub API 配置正确
- 🔍 实际的 API 返回数据而不是 `undefined`

## 当前状态

- ❌ `RUNNINGHUB_API_KEY` = "placeholder"
- ❌ `RUNNINGHUB_WORKFLOW_ID` = "placeholder"  
- ❌ API 调用失败导致状态为 `undefined`

## 临时测试

如果没有真实的 RunningHub 凭据，可以：

1. 模拟 API 响应
2. 使用测试数据验证前端功能
3. 确保在获得真实凭据后能正常工作

## API 返回格式

根据 RunningHub API 文档，正确的返回格式应该是：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "taskId": "1958718517237456898",
    "status": "processing",
    "output": [],
    "error": null
  }
}
```

但由于配置问题，当前返回的是 `undefined` 或错误响应。
