export interface PayPalConfig {
  clientId?: string;
  clientSecret?: string;
  environment?: "sandbox" | "live";
}

export interface CreatePayPalOrderParams {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CapturePayPalOrderParams {
  paypalOrderId: string;
  requestId?: string;
}

export interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

export interface PayPalOrderAmount {
  currency_code: string;
  value: string;
}

export interface PayPalCreateOrderResult {
  id: string;
  status: string;
  approvalUrl: string;
  amount: PayPalOrderAmount;
  raw: unknown;
}

export interface PayPalCaptureResult {
  id: string;
  status: string;
  captureId?: string;
  amount?: PayPalOrderAmount;
  raw: unknown;
}

export interface PayPalClient {
  createOrder(params: CreatePayPalOrderParams): Promise<PayPalCreateOrderResult>;
  captureOrder(params: CapturePayPalOrderParams): Promise<PayPalCaptureResult>;
}
