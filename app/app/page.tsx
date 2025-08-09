import { redirect } from "next/navigation";
import { headers } from "next/headers";

// 这个页面处理没有locale的/app路径，重定向到正确的locale路径
export default function AppPage() {
  const headersList = headers();
  const acceptLanguage = headersList.get('accept-language') || '';
  
  // 简单的语言检测逻辑
  let locale = 'en'; // 默认英语
  
  if (acceptLanguage.includes('zh')) {
    locale = 'zh';
  } else if (acceptLanguage.includes('ja')) {
    locale = 'ja';
  } else if (acceptLanguage.includes('ko')) {
    locale = 'ko';
  } else if (acceptLanguage.includes('es')) {
    locale = 'es';
  } else if (acceptLanguage.includes('fr')) {
    locale = 'fr';
  } else if (acceptLanguage.includes('de')) {
    locale = 'de';
  } else if (acceptLanguage.includes('pt')) {
    locale = 'pt';
  } else if (acceptLanguage.includes('ar')) {
    locale = 'ar';
  }
  
  // 重定向到带locale的app页面
  redirect(`/${locale}/app`);
}
