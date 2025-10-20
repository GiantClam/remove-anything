import Stripe from 'stripe';
import type { CreateCheckoutSessionParams, StripeClient } from './sdk';

export function createStripeClient(config?: { secretKey?: string }): StripeClient {
  const key = config?.secretKey || process.env.STRIPE_SECRET_KEY || '';
  const stripe = new Stripe(key, { apiVersion: '2024-04-10' });

  return {
    async createCheckoutSession(params: CreateCheckoutSessionParams) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          { price: params.priceId, quantity: params.quantity ?? 1 },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        metadata: params.metadata,
      });
      return { id: session.id, url: session.url || undefined };
    },
  };
}


