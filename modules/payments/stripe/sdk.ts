export interface StripeConfig {
  secretKey?: string;
}

export interface CreateCheckoutSessionParams {
  priceId: string;
  quantity?: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface StripeClient {
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ id: string; url?: string }>;
}


