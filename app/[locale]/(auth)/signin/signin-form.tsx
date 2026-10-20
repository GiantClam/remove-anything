"use client";

import { signIn } from "next-auth/react";

import { GoogleIcon } from "@/assets/icons/GoogleIcon";
import { Button } from "@/components/ui/button";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { trackAnalyticsEvent } from "@/lib/gtag";

export function SignInForm() {
  const handleSignIn = async () => {
    try {
      trackAnalyticsEvent(ANALYTICS_EVENTS.signupStarted, {
        auth_intent: "sign_in",
        is_authenticated: false,
      });
      await signIn("google", {
        callbackUrl: "/app", // 将被app/page.tsx重定向到正确的locale
        redirect: true,
      });
    } catch (error) {
      console.error("登录失败:", error);
    }
  };

  return (
    <Button onClick={handleSignIn} className="w-full" size="lg">
      <GoogleIcon className="mr-2 size-4" />
      使用 Google 登录
    </Button>
  );
}
