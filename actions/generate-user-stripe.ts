"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth-utils";

import { stripe } from "@/lib/stripe";
import { getUserSubscriptionPlan } from "@/lib/subscription";
import { absoluteUrl } from "@/lib/utils";

export type responseAction = {
  status: "success" | "error";
  stripeUrl?: string;
};

// const billingUrl = absoluteUrl("/dashboard/billing")
const billingUrl = absoluteUrl("/pricing");

export async function generateUserStripe(
  priceId: string,
): Promise<responseAction> {
  let redirectUrl: string = "";

  try {
    const user = await getCurrentUser();

    if (!user || !user.email) {
      throw new Error("Unauthorized");
    }

    const subscriptionPlan = await getUserSubscriptionPlan(user.id);

    if (subscriptionPlan.isPaid && subscriptionPlan.stripeCustomerId) {
      // User on Paid Plan - Create a portal session to manage subscription.
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: subscriptionPlan.stripeCustomerId,
        return_url: billingUrl,
      });

      redirectUrl = stripeSession.url as string;
    } else {
      // User on Free Plan - Create a checkout session to upgrade.
      const stripeSession = await stripe.checkout.sessions.create({
        success_url: billingUrl,
        cancel_url: billingUrl,
        payment_method_types: ["card"],
        mode: "payment",
        billing_address_collection: "auto",
        customer_email: user.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: {
          userId: user.id,
        },
      });

      redirectUrl = stripeSession.url as string;
    }
  } catch (error) {
    throw new Error("Failed to generate user stripe session");
  }

  // no revalidatePath because redirect
  redirect(redirectUrl);
}
