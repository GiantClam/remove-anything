import { Suspense } from "react";

import { PayPalCancelHandler } from "@/components/payments/paypal-cancel-handler";

export const dynamic = "force-dynamic";

export default function PayPalCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Canceling your PayPal payment...
        </div>
      }
    >
      <PayPalCancelHandler />
    </Suspense>
  );
}
