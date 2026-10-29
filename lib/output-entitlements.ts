import "server-only";

import { getToolRegistryEntry, type ToolSlug } from "@/lib/tool-registry";

export type OutputTier = "preview" | "full";

// Full-resolution delivery is implemented on the core download boundaries
// (background / object / watermark) via materializeImage(Zip)Output. Keep this
// flag as an explicit release switch separate from registry cost approval.
const FULL_OUTPUT_IMPLEMENTATION_ENABLED = true;

export function isFullOutputImplementationEnabled() {
  return FULL_OUTPUT_IMPLEMENTATION_ENABLED;
}

export class OutputEntitlementError extends Error {
  constructor(
    public readonly code:
    | "FULL_OUTPUT_REQUIRES_AUTHENTICATION"
    | "FULL_OUTPUT_NOT_ENABLED"
    | "TOOL_CONFIG_UNAVAILABLE",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OutputEntitlementError";
  }
}

/**
 * Resolve the output tier at the attachment boundary.
 *
 * Preview remains the default. Full output requires authentication, an
 * enabled implementation switch, and a matching registry cost approval with
 * `paidEnabled: true`.
 */
export function assertOutputEntitlement(args: {
  toolSlug: ToolSlug | string;
  requestedTier: OutputTier;
  userId?: string | null;
}) {
  const tool = getToolRegistryEntry(args.toolSlug);
  if (!tool) {
    throw new OutputEntitlementError(
      "TOOL_CONFIG_UNAVAILABLE",
      "Tool output configuration is unavailable",
      503,
    );
  }

  if (args.requestedTier === "preview") {
    return { tier: "preview" as const, tool };
  }

  if (!args.userId) {
    throw new OutputEntitlementError(
      "FULL_OUTPUT_REQUIRES_AUTHENTICATION",
      "Sign in or create an account to request full output",
      401,
    );
  }

  if (
    !FULL_OUTPUT_IMPLEMENTATION_ENABLED ||
    !tool.paidEnabled ||
    !tool.costApproval ||
    tool.costApproval.creditCost !== tool.creditCost
  ) {
    throw new OutputEntitlementError(
      "FULL_OUTPUT_NOT_ENABLED",
      "Full output is not enabled for this tool yet",
      402,
    );
  }

  return { tier: "full" as const, tool };
}

export function getRequestedOutputTier(value: string | null): OutputTier {
  return value === "full" ? "full" : "preview";
}
