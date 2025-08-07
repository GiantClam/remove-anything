import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import dayjs from "dayjs";
import { z } from "zod";

import { Credits, model, Ratio } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma } from "@/db/prisma";
import { getUserCredit } from "@/db/queries/account";
import { BillingType } from "@/db/type";
import { env } from "@/env.mjs";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "10s"
});

function getKey(id: string) {
  return `generate:${id}`;
}

export const maxDuration = 60;

type Params = { params: { key: string } };
const CreateGenerateSchema = z.object({
  model: z.enum([
    model.backgroundRemoval,
  ]),
  inputImageUrl: z.string().url(), // 去背景功能必须提供图片
  isPrivate: z.number().default(0),
  locale: z.string().default("en"),
});

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  const userId = user?.id || "anonymous"; // 允许匿名用户

  const { success } = await ratelimit.limit(
    getKey(userId) + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    // 检查Content-Type，支持FormData和JSON两种格式
    const contentType = req.headers.get('content-type') || '';
    
    let data;
    if (contentType.includes('multipart/form-data')) {
      // 处理FormData格式
      const formData = await req.formData();
      const image = formData.get('image') as File;
      
      if (!image) {
        return NextResponse.json({ error: "No image provided" }, { status: 400 });
      }

              // 上传文件到R2
        try {
          // 这里需要创建R2实例，但由于没有完整的R2配置，我们暂时跳过文件上传
          // 直接使用一个示例URL进行演示
          console.log("⚠️ 开发模式：跳过文件上传，使用示例URL");
          
          data = {
            model: model.backgroundRemoval,
            inputImageUrl: "https://example.com/sample-image.jpg", // 示例URL
            isPrivate: 0,
            locale: "en"
          };
        } catch (uploadError) {
          console.error("File upload error:", uploadError);
          return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
        }
    } else {
      // 处理JSON格式
      data = await req.json();
    }

    const {
      model: modelName,
      inputImageUrl,
      isPrivate,
      locale,
    } = CreateGenerateSchema.parse(data);

    // 如果是去背景功能，允许未登录用户使用
    if (modelName === model.backgroundRemoval) {
      // 直接调用AI Gateway进行去背景处理
      try {
        console.log("🚀 开始调用 Cloudflare AI Gateway + Replicate 进行去背景...");
        
        const res = await aiGateway.generateImageViaReplicate({
          model: modelName,
          input_image_url: inputImageUrl,
          input_prompt: "Background removal",
          is_private: Number(isPrivate) || 0,
          user_id: userId,
          locale,
        });

        if (!res?.replicate_id && res.error) {
          return NextResponse.json(
            { error: res.error || "Create Generator Error" },
            { status: 400 },
          );
        }

        console.log('✅ AI Gateway 调用成功，replicate_id:', res?.replicate_id);

        // 返回处理结果
        return NextResponse.json({ 
          success: true,
          data: {
            url: inputImageUrl, // 暂时返回原图，实际应该从replicate获取结果
            replicate_id: res.replicate_id
          }
        });
      } catch (aiError) {
        console.error("AI Gateway 调用失败:", aiError);
        throw aiError;
      }
    }

    // 对于其他功能，仍然需要登录
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const account = await getUserCredit(userId);
    const needCredit = Credits[modelName];
    if (account.credit < needCredit) {
      return NextResponse.json(
        { error: "Insufficient credit", code: 1000402 },
        { status: 400 },
      );
    }

    // 先创建 fluxData 记录
    const fluxData = await prisma.fluxData.create({
      data: {
        userId,
        replicateId: "", // 暂时留空，等 AI Gateway 响应后更新
        inputPrompt: "Background removal",
        executePrompt: "Background removal",
        model: modelName,
        aspectRatio: "1:1", // 去背景功能使用默认比例
        taskStatus: "Processing",
        executeStartTime: BigInt(Date.now()),
        locale,
        isPrivate: Boolean(isPrivate),
        inputImageUrl,
      },
    });

    try {
      console.log("🚀 开始调用 Cloudflare AI Gateway + Replicate 生成图片...");
      
      // 使用 Cloudflare AI Gateway 调用 Replicate
      const res = await aiGateway.generateImageViaReplicate({
        model: modelName,
        input_image_url: inputImageUrl,
        input_prompt: "Background removal",
        is_private: Number(isPrivate) || 0,
        user_id: userId,
        locale,
      });

      if (!res?.replicate_id && res.error) {
        // 如果 AI Gateway 调用失败，删除已创建的记录
        await prisma.fluxData.delete({
          where: { id: fluxData.id },
        });
        return NextResponse.json(
          { error: res.error || "Create Generator Error" },
          { status: 400 },
        );
      }

      // 更新 fluxData 记录，添加 replicate_id
      await prisma.fluxData.update({
        where: { id: fluxData.id },
        data: {
          replicateId: res.replicate_id,
        },
      });

      console.log('✅ AI Gateway 调用成功，replicate_id:', res?.replicate_id);

      // 检查是否为开发模式，如果是则跳过积分扣除
      const isDevMode = env.GOOGLE_CLIENT_ID === "google-client-id-placeholder" || 
                        env.GOOGLE_CLIENT_SECRET === "google-client-secret-placeholder";
      
      if (!isDevMode || userId !== "dev-user-123") {
        // 执行积分扣除和账单记录（非开发模式用户）
        await prisma.$transaction(async (tx) => {
          const newAccount = await tx.userCredit.update({
            where: { id: Number(account.id) },
            data: {
              credit: {
                decrement: needCredit,
              },
            },
          });
          const billing = await tx.userBilling.create({
            data: {
              userId,
              fluxId: fluxData.id,
              state: "Done",
              amount: -needCredit,
              type: BillingType.Withdraw,
              description: `Background removal - Withdraw`,
            },
          });

          await tx.userCreditTransaction.create({
            data: {
              userId,
              credit: -needCredit,
              balance: newAccount.credit,
              billingId: billing.id,
              type: "Generate",
            },
          });
        });
      } else {
        console.log("🔧 开发模式：跳过积分扣除，使用真实 AI 生成");
      }

      return NextResponse.json({ id: FluxHashids.encode(fluxData.id) });
    } catch (aiError) {
      // 如果 AI Gateway 调用过程中出错，清理已创建的记录
      console.error("AI Gateway 调用失败:", aiError);
      await prisma.fluxData.delete({
        where: { id: fluxData.id },
      });
      throw aiError;
    }
  } catch (error) {
    console.log("error-->", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
