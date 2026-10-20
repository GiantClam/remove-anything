export const batchRouteState = {
  providerCalls: 0,
  creditReads: 0,
  taskCreates: 0,
  transactionCalls: 0,
  rateLimitCalls: 0,
};

export async function getCurrentUser() {
  return { id: "batch-owner" };
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const kv = {};

export class KVRateLimit {
  constructor(..._args: unknown[]) {}
  async limit(..._args: unknown[]) {
    batchRouteState.rateLimitCalls++;
    return { success: true };
  }
}

export const aiGateway = {
  async removeBackgroundAsync(..._args: unknown[]) {
    batchRouteState.providerCalls++;
    throw new Error("Paid gate allowed an unexpected provider call");
  },
};

export async function getUserCredit(..._args: unknown[]) {
  batchRouteState.creditReads++;
  throw new Error("Paid gate allowed an unexpected credit read");
}

export async function createBackgroundRemovalTask(..._args: unknown[]) {
  batchRouteState.taskCreates++;
  throw new Error("Paid gate allowed an unexpected task write");
}

export const prisma = {
  async $transaction(..._args: unknown[]) {
    batchRouteState.transactionCalls++;
    throw new Error("Paid gate allowed an unexpected credit transaction");
  },
};
