import { redirect } from "next/navigation";

export default async function FluxSchnellPage({
  params,
}: {
  params: { locale: string };
}) {
  // 重定向到主生成页面
  redirect(`/${params.locale}/app/generate`);
}
