import Stripe from 'stripe';
import type { CreateCheckoutSessionParams, StripeClient } from './sdk';
import { env } from "@/env.mjs";

export function createStripeClient(config?: { secretKey?: string }): StripeClient {
  const key = config?.secretKey || env.STRIPE_API_KEY || '';
  const stripe = new Stripe(key, { apiVersion: '2024-04-10' });

  return {
    async createCheckoutSession(params: CreateCheckoutSessionParams) {
      const lineItem = params.priceId
        ? { price: params.priceId, quantity: params.quantity ?? 1 }
        : {
            price_data: {
              currency: (params.currency || "USD").toLowerCase(),
              product_data: {
                name: params.productName || "Credits",
              },
              unit_amount: params.unitAmount,
            },
            quantity: params.quantity ?? 1,
          };

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [lineItem],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        metadata: params.metadata,
      });
      return { id: session.id, url: session.url || undefined };
    },
  };
}

