import type { BackgroundToolVariant } from "@/lib/background-tool-variants";

/** Map marketing background variants to registry / GA tool_slug values. */
export function getBackgroundToolAnalyticsSlug(
  variant: BackgroundToolVariant = "remove-background",
): string {
  switch (variant) {
    case "transparent-png":
      return "transparent-png-maker";
    case "white-background":
      return "white-background-maker";
    case "change-background-color":
      return "change-background-color";
    case "remove-background":
    default:
      return "remove-background";
  }
}
