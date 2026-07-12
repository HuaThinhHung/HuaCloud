import type { Metadata } from "next";
import { GalleryView } from "@/features/gallery/gallery-view";

export const metadata: Metadata = { title: "Thư viện" };

export default function GalleryPage() {
  return <GalleryView view="all" />;
}
