import { Icons } from "@/components/shared/icons";
import { cn } from "@/lib/utils";

import { RemoveObjectsComforting } from "../comforting";

type RemoveObjectsLoadingProps = {
  phase?: "mask" | "remove";
};

const stepConfig = {
  mask: {
    title: "Generating the mask",
    hint: "SAM3.1 is refining your box into a clean editable mask.",
    activeStep: 1,
  },
  remove: {
    title: "Removing the object",
    hint: "We are cleaning up the marked area and blending the background.",
    activeStep: 2,
  },
} as const;

const steps = [
  "Draw a box around the object",
  "Generate a clean mask with SAM3.1",
  "Remove the object and blend the background",
];

export default function RemoveObjectsLoading({
  phase = "remove",
}: RemoveObjectsLoadingProps) {
  const config = stepConfig[phase];

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{config.title}</h3>
        <p className="text-sm text-muted-foreground">
          {config.hint}
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="grid gap-3">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const isActive = stepNumber === config.activeStep + 1;
              const isDone = stepNumber < config.activeStep + 1;

              return (
                <div key={step} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      isDone && "border-primary bg-primary text-primary-foreground",
                      isActive &&
                        "border-primary bg-primary/10 text-primary shadow-sm",
                      !isDone &&
                        !isActive &&
                        "border-muted-foreground/20 bg-background text-muted-foreground",
                    )}
                  >
                    {isDone ? "✓" : stepNumber}
                  </div>
                  <div className="pt-0.5">
                    <p
                      className={cn(
                        "text-sm",
                        isDone || isActive
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {step}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border bg-muted/40">
          <div className="flex flex-col items-center gap-3">
            <Icons.spinner className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Usually around 40 seconds, sometimes a bit longer.
            </p>
          </div>
        </div>
        <RemoveObjectsComforting />
      </div>
    </div>
  );
}
