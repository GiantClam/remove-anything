import { env } from "@/env.mjs";

import type {
  CapturePayPalOrderParams,
  CreatePayPalOrderParams,
  PayPalClient,
  PayPalConfig,
  PayPalLink,
} from "./sdk";

function getPayPalBaseUrl(environment: "sandbox" | "live") {
  return environment === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function encodeBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

function formatPayPalAmount(amount: number) {
  return (amount / 100).toFixed(2);
}

function getApprovalUrl(links: PayPalLink[]) {
  const approvalLink = links.find(
    (link) => link.rel === "payer-action" || link.rel === "approve",
  );

  if (!approvalLink?.href) {
    throw new Error("PayPal approval URL missing");
  }

  return approvalLink.href;
}

export function createPayPalClient(config?: PayPalConfig): PayPalClient {
  const clientId = config?.clientId || env.PAYPAL_CLIENT_ID;
  const clientSecret = config?.clientSecret || env.PAYPAL_CLIENT_SECRET;
  const environment = config?.environment || env.PAYPAL_ENV;
  const baseUrl = getPayPalBaseUrl(environment);

  async function getAccessToken() {
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok || !data.access_token) {
      throw new Error(data.error_description || "PayPal auth failed");
    }

    return data.access_token as string;
  }

  return {
    async createOrder(params: CreatePayPalOrderParams) {
      const accessToken = await getAccessToken();
      const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `charge-order-create-${params.orderId}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              custom_id: params.orderId,
              description: params.description,
              amount: {
                currency_code: params.currency,
                value: formatPayPalAmount(params.amount),
              },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                return_url: params.returnUrl,
                cancel_url: params.cancelUrl,
                user_action: "PAY_NOW",
              },
            },
          },
        }),
        cache: "no-store",
      });

      const data = await response.json();
      if (!response.ok || !data?.id) {
        throw new Error(data?.message || "PayPal create order failed");
      }

      return {
        id: data.id as string,
        status: (data.status as string) || "CREATED",
        approvalUrl: getApprovalUrl((data.links || []) as PayPalLink[]),
        amount: {
          currency_code: params.currency,
          value: formatPayPalAmount(params.amount),
        },
        raw: data,
      };
    },

    async captureOrder(params: CapturePayPalOrderParams) {
      const accessToken = await getAccessToken();
      const response = await fetch(
        `${baseUrl}/v2/checkout/orders/${params.paypalOrderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            ...(params.requestId
              ? { "PayPal-Request-Id": params.requestId }
              : {}),
          },
          body: JSON.stringify({}),
          cache: "no-store",
        },
      );

      const data = await response.json();
      if (!response.ok || !data?.id) {
        throw new Error(data?.message || "PayPal capture failed");
      }

      const purchaseUnit = Array.isArray(data.purchase_units)
        ? data.purchase_units[0]
        : undefined;
      const capture =
        purchaseUnit?.payments?.captures &&
        Array.isArray(purchaseUnit.payments.captures)
          ? purchaseUnit.payments.captures[0]
          : undefined;

      return {
        id: data.id as string,
        status: (data.status as string) || "COMPLETED",
        captureId: capture?.id as string | undefined,
        amount: capture?.amount as
          | { currency_code: string; value: string }
          | undefined,
        raw: data,
      };
    },
  };
}
