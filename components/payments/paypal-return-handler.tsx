"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function buildPricingRedirect(pathname: string, orderId: string, success: boolean) {
  const pricingPath = pathname.replace(/\/paypal-return$/, "");
  const nextUrl = new URL(window.location.origin + pricingPath);
  if (orderId) {
    nextUrl.searchParams.set("orderId", orderId);
  }
  nextUrl.searchParams.set("success", success ? "true" : "false");
  return nextUrl.toString();
}

export function PayPalReturnHandler() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Processing your PayPal payment...");

  useEffect(() => {
    let isMounted = true;

    async function capturePayment() {
      const token = searchParams.get("token");
      const orderId = searchParams.get("orderId");

      if (!token || !orderId) {
        window.location.replace(
          buildPricingRedirect(window.location.pathname, orderId || "", false),
        );
        return;
      }

      try {
        const response = await fetch("/api/paypal/capture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            orderId,
            token,
          }),
        });

        if (!response.ok) {
          throw new Error("PayPal capture failed");
        }

        if (isMounted) {
          setMessage("Payment complete. Redirecting...");
        }
        window.location.replace(
          buildPricingRedirect(window.location.pathname, orderId, true),
        );
      } catch {
        if (isMounted) {
          setMessage("Payment verification failed. Redirecting...");
        }
        window.location.replace(
          buildPricingRedirect(window.location.pathname, orderId, false),
        );
      }
    }

    capturePayment();

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
