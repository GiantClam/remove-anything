import { ReactNode } from "react";
import { getMetadataBase } from "@/lib/utils";

type Props = {
  children: ReactNode;
};

export const metadata = {
  metadataBase: getMetadataBase(),
};

// Since we have a `not-found.tsx` page on the root, a layout file
// is required, even if it's just passing children through.
export default function RootLayout({ children }: Props) {
  return children;
}
