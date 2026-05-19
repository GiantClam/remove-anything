"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function buildPricingRedirect(pathname: string, orderId: string) {
  const pricingPath = pathname.replace(/\/paypal-cancel$/, "");
  const nextUrl = new URL(window.location.origin + pricingPath);
  if (orderId) {
    nextUrl.searchParams.set("orderId", orderId);
  }
  nextUrl.searchParams.set("success", "false");
  return nextUrl.toString();
}

export function PayPalCancelHandler() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Canceling your PayPal payment...");

  useEffect(() => {
    let isMounted = true;

    async function cancelPayment() {
      const orderId = searchParams.get("orderId");

      if (!orderId) {
        window.location.replace(buildPricingRedirect(window.location.pathname, ""));
        return;
      }

      try {
        await fetch("/api/paypal/cancel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            orderId,
          }),
        });
      } finally {
        if (isMounted) {
          setMessage("Payment canceled. Redirecting...");
        }
        window.location.replace(buildPricingRedirect(window.location.pathname, orderId));
      }
    }

    cancelPayment();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
