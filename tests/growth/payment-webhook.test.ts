import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { NextRequest } from "next/server.js";

import { ChargeOrderHashids } from "../../db/dto/charge-order.dto";
import { OrderPhase } from "../../db/type";
import {
  env,
  paymentWebhookPrisma,
  paymentWebhookState as state,
  resetPaymentWebhookState,
  stripe,
} from "../support/payment-webhook-stubs";

(globalThis as typeof globalThis & { __TEST_PRISMA__?: unknown }).__TEST_PRISMA__ = paymentWebhookPrisma;
const routePromise = import("../../app/api/webhooks/stripe/route");

beforeEach(resetPaymentWebhookState);

function checkoutEvent(eventId = "evt_checkout_17", type = "checkout.session.completed") {
  return {
    id: eventId,
    object: "event",
    type,
    data: {
      object: {
        id: type === "payment_intent.succeeded" ? "pi_17" : "cs_17",
        object: type === "payment_intent.succeeded" ? "payment_intent" : "checkout.session",
        payment_status: "paid",
        metadata: {
          orderId: ChargeOrderHashids.encode(17),
          userId: "payment-user",
          chargeProductId: "plan-40",
        },
      },
    },
  };
}

function request(event = checkoutEvent(), signature?: string | null) {
  const body = JSON.stringify(event);
  const stripeSignature = signature === undefined
    ? stripe.webhooks.generateTestHeaderString({ payload: body, secret: env.STRIPE_WEBHOOK_SECRET })
    : signature;
  return new NextRequest("https://remove-anything.test/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: stripeSignature ? { "stripe-signature": stripeSignature } : {},
  });
}

function assertFulfilledOnce() {
  assert.equal(state.order?.phase, OrderPhase.Paid);
  assert.ok(state.order?.paymentAt instanceof Date);
  assert.equal(state.credit?.credit, 44);
  assert.equal(state.paidTransitions, 1);
  assert.equal(state.orderCreates, 0);
  assert.deepEqual(state.creditTransactions, [{
    userId: "payment-user",
    credit: 40,
    balance: 44,
    type: "Charge",
    billingId: 17,
  }]);
  const orderId = ChargeOrderHashids.encode(17);
  assert.deepEqual(state.analyticsEvents, [{
    name: "purchase_completed",
    params: {
      plan: "plan-40",
      is_authenticated: true,
      order_id: orderId,
      event_id: `purchase_completed:order:${orderId}`,
    },
  }]);
}

test("Stripe webhook rejects missing or invalid signatures before database writes", async () => {
  const { POST } = await routePromise;
  assert.equal((await POST(request(checkoutEvent(), null))).status, 400);
  assert.equal((await POST(request(checkoutEvent(), "invalid-signature"))).status, 400);
  const event = checkoutEvent();
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: JSON.stringify(event),
    secret: env.STRIPE_WEBHOOK_SECRET,
  });
  event.data.object.metadata.chargeProductId = "tampered-plan";
  assert.equal((await POST(request(event, signature))).status, 400);
  assert.equal(state.orderLookupCalls, 0);
  assert.equal(state.transactionCalls, 0);
  assert.equal(state.order?.phase, OrderPhase.Pending);
  assert.equal(state.credit?.credit, 4);
  assert.deepEqual(state.analyticsEvents, []);
});

test("duplicate checkout and payment-intent callbacks fulfill one existing order once", async () => {
  const { POST } = await routePromise;
  const event = checkoutEvent();
  assert.equal((await POST(request(event))).status, 200);
  assert.equal((await POST(request(event))).status, 200);
  assert.equal((await POST(request(checkoutEvent("evt_intent_17", "payment_intent.succeeded")))).status, 200);

  assertFulfilledOnce();
  assert.equal(state.transactionCalls, 1);
  assert.equal(JSON.parse(state.order!.result!).sessionId, "cs_17");
});

test("concurrent checkout and payment-intent callbacks share the paid transition guard", async () => {
  const { POST } = await routePromise;
  const responses = await Promise.all([
    POST(request(checkoutEvent())),
    POST(request(checkoutEvent("evt_intent_17", "payment_intent.succeeded"))),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(state.transactionCalls, 2);
  // Both handlers saw Pending. Only the atomic phase change granted credits.
  assert.equal(state.transitionAttempts, 2);
  assertFulfilledOnce();
});

test("failed fulfillment rolls back before retrying the same callback", async () => {
  const { POST } = await routePromise;
  state.failNextLedgerWrite = true;
  const failed = await POST(request());
  assert.equal(failed.status, 500);
  assert.equal(state.order?.phase, OrderPhase.Pending);
  assert.equal(state.credit?.credit, 4);
  assert.deepEqual(state.creditTransactions, []);
  assert.deepEqual(state.analyticsEvents, []);

  assert.equal((await POST(request())).status, 200);
  assertFulfilledOnce();
});

test("a callback with another user does not fulfill the order", async () => {
  const { POST } = await routePromise;
  const event = checkoutEvent();
  event.data.object.metadata.userId = "different-user";
  assert.equal((await POST(request(event))).status, 200);
  assert.equal(state.transactionCalls, 0);
  assert.equal(state.order?.phase, OrderPhase.Pending);
  assert.equal(state.credit?.credit, 4);
  assert.deepEqual(state.creditTransactions, []);
  assert.deepEqual(state.analyticsEvents, []);
});
