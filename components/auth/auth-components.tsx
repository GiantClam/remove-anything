"use client";

import { ReactNode } from "react";

import { signIn } from "next-auth/react";

import { useAuth } from "@/hooks/use-auth";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { trackAnalyticsEvent } from "@/lib/gtag";

interface AuthComponentProps {
  children: ReactNode;
}

export function SignedIn({ children }: AuthComponentProps) {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) return null;

  return <>{children}</>;
}

export function SignedOut({ children }: AuthComponentProps) {
  const { isSignedIn } = useAuth();

  if (isSignedIn) return null;

  return <>{children}</>;
}

interface SignInButtonProps {
  children: ReactNode;
  mode?: "modal" | "redirect";
  forceRedirectUrl?: string;
}

export function SignInButton({
  children,
  mode,
  forceRedirectUrl,
}: SignInButtonProps) {
  const handleClick = () => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.signupStarted, {
      auth_intent: "sign_in",
      is_authenticated: false,
    });
    signIn("google", {
      callbackUrl: forceRedirectUrl || "/app", // 将被app/page.tsx重定向到正确的locale
    });
  };

  return (
    <div onClick={handleClick} style={{ cursor: "pointer" }}>
      {children}
    </div>
  );
}
