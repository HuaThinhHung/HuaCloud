"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAlbum } from "@/features/gallery/api";
import { GalleryView } from "@/features/gallery/gallery-view";

export function AlbumDetailView({ id }: { id: string }) {
  const { data: album } = useQuery({ queryKey: ["album", id], queryFn: () => fetchAlbum(id) });
  return <GalleryView view="all" albumId={id} title={album?.name ?? "Album"} />;
}
