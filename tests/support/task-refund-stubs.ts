import type { AnalyticsEvent } from "../../lib/analytics-events";

export {
  ANALYTICS_EVENTS,
  createCreditsAnalyticsEvent,
  createTaskAnalyticsEvent,
} from "../../lib/analytics-events";

export const env = { TASK_HEADER_KEY: "local-task-refund-webhook-key" };

type Task = {
  id: number;
  userId: string | null;
  replicateId: string;
  model: string;
  taskStatus: string;
  locale: string | null;
  executeEndTime?: bigint;
};
type Billing = {
  id: number;
  userId: string;
  state: string;
  amount: number;
  type: string;
  taskId: number | null;
  description: string | null;
};
type CreditTransaction = { id: number; userId: string; credit: number; balance: number; billingId: number; type: string };
type TaskWhere = { id?: number; userId?: string; replicateId?: string; taskStatus?: string };
type BillingWhere = { id?: number; userId?: string; type?: string; state?: string; taskId?: number; description?: string; OR?: BillingWhere[] };

export const taskRefundState = {
  task: null as Task | null,
  backgroundTask: null as Task | null,
  billings: [] as Billing[],
  creditTransactions: [] as CreditTransaction[],
  credit: 4,
  events: [] as AnalyticsEvent[],
  notifications: 0,
  statusCasAttempts: 0,
  refundCasAttempts: 0,
  refundClaims: 0,
  transactionCalls: 0,
  failNextLedgerWrite: false,
};

export function resetTaskRefundState() {
  const state = taskRefundState;
  state.task = { id: 17, userId: "task-owner", replicateId: "provider-17", model: "image-model", taskStatus: "processing", locale: "en" };
  state.backgroundTask = { ...state.task, replicateId: "background-17", model: "runninghub/background-removal" };
  state.billings = [{ id: 91, userId: "task-owner", state: "Done", amount: 7, type: "Withdraw", taskId: 17, description: "Image task" }];
  state.creditTransactions = [{ id: 11, userId: "task-owner", credit: -7, balance: 4, billingId: 91, type: "Image" }];
  state.credit = 4;
  state.events.length = 0;
  state.notifications = 0;
  state.statusCasAttempts = 0;
  state.refundCasAttempts = 0;
  state.refundClaims = 0;
  state.transactionCalls = 0;
  state.failNextLedgerWrite = false;
}

function matchesTask(task: Task | null, where: TaskWhere) {
  return task && Object.entries(where).every(([key, value]) => task[key as keyof Task] === value);
}

function matchesBilling(billing: Billing, where: BillingWhere): boolean {
  return Object.entries(where).every(([key, value]) => key === "OR"
    ? (value as BillingWhere[]).some((option) => matchesBilling(billing, option))
    : billing[key as keyof Billing] === value);
}

export const taskRefundPrisma = {
  taskData: {
    findFirst: async ({ where }: { where: TaskWhere }) =>
      matchesTask(taskRefundState.task, where) ? { ...taskRefundState.task! } : null,
    updateMany: async ({ where, data }: { where: TaskWhere; data: Partial<Task> }) => {
      taskRefundState.statusCasAttempts++;
      if (!matchesTask(taskRefundState.task, where)) return { count: 0 };
      taskRefundState.task = { ...taskRefundState.task!, ...data };
      return { count: 1 };
    },
  },
  backgroundRemovalTask: {
    findFirst: async ({ where }: { where: TaskWhere }) =>
      matchesTask(taskRefundState.backgroundTask, where) ? { ...taskRefundState.backgroundTask! } : null,
  },
  userBilling: {
    findFirst: async ({ where }: { where: BillingWhere }) => {
      const billing = taskRefundState.billings.find((entry) => matchesBilling(entry, where));
      return billing ? { ...billing } : null;
    },
    updateMany: async ({ where, data }: { where: BillingWhere; data: Partial<Billing> }) => {
      taskRefundState.refundCasAttempts++;
      const billing = taskRefundState.billings.find((entry) => matchesBilling(entry, where));
      if (!billing) return { count: 0 };
      Object.assign(billing, data);
      taskRefundState.refundClaims++;
      return { count: 1 };
    },
    create: async ({ data }: { data: Omit<Billing, "id"> }) => {
      const billing = { id: 100 + taskRefundState.billings.length, ...data };
      taskRefundState.billings.push(billing);
      return { ...billing };
    },
  },
  userCreditTransaction: {
    findMany: async ({ where }: { where: { userId: string; billingId: number; credit: { lt: number } } }) =>
      taskRefundState.creditTransactions.filter((entry) => entry.userId === where.userId && entry.billingId === where.billingId && entry.credit < where.credit.lt).map((entry) => ({ credit: entry.credit })),
    create: async ({ data }: { data: Omit<CreditTransaction, "id"> }) => {
      if (taskRefundState.failNextLedgerWrite) {
        taskRefundState.failNextLedgerWrite = false;
        throw new Error("Injected refund ledger failure");
      }
      const transaction = { id: 200 + taskRefundState.creditTransactions.length, ...data };
      taskRefundState.creditTransactions.push(transaction);
      return { ...transaction };
    },
  },
  userCredit: {
    findFirst: async ({ where }: { where: { userId: string } }) =>
      where.userId === "task-owner" ? { id: 3, userId: where.userId, credit: taskRefundState.credit } : null,
    update: async ({ data }: { data: { credit: { increment: number } } }) => {
      taskRefundState.credit += data.credit.increment;
      return { id: 3, userId: "task-owner", credit: taskRefundState.credit };
    },
  },
  $transaction: async (callback: (tx: typeof taskRefundPrisma) => Promise<unknown>) => {
    const state = taskRefundState;
    state.transactionCalls++;
    const snapshot = {
      credit: state.credit,
      billings: state.billings.map((entry) => ({ ...entry })),
      transactions: state.creditTransactions.map((entry) => ({ ...entry })),
      claims: state.refundClaims,
    };
    try {
      return await callback(taskRefundPrisma);
    } catch (error) {
      state.credit = snapshot.credit;
      state.billings = snapshot.billings;
      state.creditTransactions = snapshot.transactions;
      state.refundClaims = snapshot.claims;
      throw error;
    }
  },
};

export async function emitServerAnalyticsEvent(event: AnalyticsEvent) {
  taskRefundState.events.push(event);
  return event;
}

export const logsnag = {
  track: async () => { taskRefundState.notifications++; },
};

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
