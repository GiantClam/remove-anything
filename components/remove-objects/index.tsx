"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BaseUpload } from "@/components/upload/base-upload";
import {
  createInitialMaskHistory,
  deriveEditorState,
  type RemoveObjectViewState,
} from "@/lib/remove-objects/mask-state";
import type { FrameEditorBox } from "@/lib/remove-objects/runninghub";

import { EditorCanvas } from "./editor-canvas";
import { RemoveObjectsResultPanel } from "./result-panel";

type TaskApiResponse = {
  success: boolean;
  taskStatus: "queued" | "processing" | "succeeded" | "failed" | "expired";
  outputImageUrl?: string;
  errorMsg?: string;
};

export default function RemoveObjects({ locale: _locale }: { locale: string }) {
  const t = useTranslations("RemoveObjectsPage");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [currentMaskBlob, setCurrentMaskBlob] = useState<Blob | null>(null);
  const [history, setHistory] = useState(createInitialMaskHistory());
  const [taskId, setTaskId] = useState("");
  const [outputImageUrl, setOutputImageUrl] = useState("");
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [mode, setMode] = useState<"brush" | "erase" | "box">("box");
  const [brushSize, setBrushSize] = useState(32);
  const [boxSelection, setBoxSelection] = useState<FrameEditorBox | null>(null);
  const [importMaskUrl, setImportMaskUrl] = useState<string | null>(null);
  const [importMaskVersion, setImportMaskVersion] = useState(0);
  const [undoSignal, setUndoSignal] = useState(0);
  const [redoSignal, setRedoSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [taskPhase, setTaskPhase] = useState<
    "editing" | "processing" | "succeeded" | "failed"
  >("editing");
  const isMountedRef = useRef(true);
  const idempotencyKeyRef = useRef<string | null>(null);

  const uploadAsset = useMutation({
    mutationFn: async (file: File | Blob) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/remove-objects/assets", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Upload failed" }));
        throw new Error(error.error || "Upload failed");
      }

      return res.json() as Promise<{ url: string }>;
    },
  });

  const removeObject = useMutation({
    mutationFn: async (maskUrlOverride?: string) => {
      let finalMaskUrl = maskUrlOverride;

      if (!finalMaskUrl) {
        if (!currentMaskBlob) {
          throw new Error("Mark the object before removing it.");
        }

        const maskFile = new File([currentMaskBlob], "mask.png", {
          type: "image/png",
        });
        const uploadedMask = await uploadAsset.mutateAsync(maskFile);
        finalMaskUrl = uploadedMask.url;
      }

      const res = await fetch("/api/remove-objects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current || "",
        },
        body: JSON.stringify({
          imageUrl: sourceImageUrl,
          maskUrl: finalMaskUrl,
          authorizationConfirmed,
          authorizationPolicyVersion: "removal-auth-v1",
          authorizationSubject: "image-owner-or-authorized-editor",
        }),
      });

      const data = await res.json().catch(() => ({ error: "Remove failed" }));
      if (!res.ok) {
        throw new Error(data.error || "Remove failed");
      }

      return data as { success: boolean; taskId: string };
    },
    onMutate: () => {
      setTaskPhase("processing");
      setFailureMessage("");
      setOutputImageUrl("");
    },
    onSuccess: (data) => {
      setTaskId(data.taskId);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Object removal failed";
      setTaskPhase("failed");
      setFailureMessage(message);
      toast.error(message);
    },
  });

  const segmentSelection = useMutation({
    mutationFn: async ({
      bbox,
      importMask = true,
    }: {
      bbox: FrameEditorBox;
      importMask?: boolean;
    }) => {
      const res = await fetch("/api/remove-objects/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: sourceImageUrl, bbox }),
      });

      const data = await res.json().catch(() => ({ error: "Refine failed" }));
      if (!res.ok) {
        throw new Error(data.error || "Refine failed");
      }

      return {
        ...(data as { success: boolean; maskUrl: string }),
        importMask,
      };
    },
    onSuccess: (data) => {
      if (data.importMask) {
        setImportMaskUrl(data.maskUrl);
        setImportMaskVersion((current) => current + 1);
        setMode("brush");
        toast.success("SAM3.1 refined your box into a mask.");
      }
      setFailureMessage("");
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Selection refinement failed";
      setFailureMessage(message);
      toast.error(message);
    },
  });

  const taskQuery = useQuery<TaskApiResponse>({
    queryKey: ["objectRemovalTask", taskId],
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      const status = query.state.data?.taskStatus;
      const hasOutput = Boolean(query.state.data?.outputImageUrl);
      return status &&
        (["queued", "processing"].includes(status) ||
          (status === "succeeded" && !hasOutput))
        ? 3000
        : false;
    },
    queryFn: async () => {
      const res = await fetch(`/api/remove-objects/${taskId}`, {
        credentials: "include",
      });
      const data = await res
        .json()
        .catch(() => ({ error: "Failed to fetch task status" }));
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch task status");
      }
      return data;
    },
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const editorState = useMemo(
    () =>
      deriveEditorState(history.present.hasMask, segmentSelection.isPending),
    [history.present.hasMask, segmentSelection.isPending],
  );

  const viewState: RemoveObjectViewState = useMemo(() => {
    if (taskPhase === "processing") {
      return "processing";
    }

    if (taskPhase === "succeeded") {
      return "succeeded";
    }

    if (taskPhase === "failed") {
      return "failed";
    }

    return editorState;
  }, [editorState, taskPhase]);

  useEffect(() => {
    if (taskQuery.error) {
      setFailureMessage(taskQuery.error.message);
      setTaskPhase("failed");
      return;
    }

    if (!taskQuery.data) {
      return;
    }

    if (
      taskQuery.data.taskStatus === "succeeded" &&
      taskQuery.data.outputImageUrl
    ) {
      setOutputImageUrl(taskQuery.data.outputImageUrl);
      setTaskPhase("succeeded");
      toast.success("Object removal completed.");
      return;
    }

    if (
      taskQuery.data.taskStatus === "succeeded" &&
      !taskQuery.data.outputImageUrl
    ) {
      setTaskPhase("processing");
      return;
    }

    if (["failed", "expired"].includes(taskQuery.data.taskStatus)) {
      setFailureMessage(
        taskQuery.data.errorMsg || "Object removal failed. Please try again.",
      );
      setTaskPhase("failed");
      toast.error(
        taskQuery.data.errorMsg || "Object removal failed. Please try again.",
      );
    }
  }, [taskQuery.data, taskQuery.error]);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setSourceImageUrl("");
    setCurrentMaskBlob(null);
    setHistory(createInitialMaskHistory());
    setTaskId("");
    setOutputImageUrl("");
    setAuthorizationConfirmed(false);
    idempotencyKeyRef.current = null;
    setFailureMessage("");
    setMode("box");
    setTaskPhase("editing");
    setBoxSelection(null);
    setImportMaskUrl(null);
    setImportMaskVersion(0);
    setUndoSignal(0);
    setRedoSignal(0);
    setResetSignal(0);

    try {
      const uploaded = await uploadAsset.mutateAsync(file);
      if (!isMountedRef.current) {
        return;
      }
      setSourceImageUrl(uploaded.url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload image";
      setSelectedFile(null);
      toast.error(message);
    }
  };

  const handleRemove = () => {
    if (!authorizationConfirmed) {
      toast.error(
        "Please confirm that you own or are authorized to edit this image.",
      );
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `remove-object-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    if (currentMaskBlob) {
      void removeObject.mutateAsync(undefined);
      return;
    }

    if (!boxSelection) {
      toast.error("先框选物体，或先生成可编辑的遮罩。");
      return;
    }

    void segmentSelection
      .mutateAsync({ bbox: boxSelection, importMask: false })
      .then((data) => removeObject.mutateAsync(data.maskUrl));
  };

  const handleRefineSelection = () => {
    if (!boxSelection) {
      toast.error("Draw a box before refining it with SAM3.1.");
      return;
    }

    void segmentSelection.mutateAsync({ bbox: boxSelection, importMask: true });
  };

  const handleRetry = () => {
    handleRemove();
  };

  const handleReset = () => {
    setTaskId("");
    setOutputImageUrl("");
    setAuthorizationConfirmed(false);
    idempotencyKeyRef.current = null;
    setFailureMessage("");
    setTaskPhase("editing");
    setCurrentMaskBlob(null);
    setHistory(createInitialMaskHistory());
    setBoxSelection(null);
    setImportMaskUrl(null);
    setMode("box");
    setResetSignal((current) => current + 1);
  };

  const handleMaskChange = useCallback(
    ({ hasMask, blob }: { hasMask: boolean; blob?: Blob }) => {
      setCurrentMaskBlob(blob || null);
      setHistory((current) => ({
        ...current,
        present: {
          hasMask,
          aiPrompt: current.present.aiPrompt,
        },
      }));
      if (taskPhase === "failed") {
        setTaskPhase("editing");
        setFailureMessage("");
      }
    },
    [taskPhase],
  );

  const handleEditAgain = () => {
    setSelectedFile(null);
    setSourceImageUrl("");
    setTaskId("");
    setOutputImageUrl("");
    setAuthorizationConfirmed(false);
    idempotencyKeyRef.current = null;
    setFailureMessage("");
    setTaskPhase("editing");
    setCurrentMaskBlob(null);
    setHistory(createInitialMaskHistory());
    setBoxSelection(null);
    setImportMaskUrl(null);
    setImportMaskVersion(0);
    setMode("box");
    setUndoSignal(0);
    setRedoSignal(0);
    setResetSignal((current) => current + 1);
  };

  const handleDownload = () => {
    if (!outputImageUrl || !taskId) {
      return;
    }

    const link = document.createElement("a");
    link.href = `/api/download-object?taskId=${encodeURIComponent(taskId)}`;
    link.download = "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold md:text-5xl">{t("hero.title")}</h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg text-muted-foreground">
          {t("hero.description")}
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("hero.trust")}
        </p>
      </div>

      {!selectedFile ? (
        <BaseUpload
          accept="image/*"
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          onFileRemove={() => setSelectedFile(null)}
          className="mx-auto max-w-2xl"
        />
      ) : !sourceImageUrl ? (
        <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center">
          <p className="text-lg font-semibold">Uploading your image</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We are preparing the source image for editing.
          </p>
        </div>
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Remove Object</span>
              <div className="flex gap-2">
                {outputImageUrl ? (
                  <Button
                    type="button"
                    onClick={handleDownload}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="size-4" />
                    {t("result.download")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEditAgain}
                >
                  {t("result.editAgain")}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <EditorCanvas
                imageUrl={sourceImageUrl}
                resultImageUrl={outputImageUrl}
                state={viewState}
                errorMessage={failureMessage}
                mode={mode}
                brushSize={brushSize}
                importMaskUrl={importMaskUrl}
                importMaskVersion={importMaskVersion}
                undoSignal={undoSignal}
                redoSignal={redoSignal}
                resetSignal={resetSignal}
                disabled={
                  removeObject.isPending ||
                  segmentSelection.isPending ||
                  viewState === "processing"
                }
                onMaskChange={handleMaskChange}
                onBoxSelectionChange={setBoxSelection}
              />

              <RemoveObjectsResultPanel
                state={viewState}
                outputImageUrl={outputImageUrl}
                authorizationConfirmed={authorizationConfirmed}
                errorMessage={failureMessage}
                hasBoxSelection={Boolean(boxSelection)}
                hasMask={history.present.hasMask}
                mode={mode}
                brushSize={brushSize}
                canPaintMask={history.present.hasMask}
                canRemove={
                  Boolean(sourceImageUrl) &&
                  (history.present.hasMask || Boolean(boxSelection))
                }
                isBusy={
                  viewState === "processing" || segmentSelection.isPending
                }
                onModeChange={setMode}
                onBrushSizeChange={setBrushSize}
                onUndo={() => setUndoSignal((current) => current + 1)}
                onRefineSelection={handleRefineSelection}
                onRemove={handleRemove}
                onRetry={handleRetry}
                onEditAgain={handleEditAgain}
                onDownload={handleDownload}
                onAuthorizationChange={setAuthorizationConfirmed}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
