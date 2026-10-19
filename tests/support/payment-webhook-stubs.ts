import Stripe from "stripe";

import type { AnalyticsEvent } from "../../lib/analytics-events";
import { OrderPhase } from "../../db/type";

export {
  ANALYTICS_EVENTS,
  createOrderAnalyticsEvent,
} from "../../lib/analytics-events";

export const env = {
  STRIPE_WEBHOOK_SECRET: "whsec_local_payment_webhook_test",
  HASHID_SALT: "local-payment-webhook-test",
};

// Signature creation/verification uses the real SDK and never makes a request.
const localStripe = new Stripe("sk_test_local_payment_webhook", {
  apiVersion: "2024-04-10",
});
export const stripe = {
  webhooks: localStripe.webhooks,
  subscriptions: {
    retrieve: async () => {
      throw new Error("Unexpected Stripe network boundary in payment webhook test");
    },
  },
};

type PaymentOrder = {
  id: number;
  userId: string;
  credit: number;
  phase: OrderPhase;
  paymentAt: Date | null;
  result: string | null;
};

type CreditRecord = { id: number; userId: string; credit: number };
type CreditTransaction = {
  userId: string;
  credit: number;
  balance: number;
  type: string;
  billingId: number;
};
type OrderWhere = { id?: number; userId?: string; phase?: OrderPhase };

export const paymentWebhookState = {
  order: null as PaymentOrder | null,
  credit: null as CreditRecord | null,
  creditTransactions: [] as CreditTransaction[],
  analyticsEvents: [] as AnalyticsEvent[],
  transactionCalls: 0,
  orderLookupCalls: 0,
  transitionAttempts: 0,
  paidTransitions: 0,
  orderCreates: 0,
  failNextLedgerWrite: false,
};

export function resetPaymentWebhookState() {
  const state = paymentWebhookState;
  state.order = {
    id: 17,
    userId: "payment-user",
    credit: 40,
    phase: OrderPhase.Pending,
    paymentAt: null,
    result: null,
  };
  state.credit = { id: 3, userId: "payment-user", credit: 4 };
  state.creditTransactions.length = 0;
  state.analyticsEvents.length = 0;
  state.transactionCalls = 0;
  state.orderLookupCalls = 0;
  state.transitionAttempts = 0;
  state.paidTransitions = 0;
  state.orderCreates = 0;
  state.failNextLedgerWrite = false;
}

function matchesOrder(where: OrderWhere) {
  const order = paymentWebhookState.order;
  return order &&
    (where.id === undefined || where.id === order.id) &&
    (where.userId === undefined || where.userId === order.userId) &&
    (where.phase === undefined || where.phase === order.phase);
}

export const paymentWebhookPrisma = {
  chargeOrder: {
    findFirst: async ({ where }: { where: OrderWhere }) => {
      paymentWebhookState.orderLookupCalls++;
      // Snapshot reads let concurrent real handlers both observe Pending.
      // The updateMany below is the shared database compare-and-set boundary.
      return matchesOrder(where) ? { ...paymentWebhookState.order! } : null;
    },
    findUnique: async ({ where }: { where: OrderWhere }) =>
      matchesOrder(where) ? { ...paymentWebhookState.order! } : null,
    updateMany: async ({ where, data }: { where: OrderWhere; data: Partial<PaymentOrder> }) => {
      const state = paymentWebhookState;
      state.transitionAttempts++;
      if (!matchesOrder(where)) return { count: 0 };
      state.order = { ...state.order!, ...data };
      if (data.phase === OrderPhase.Paid) state.paidTransitions++;
      return { count: 1 };
    },
    create: async () => {
      paymentWebhookState.orderCreates++;
      throw new Error("Webhook must reconcile an existing order");
    },
  },
  userCredit: {
    findFirst: async ({ where }: { where: { userId: string } }) =>
      paymentWebhookState.credit?.userId === where.userId
        ? { ...paymentWebhookState.credit }
        : null,
    update: async ({ data }: { data: { credit: { increment: number } } }) => {
      const state = paymentWebhookState;
      if (!state.credit) throw new Error("Credit record not found");
      state.credit = { ...state.credit, credit: state.credit.credit + data.credit.increment };
      return { ...state.credit };
    },
    create: async ({ data }: { data: { userId: string; credit: number } }) => {
      paymentWebhookState.credit = { id: 3, ...data };
      return { ...paymentWebhookState.credit };
    },
  },
  userCreditTransaction: {
    create: async ({ data }: { data: CreditTransaction }) => {
      if (paymentWebhookState.failNextLedgerWrite) {
        paymentWebhookState.failNextLedgerWrite = false;
        throw new Error("Injected credit ledger failure");
      }
      paymentWebhookState.creditTransactions.push({ ...data });
      return { id: paymentWebhookState.creditTransactions.length, ...data };
    },
  },
  $transaction: async (callback: (tx: typeof paymentWebhookPrisma) => Promise<unknown>) => {
    const state = paymentWebhookState;
    state.transactionCalls++;
    const snapshot = {
      order: state.order && { ...state.order },
      credit: state.credit && { ...state.credit },
      transactions: state.creditTransactions.map((entry) => ({ ...entry })),
      paidTransitions: state.paidTransitions,
    };
    try {
      return await callback(paymentWebhookPrisma);
    } catch (error) {
      state.order = snapshot.order;
      state.credit = snapshot.credit;
      state.creditTransactions = snapshot.transactions;
      state.paidTransitions = snapshot.paidTransitions;
      throw error;
    }
  },
};

export async function emitServerAnalyticsEvent(event: AnalyticsEvent) {
  paymentWebhookState.analyticsEvents.push(event);
  return event;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
