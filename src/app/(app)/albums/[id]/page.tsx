import { AlbumDetailView } from "@/features/albums/album-detail-view";

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlbumDetailView id={id} />;
}
