import type { Metadata } from "next";
import { GalleryView } from "@/features/gallery/gallery-view";

export const metadata: Metadata = { title: "Yêu thích" };

export default function FavoritesPage() {
  return <GalleryView view="favorites" />;
}
