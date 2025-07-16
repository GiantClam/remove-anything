//@ts-nocheck
// NextAuth User interface is defined in types/next-auth.d.ts

import { pricingData } from "@/config/subscriptions";
import { prisma } from "@/db/prisma";
import { stripe } from "@/lib/stripe";

export async function getUserSubscriptionPlan(userId: string, authUser?: User) {
  let user = await prisma.userPaymentInfo.findFirst({
    where: {
      userId,
    },
  });

  if (!user && !authUser) {
    throw new Error("User not found");
  } else if (authUser) {
    user = {
      ...user,
      stripePriceId: null,
      stripeSubscriptionId: null,
      stripeCurrentPeriodEnd: null,
    };
  }

  // Check if user is on a paid plan.
  const isPaid =
    user.stripePriceId &&
    user.stripeCurrentPeriodEnd?.getTime() + 86_400_000 > Date.now()
      ? true
      : false;

  // Find the pricing data corresponding to the user's plan
  const userPlan =
    pricingData.find((plan) => plan.stripeIds.monthly === user.stripePriceId) ||
    pricingData.find((plan) => plan.stripeIds.yearly === user.stripePriceId);

  const plan = isPaid && userPlan ? userPlan : pricingData[0];

  const interval = isPaid
    ? userPlan?.stripeIds.monthly === user.stripePriceId
      ? "month"
      : userPlan?.stripeIds.yearly === user.stripePriceId
        ? "year"
        : null
    : null;

  let isCanceled = false;
  if (isPaid && user.stripeSubscriptionId) {
    const stripePlan = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    );
    isCanceled = stripePlan.cancel_at_period_end;
  }

  return {
    ...plan,
    ...user,
    stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd?.getTime(),
    isPaid,
    interval,
    isCanceled,
  };
}
