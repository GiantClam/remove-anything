import { Icons } from "@/components/shared/icons";

export default function ComfortingMessages() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Tips</h3>
        <p className="text-sm text-muted-foreground">
          Get the best results with these tips:
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Icons.help className="h-4 w-4 text-yellow-500 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Use high-quality images for better watermark removal results
          </p>
        </div>
        
        <div className="flex items-start gap-3">
          <Icons.help className="h-4 w-4 text-yellow-500 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Ensure watermarks are clearly visible in the image
          </p>
        </div>
        
        <div className="flex items-start gap-3">
          <Icons.help className="h-4 w-4 text-yellow-500 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            The AI works best with text-based watermarks and logos
          </p>
        </div>
      </div>
    </div>
  );
}
