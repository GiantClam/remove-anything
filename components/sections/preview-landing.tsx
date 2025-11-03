import { use } from "react";
import Image from "next/image";
import Link from "next/link";

import { getFluxDataBySeed } from "@/db/queries/flux-query";
import { Link as I18nLink } from "@/lib/navigation";
import PreviewGallery from "./preview-gallery";

export default async function PreviewLanding() {
  // SSR：首屏只加载12张图片，减少初始加载时间
  const { data = [] } = await getFluxDataBySeed({ limit: 12 });
  
  return (
    <div className="mx-auto mb-10 mt-8 w-[90%]">
      <PreviewGallery initialData={data} />
    </div>
  );
}
