import "server-only";

import { getToolRegistryEntry, type ToolSlug } from "@/lib/tool-registry";

export type OutputTier = "preview" | "full";

// Cost approval is necessary but not sufficient: the current download
// handlers only implement the bounded preview transformer. Keep full output
// fail-closed until a separate full-resolution delivery path is reviewed.
const FULL_OUTPUT_IMPLEMENTATION_ENABLED = false;

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
 * Preview output is the only tier enabled by default. Full output is gated by
 * both an authenticated subject and an explicit registry cost approval. The
 * registry's `paidEnabled` flag remains false until the owner has approved
 * provider, retry, storage, and output costs for that tool.
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
