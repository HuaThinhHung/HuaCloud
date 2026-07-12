import type { Metadata } from "next";
import { GalleryView } from "@/features/gallery/gallery-view";

export const metadata: Metadata = { title: "Thùng rác" };

export default function TrashPage() {
  return <GalleryView view="trash" />;
}
