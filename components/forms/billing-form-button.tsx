"use client";

import { useTransition } from "react";

import { Icons } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import type { ChargeProductSelectDto } from "@/db/type";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { trackAnalyticsEvent } from "@/lib/gtag";
import { cn } from "@/lib/utils";

interface BillingFormButtonProps {
  offer: ChargeProductSelectDto;
  btnText?: string;
  channel?: "Stripe";
  variant?: "default" | "outline";
  className?: string;
}

export function BillingFormButton({
  offer,
  btnText = "Buy Plan",
  channel = "Stripe",
  variant,
  className,
}: BillingFormButtonProps) {
  let [isPending, startTransition] = useTransition();

  const checkoutAction = () =>
    startTransition(async () => {
      trackAnalyticsEvent(ANALYTICS_EVENTS.upgradeClicked, {
        plan: offer.id,
        amount: offer.amount,
        currency: offer.currency?.toUpperCase(),
        channel,
        is_authenticated: true,
      });
      const response = await fetch(`/api/charge-order`, {
        method: "POST",
        body: JSON.stringify({
          amount: offer.amount,
          channel,
          productId: offer.id,
          url: window.location.href,
          currency: offer.currency?.toUpperCase(),
        }),
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Unable to start ${channel} checkout`);
      }

      trackAnalyticsEvent(ANALYTICS_EVENTS.checkoutStarted, {
        order_id: data.orderId,
        plan: offer.id,
        amount: offer.amount,
        currency: offer.currency?.toUpperCase(),
        channel,
        is_authenticated: true,
      });

      window.location.href = data.url;
    });

  const userOffer = offer.amount === 1990;
  return (
    <Button
      variant={
        variant ?? (userOffer && channel === "Stripe" ? "default" : "outline")
      }
      className={cn("w-full", className)}
      disabled={isPending}
      onClick={checkoutAction}
    >
      {isPending ? (
        <>
          <Icons.spinner className="mr-2 size-4 animate-spin" /> Loading...
        </>
      ) : (
        <>{btnText}</>
      )}
    </Button>
  );
}
