import { Suspense } from "react";

import { PayPalReturnHandler } from "@/components/payments/paypal-return-handler";

export const dynamic = "force-dynamic";

export default function PayPalReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Processing your PayPal payment...
        </div>
      }
    >
      <PayPalReturnHandler />
    </Suspense>
  );
}
