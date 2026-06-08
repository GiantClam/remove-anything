import { NextRequest, NextResponse } from "next/server";

import {
  findObjectRemovalTaskByRunningHubId,
  updateObjectRemovalTask,
} from "@/db/queries/object-removal";
import { getErrorMessage } from "@/lib/handle-error";
import {
  isR2PublicUrl,
  saveObjectRemovalImageToR2,
} from "@/lib/remove-objects/output-image";
import {
  getRunningHubOutputFileUrl,
  normalizeRunningHubStatus,
} from "@/lib/remove-objects/runninghub";
import { runninghubAPI } from "@/modules/runninghub";

export const dynamic = "force-dynamic";

function isTransientRunningHubResultError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    message.includes("APIKEY_TASK_IS_RUNNING") ||
    message.includes("status=504") ||
    message.includes("status=503") ||
    message.includes("status=502") ||
    message.includes("fetch failed")
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const task = await findObjectRemovalTaskByRunningHubId(params.id);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    let finalStatus = task.taskStatus;
    let outputImageUrl = task.outputImageUrl;
    let errorMsg = task.errorMsg;

    if (
      finalStatus === "succeeded" &&
      outputImageUrl &&
      !isR2PublicUrl(outputImageUrl)
    ) {
      try {
        const r2Url = await saveObjectRemovalImageToR2(outputImageUrl, params.id);
        await updateObjectRemovalTask(task.id, {
          outputImageUrl: r2Url,
        });
        outputImageUrl = r2Url;
      } catch (migrationError) {
        console.error("❌ 转存删物结果到 R2 失败:", migrationError);
      }
    }

    if (["pending", "starting", "processing"].includes(task.taskStatus)) {
      try {
        const runninghubStatus = await runninghubAPI.getTaskStatus(params.id);
        const normalizedStatus = normalizeRunningHubStatus(
          runninghubStatus.data?.status || runninghubStatus.data,
        );

        let updateData:
          | {
              taskStatus?: string;
              outputImageUrl?: string | null;
              errorMsg?: string | null;
              executeStartTime?: bigint;
              executeEndTime?: bigint;
            }
          | undefined;

        if (normalizedStatus === "starting" && task.taskStatus === "pending") {
          updateData = {
            taskStatus: "starting",
            executeStartTime: BigInt(Date.now()),
          };
        }

        if (normalizedStatus === "processing") {
          updateData = {
            taskStatus: "processing",
          };
        }

        if (normalizedStatus === "succeeded") {
          try {
            const taskResult = await runninghubAPI.getTaskResult(params.id);
            outputImageUrl = getRunningHubOutputFileUrl(taskResult.data) || null;

            if (outputImageUrl) {
              let persistedOutputUrl = outputImageUrl;
              try {
                persistedOutputUrl = await saveObjectRemovalImageToR2(
                  outputImageUrl,
                  params.id,
                );
              } catch (r2Error) {
                console.error("❌ 删物结果转存 R2 失败，回退原始链接:", r2Error);
              }

              updateData = {
                taskStatus: "succeeded",
                outputImageUrl: persistedOutputUrl,
                errorMsg: null,
                executeEndTime: BigInt(Date.now()),
              };
              outputImageUrl = persistedOutputUrl;
            } else {
              updateData = {
                taskStatus: "processing",
                errorMsg: null,
              };
            }
          } catch (resultError) {
            if (isTransientRunningHubResultError(resultError)) {
              updateData = {
                taskStatus: "processing",
                errorMsg: null,
              };
            } else {
              updateData = {
                taskStatus: "failed",
                outputImageUrl,
                errorMsg:
                  resultError instanceof Error ? resultError.message : null,
                executeEndTime: BigInt(Date.now()),
              };
            }
          }
        }

        if (normalizedStatus === "failed") {
          errorMsg =
            runninghubStatus.data?.error ||
            task.errorMsg ||
            "Task failed";
          updateData = {
            taskStatus: "failed",
            errorMsg,
            executeEndTime: BigInt(Date.now()),
          };
        }

        if (updateData && Object.keys(updateData).length > 0) {
          try {
            await updateObjectRemovalTask(task.id, updateData);
            finalStatus = updateData.taskStatus || finalStatus;
            outputImageUrl =
              updateData.outputImageUrl !== undefined
                ? updateData.outputImageUrl
                : outputImageUrl;
            errorMsg =
              updateData.errorMsg !== undefined ? updateData.errorMsg : errorMsg;
          } catch (dbError) {
            console.error("❌ 更新删物任务状态失败:", dbError);
          }
        }
      } catch (statusError) {
        console.error("❌ 获取删物任务状态失败:", statusError);
      }
    }

    return NextResponse.json({
      success: true,
      taskStatus: finalStatus,
      outputImageUrl,
      errorMsg,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
