import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { unstable_setRequestLocale } from "next-intl/server";
import { signIn } from "next-auth/react";

import { authOptions } from "@/lib/auth";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleIcon } from "@/assets/icons/GoogleIcon";

type Props = {
  params: { locale: string };
};

export default async function SignInPage({ params: { locale } }: Props) {
  unstable_setRequestLocale(locale);
  
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect("/app");
  }

  return (
    <Container className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">欢迎回来</CardTitle>
          <CardDescription className="text-center">
            使用 Google 账户登录继续使用服务
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading...</div>}>
            <SignInForm />
          </Suspense>
        </CardContent>
      </Card>
    </Container>
  );
}

async function SignInForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/app" });
      }}
    >
      <Button type="submit" className="w-full" size="lg">
        <GoogleIcon className="mr-2 h-4 w-4" />
        使用 Google 登录
      </Button>
    </form>
  );
} 