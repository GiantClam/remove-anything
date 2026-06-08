"use client";

import { Eraser, RotateCcw, RotateCw, Square, Trash2 } from "lucide-react";
import { Paintbrush } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

type RemoveObjectsToolbarProps = {
  mode: "brush" | "erase" | "box";
  brushSize: number;
  canPaintMask?: boolean;
  disabled?: boolean;
  onModeChange: (mode: "brush" | "erase" | "box") => void;
  onBrushSizeChange: (value: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
};

export function RemoveObjectsToolbar({
  mode,
  brushSize,
  canPaintMask,
  disabled,
  onModeChange,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onReset,
}: RemoveObjectsToolbarProps) {
  const t = useTranslations("RemoveObjectsPage");

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{t("toolbar.brushObject")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid gap-2 ${canPaintMask ? "grid-cols-3" : "grid-cols-1"}`}>
          {canPaintMask ? (
            <>
              <Button
                type="button"
                variant={mode === "brush" ? "default" : "outline"}
                onClick={() => onModeChange("brush")}
                disabled={disabled}
                className="gap-2"
              >
                <Paintbrush className="size-4" />
                {t("toolbar.brush")}
              </Button>
              <Button
                type="button"
                variant={mode === "erase" ? "default" : "outline"}
                onClick={() => onModeChange("erase")}
                disabled={disabled}
                className="gap-2"
              >
                <Eraser className="size-4" />
                {t("toolbar.erase")}
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant={mode === "box" ? "default" : "outline"}
            onClick={() => onModeChange("box")}
            disabled={disabled}
            className="gap-2"
          >
            <Square className="size-4" />
            {t("toolbar.box")}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{t("toolbar.brushSize")}</span>
            <span className="text-muted-foreground">{brushSize}px</span>
          </div>
          <Slider
            value={[brushSize]}
            min={8}
            max={96}
            step={2}
            onValueChange={(value) => onBrushSizeChange(value[0] ?? brushSize)}
            disabled={disabled || mode === "box" || !canPaintMask}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onUndo}
            disabled={disabled || !canPaintMask}
            className="gap-2"
          >
            <RotateCcw className="size-4" />
            {t("toolbar.undo")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRedo}
            disabled={disabled || !canPaintMask}
            className="gap-2"
          >
            <RotateCw className="size-4" />
            {t("toolbar.redo")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            disabled={disabled}
            className="gap-2"
          >
            <Trash2 className="size-4" />
            {t("toolbar.reset")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
