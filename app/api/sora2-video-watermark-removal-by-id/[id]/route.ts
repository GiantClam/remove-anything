import { NextRequest, NextResponse } from "next/server";

import {
  findSora2VideoWatermarkRemovalTaskById,
  updateSora2VideoWatermarkRemovalTask,
} from "@/db/queries/sora2-video-watermark-removal";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import { getErrorMessage } from "@/lib/handle-error";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { persistRunningHubOutput } from "@/lib/runninghub-output";
import { normalizeTaskStatus } from "@/lib/task-lifecycle";
import {
  getUnknownVideoSubmissionCode,
  getUnknownVideoSubmissionUpdatedAt,
} from "@/lib/video-task-queue-contract";
import { runninghubAPI } from "@/modules/runninghub";

// 强制动态渲染，避免构建时静态生成
export const dynamic = "force-dynamic";

function protectedVideoPreview(
  taskId: string | null | undefined,
  status: unknown,
  imageUrl: string | null | undefined,
) {
  if (
    !taskId ||
    normalizeTaskStatus(status) !== "succeeded" ||
    !getR2ObjectKey(imageUrl, env.R2_URL_BASE)
  )
    return null;
  return `/api/download?${new URLSearchParams({
    type: "sora2-video-watermark-removal",
    taskId,
    preview: "1",
  })}`;
}

function visibleVideoStatus(
  status: unknown,
  imageUrl: string | null | undefined,
) {
  const normalized = normalizeTaskStatus(status);
  return normalized === "succeeded" &&
    !getR2ObjectKey(imageUrl, env.R2_URL_BASE)
    ? "processing"
    : normalized;
}

function getProviderStatus(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "status" in data) {
    const status = (data as { status?: unknown }).status;
    return typeof status === "string" ? status : null;
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const recordId = params.id;
    const { searchParams } = new URL(req.url);
    const dbOnly = searchParams.get("dbOnly") === "true";

    console.log("🔍 开始查询Sora2视频去水印任务状态 (通过记录ID)");
    console.log("📋 请求参数:", { recordId, dbOnly, url: req.url });

    if (!recordId) {
      console.log("❌ 缺少recordId参数");
      return NextResponse.json(
        { error: "Record ID is required" },
        { status: 400 },
      );
    }

    console.log(
      "🔍 查询Sora2视频去水印任务状态:",
      recordId,
      dbOnly ? "(仅数据库)" : "(包含RunningHub)",
    );

    // 首先从数据库查询任务记录
    const taskRecord = await findSora2VideoWatermarkRemovalTaskById(
      parseInt(recordId),
    );

    if (!taskRecord) {
      console.log("❌ 未找到Sora2视频去水印任务记录:", recordId);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log("✅ 找到Sora2视频去水印任务记录:", {
      id: taskRecord.id,
      userId: taskRecord.userId || "anonymous",
      status: taskRecord.taskStatus,
      replicateId: taskRecord.replicateId,
    });

    // 如果只查询数据库状态，直接返回
    if (dbOnly) {
      const submissionUnknownCode = !taskRecord.replicateId
        ? getUnknownVideoSubmissionCode(taskRecord.errorMsg)
        : null;
      const submissionUnknown = submissionUnknownCode !== null;
      const submissionUnknownAt = submissionUnknown
        ? getUnknownVideoSubmissionUpdatedAt(
            taskRecord.errorMsg,
            taskRecord.createdAt,
            taskRecord.updatedAt,
          )
        : undefined;
      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: taskRecord.replicateId,
        taskStatus: submissionUnknown
          ? "submission-unknown"
          : visibleVideoStatus(taskRecord.taskStatus, taskRecord.imageUrl),
        ...(submissionUnknown ? { createdAt: submissionUnknownAt } : {}),
        ...(submissionUnknown ? { code: submissionUnknownCode } : {}),
        inputImageUrl: null,
        imageUrl: protectedVideoPreview(
          taskRecord.replicateId,
          taskRecord.taskStatus,
          taskRecord.imageUrl,
        ),
        executeStartTime: taskRecord.executeStartTime
          ? Number(taskRecord.executeStartTime)
          : null,
        executeEndTime: taskRecord.executeEndTime
          ? Number(taskRecord.executeEndTime)
          : null,
        errorMsg: taskRecord.errorMsg,
        user: taskRecord.user,
      });
    }

    // 如果没有 RunningHub 任务 ID，返回数据库状态
    if (!taskRecord.replicateId) {
      console.log("⚠️ 没有 RunningHub 任务 ID，返回数据库状态");
      const submissionUnknownCode = getUnknownVideoSubmissionCode(
        taskRecord.errorMsg,
      );
      const submissionUnknown = submissionUnknownCode !== null;
      const submissionUnknownAt = submissionUnknown
        ? getUnknownVideoSubmissionUpdatedAt(
            taskRecord.errorMsg,
            taskRecord.createdAt,
            taskRecord.updatedAt,
          )
        : undefined;
      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: null,
        taskStatus: submissionUnknown
          ? "submission-unknown"
          : visibleVideoStatus(taskRecord.taskStatus, taskRecord.imageUrl),
        ...(submissionUnknown ? { createdAt: submissionUnknownAt } : {}),
        ...(submissionUnknown ? { code: submissionUnknownCode } : {}),
        inputImageUrl: null,
        imageUrl: protectedVideoPreview(
          taskRecord.replicateId,
          taskRecord.taskStatus,
          taskRecord.imageUrl,
        ),
        executeStartTime: taskRecord.executeStartTime
          ? Number(taskRecord.executeStartTime)
          : null,
        executeEndTime: taskRecord.executeEndTime
          ? Number(taskRecord.executeEndTime)
          : null,
        errorMsg: taskRecord.errorMsg,
        user: taskRecord.user,
      });
    }

    // 查询 RunningHub 任务状态
    console.log("🔍 查询 RunningHub 任务状态:", taskRecord.replicateId);

    try {
      const taskStatus = await runninghubAPI.getTaskStatus(
        taskRecord.replicateId,
      );
      console.log("📊 RunningHub 任务状态:", taskStatus);

      if (taskStatus.code === 0 && taskStatus.data) {
        // RunningHub has returned both `data: "SUCCESS"` and
        // `data: { status: "SUCCESS" }` across API versions. Accept both
        // shapes so real provider success is not silently treated as unknown.
        const status = getProviderStatus(taskStatus.data);
        console.log("📊 任务状态:", status);

        if (!status) {
          return NextResponse.json({
            success: true,
            id: taskRecord.id,
            runninghubTaskId: taskRecord.replicateId,
            taskStatus: visibleVideoStatus(
              taskRecord.taskStatus,
              taskRecord.imageUrl,
            ),
            inputImageUrl: null,
            imageUrl: protectedVideoPreview(
              taskRecord.replicateId,
              taskRecord.taskStatus,
              taskRecord.imageUrl,
            ),
            executeStartTime: taskRecord.executeStartTime
              ? Number(taskRecord.executeStartTime)
              : null,
            executeEndTime: taskRecord.executeEndTime
              ? Number(taskRecord.executeEndTime)
              : null,
            errorMsg: taskRecord.errorMsg,
            user: taskRecord.user,
            runninghubStatus: null,
          });
        }

        let updateData: any = {};

        // 根据状态更新数据库
        switch (status) {
          case "pending":
          case "starting":
          case "processing":
          case "Processing":
          case "queued":
          case "Queued":
          case "RUNNING":
          case "running":
            console.log("⏳ 任务进行中:", status);
            updateData = {
              taskStatus: "processing",
              replicateStatus: status,
            };
            break;

          case "succeeded":
          case "SUCCESS":
            try {
              // 当任务成功时，获取任务结果
              console.log(`🔍 任务成功，获取任务结果...`);
              const taskResult = await runninghubAPI.getTaskResult(
                taskRecord.replicateId,
              );

              // 检查是否是 APIKEY_TASK_IS_RUNNING 响应
              if (
                taskResult.code === 804 &&
                taskResult.msg === "APIKEY_TASK_IS_RUNNING"
              ) {
                console.log(
                  `ℹ️ 任务状态为SUCCESS但结果API仍返回运行中，保持当前状态等待下次轮询`,
                );
                // 不更新状态，保持当前状态，让下次轮询继续尝试
                updateData = {};
              } else if (
                taskResult.data &&
                Array.isArray(taskResult.data) &&
                taskResult.data.length > 0
              ) {
                const outputFile = taskResult.data[0];
                const outputVideoUrl =
                  typeof outputFile?.fileUrl === "string" &&
                  outputFile.fileUrl.trim()
                    ? outputFile.fileUrl.trim()
                    : null;
                if (outputVideoUrl) {
                  // Provider URLs are ephemeral and must never become the
                  // durable task result. Migrate the validated video into the
                  // private staging/production R2 bucket before exposing
                  // success to the client.
                  const persistedVideoUrl = await persistRunningHubOutput(
                    outputVideoUrl,
                    "video",
                    taskRecord.id,
                  );
                  updateData = {
                    taskStatus: "succeeded",
                    imageUrl: persistedVideoUrl,
                    executeEndTime: BigInt(Date.now()),
                    replicateStatus: "succeeded",
                    errorMsg: null,
                  };
                  console.log(`✅ 任务成功完成，输出URL: ${outputVideoUrl}`);
                } else {
                  updateData = {
                    taskStatus: "processing",
                    executeEndTime: null,
                    errorMsg:
                      "The provider result is not available yet. Please retry shortly.",
                    replicateStatus: "succeeded",
                  };
                  console.log("ℹ️ 供应商报告成功但尚无可用输出，保持处理中");
                }
              } else {
                updateData = {
                  taskStatus: "processing",
                  executeEndTime: null,
                  errorMsg:
                    "The provider result is not available yet. Please retry shortly.",
                  replicateStatus: "succeeded",
                };
                console.log("ℹ️ 供应商报告成功但无输出文件，保持处理中");
              }
            } catch (resultError) {
              console.error("❌ 获取任务结果失败:", resultError);
              // A provider success without durable output is recoverable. Do
              // not expose or persist terminal success until an output URL is
              // available for the secure download path.
              updateData = {
                taskStatus: "processing",
                executeEndTime: null,
                errorMsg:
                  "The result could not be read yet. Please retry shortly.",
                replicateStatus: "succeeded",
              };
            }
            break;

          case "failed":
          case "FAILED":
            console.log("❌ 任务失败");
            updateData = {
              taskStatus: "failed",
              executeEndTime: BigInt(Date.now()),
              errorMsg: taskStatus.msg || "Task failed",
              replicateStatus: "failed",
            };
            break;

          case "expired":
          case "EXPIRED":
          case "timeout":
          case "TIMEOUT":
          case "timed_out":
          case "TIMED_OUT":
            console.log("⌛ 任务已过期");
            updateData = {
              taskStatus: "expired",
              executeEndTime: BigInt(Date.now()),
              errorMsg: taskStatus.msg || "Task expired",
              replicateStatus: "expired",
            };
            break;

          default:
            console.log("⚠️ 未知状态:", status);
            updateData = {
              replicateStatus: status,
            };
        }

        // 更新数据库
        if (Object.keys(updateData).length > 0) {
          console.log("📝 更新数据库:", updateData);
          await updateSora2VideoWatermarkRemovalTask(taskRecord.id, updateData);

          // 重新查询更新后的记录
          const updatedRecord = await findSora2VideoWatermarkRemovalTaskById(
            taskRecord.id,
          );
          if (updatedRecord) {
            taskRecord.taskStatus = updatedRecord.taskStatus;
            taskRecord.imageUrl = updatedRecord.imageUrl;
            taskRecord.executeEndTime = updatedRecord.executeEndTime;
            taskRecord.errorMsg = updatedRecord.errorMsg;
          }
        }

        return NextResponse.json({
          success: true,
          id: taskRecord.id,
          runninghubTaskId: taskRecord.replicateId,
          taskStatus: visibleVideoStatus(
            taskRecord.taskStatus,
            taskRecord.imageUrl,
          ),
          inputImageUrl: null,
          imageUrl: protectedVideoPreview(
            taskRecord.replicateId,
            taskRecord.taskStatus,
            taskRecord.imageUrl,
          ),
          executeStartTime: taskRecord.executeStartTime
            ? Number(taskRecord.executeStartTime)
            : null,
          executeEndTime: taskRecord.executeEndTime
            ? Number(taskRecord.executeEndTime)
            : null,
          errorMsg: taskRecord.errorMsg,
          user: taskRecord.user,
          runninghubStatus: status,
        });
      } else {
        console.log("⚠️ RunningHub API 返回错误:", taskStatus);
        return NextResponse.json({
          success: true,
          id: taskRecord.id,
          runninghubTaskId: taskRecord.replicateId,
          taskStatus: visibleVideoStatus(
            taskRecord.taskStatus,
            taskRecord.imageUrl,
          ),
          inputImageUrl: null,
          imageUrl: protectedVideoPreview(
            taskRecord.replicateId,
            taskRecord.taskStatus,
            taskRecord.imageUrl,
          ),
          executeStartTime: taskRecord.executeStartTime
            ? Number(taskRecord.executeStartTime)
            : null,
          executeEndTime: taskRecord.executeEndTime
            ? Number(taskRecord.executeEndTime)
            : null,
          errorMsg: taskRecord.errorMsg,
          user: taskRecord.user,
          runninghubError: taskStatus.msg,
        });
      }
    } catch (apiError) {
      console.error("❌ 查询 RunningHub 任务状态失败:", apiError);

      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: taskRecord.replicateId,
        taskStatus: visibleVideoStatus(
          taskRecord.taskStatus,
          taskRecord.imageUrl,
        ),
        inputImageUrl: null,
        imageUrl: protectedVideoPreview(
          taskRecord.replicateId,
          taskRecord.taskStatus,
          taskRecord.imageUrl,
        ),
        executeStartTime: taskRecord.executeStartTime
          ? Number(taskRecord.executeStartTime)
          : null,
        executeEndTime: taskRecord.executeEndTime
          ? Number(taskRecord.executeEndTime)
          : null,
        errorMsg: taskRecord.errorMsg,
        user: taskRecord.user,
        apiError: getErrorMessage(apiError),
      });
    }
  } catch (error) {
    console.error("❌ 查询Sora2视频去水印任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
