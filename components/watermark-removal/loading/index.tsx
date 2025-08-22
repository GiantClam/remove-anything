import { Icons } from "@/components/shared/icons";

export default function Loading() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Processing</h3>
        <p className="text-sm text-muted-foreground">
          AI is removing watermarks from your image...
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
          <div className="flex h-full w-full items-center justify-center">
            <Icons.spinner className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="h-2 w-full animate-pulse rounded bg-muted" />
          <div className="h-2 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
