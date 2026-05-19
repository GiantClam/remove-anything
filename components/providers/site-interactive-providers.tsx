"use client";

import type { ReactNode } from "react";

import { ClientSessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/toaster";

import { QueryProvider } from "@/app/QueryProvider";

interface SiteInteractiveProvidersProps {
  children: ReactNode;
}

export function SiteInteractiveProviders({
  children,
}: SiteInteractiveProvidersProps) {
  return (
    <ClientSessionProvider>
      <QueryProvider>
        {children}
        <Toaster />
      </QueryProvider>
    </ClientSessionProvider>
  );
}
