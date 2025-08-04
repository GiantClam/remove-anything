import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 Webhook 开始处理");
    console.log("🔍 环境检查:", {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      prismaType: prisma.constructor.name
    });

    const body = await req.json();
    console.log("📨 Webhook 数据:", {
      id: body.id,
      status: body.status,
      hasOutput: !!body.output,
      hasError: !!body.error
    });
    
    // 验证 webhook 签名（生产环境应该验证）
    const signature = req.headers.get('replicate-signature');
    if (env.REPLICATE_WEBHOOK_SECRET && signature) {
      // TODO: 在生产环境中验证 webhook 签名
      // const isValid = verifyWebhookSignature(body, signature, env.REPLICATE_WEBHOOK_SECRET);
      // if (!isValid) {
      //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      // }
    }
    
    console.log("📨 收到 Replicate webhook:", {
      id: body.id,
      status: body.status,
      output: body.output ? "有输出" : "无输出",
      error: body.error
    });
    
    // 查找对应的 FluxData 记录
    const fluxData = await prisma.fluxData.findFirst({
      where: {
        replicateId: body.id,
      },
    });
    
    if (!fluxData) {
      console.warn(`⚠️ 未找到对应的 FluxData 记录，replicateId: ${body.id}`);
      return NextResponse.json({ 
        message: "Task not found" 
      }, { status: 404 });
    }
    
    // 根据 Replicate 状态更新数据库
    let updateData: any = {};
    
    switch (body.status) {
      case "starting":
        updateData = {
          taskStatus: "Processing",
          executeStartTime: BigInt(Date.now()),
        };
        console.log(`🚀 任务开始处理: ${body.id}`);
        break;
        
      case "processing":
        updateData = {
          taskStatus: "Processing",
        };
        console.log(`⚙️ 任务处理中: ${body.id}`);
        break;
        
      case "succeeded":
        const imageUrl = Array.isArray(body.output) ? body.output[0] : body.output;
        updateData = {
          taskStatus: "Succeeded",
          imageUrl: imageUrl,
          executeEndTime: BigInt(Date.now()),
          errorMsg: body.logs?.join("\n") || "",
        };
        console.log(`✅ 任务成功完成: ${body.id}，图片URL: ${imageUrl}`);
        break;
        
      case "failed":
      case "canceled":
        updateData = {
          taskStatus: "Failed",
          executeEndTime: BigInt(Date.now()),
          errorMsg: body.error?.message || body.error || "Task failed",
        };
        console.log(`❌ 任务失败: ${body.id}，错误: ${updateData.errorMsg}`);
        break;
        
      default:
        console.log(`ℹ️ 未知状态: ${body.status} for ${body.id}`);
        return NextResponse.json({ 
          message: "Unknown status" 
        }, { status: 200 });
    }
    
    // 更新数据库记录
    try {
      await prisma.fluxData.update({
        where: { id: fluxData.id },
        data: updateData,
      });
      console.log(`🔄 已更新 FluxData 记录: ${fluxData.id}，状态: ${updateData.taskStatus}`);
    } catch (dbError) {
      console.error("❌ 数据库更新失败:", {
        error: dbError.message,
        fluxDataId: fluxData.id,
        updateData: updateData
      });
      return NextResponse.json(
        { error: "Database update failed", details: dbError.message },
        { status: 500 }
      );
    }
    
    console.log(`🔄 已更新 FluxData 记录: ${fluxData.id}，状态: ${updateData.taskStatus}`);
    
    return NextResponse.json({ 
      message: "Webhook processed successfully",
      fluxDataId: fluxData.id,
      status: updateData.taskStatus
    }, { status: 200 });
    
  } catch (error) {
    console.error("❌ Webhook 详细错误:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      constructor: error.constructor.name
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
} 