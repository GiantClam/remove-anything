import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 在构建时跳过静态参数生成
export async function generateStaticParams() {
  if (shouldSkipDatabaseQuery()) {
    return [];
  }
  
  return [
    { nextauth: ['signin'] },
    { nextauth: ['signout'] },
    { nextauth: ['callback'] },
    { nextauth: ['session'] },
    { nextauth: ['csrf'] },
  ];
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 