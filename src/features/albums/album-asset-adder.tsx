"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Film, ImageIcon, Loader2, Music, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { addToAlbumApi, fetchAssets } from "@/features/gallery/api";
import { cn } from "@/lib/utils";
import type { AssetDTO } from "@/types/asset";

const KIND_ICON = { VIDEO: Film, AUDIO: Music, DOCUMENT: FileText } as const;

/**
 * Chọn ảnh từ THƯ VIỆN để thêm vào 1 album — mở ngay trong trang album (mobile + PC).
 * Chỉ hiện ảnh CHƯA thuộc album này (excludeAlbumId) nên không thêm trùng. Thêm xong
 * invalidate cả assets/albums/album để thư viện và album đồng bộ.
 */
export function AlbumAssetAdder({
  albumId,
  onClose,
  onDone,
}: {
  albumId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useInfiniteQuery({
    queryKey: ["album-add-candidates", albumId, debouncedQ],
    queryFn: ({ pageParam }) =>
      fetchAssets({
        view: "all",
        q: debouncedQ,
        cursor: pageParam,
        sort: "new",
        excludeAlbumId: albumId,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const add = async () => {
    if (!selected.size || busy) return;
    setBusy(true);
    try {
      const r = await addToAlbumApi(albumId, [...selected]);
      toast.success(`Đã thêm ${r.added} ảnh vào album.`);
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["albums"] });
      qc.invalidateQueries({ queryKey: ["album", albumId] });
      qc.invalidateQueries({ queryKey: ["album-add-candidates", albumId] });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thêm vào album thất bại");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="hc-scale-in flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface sm:h-[80dvh] sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header + tìm kiếm */}
        <div className="shrink-0 border-b border-border p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Thêm ảnh vào album</h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted hover:text-foreground"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm ảnh theo tên..."
              className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-9 text-sm outline-none focus:border-accent/60"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-2 hover:text-foreground"
                aria-label="Xóa tìm kiếm"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* lưới ảnh */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {query.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-2" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-2">
                <ImageIcon className="size-6 text-muted-2" strokeWidth={1.5} />
              </div>
              <p className="mt-4 text-sm font-medium">
                {debouncedQ ? "Không tìm thấy ảnh" : "Không còn ảnh để thêm"}
              </p>
              <p className="mt-1 max-w-xs text-[13px] text-muted">
                {debouncedQ
                  ? "Thử từ khóa khác."
                  : "Mọi ảnh trong thư viện đều đã nằm trong album này."}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-2.5 text-xs text-muted-2">{total} ảnh chưa có trong album</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {items.map((a) => (
                  <PickTile
                    key={a.id}
                    asset={a}
                    selected={selected.has(a.id)}
                    onToggle={() => toggle(a.id)}
                  />
                ))}
              </div>
              <div ref={sentinelRef} className="flex h-12 items-center justify-center">
                {query.isFetchingNextPage && (
                  <Loader2 className="size-5 animate-spin text-muted-2" />
                )}
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={add}
            disabled={!selected.size || busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {selected.size ? `Thêm ${selected.size} ảnh` : "Chọn ảnh để thêm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PickTile({
  asset,
  selected,
  onToggle,
}: {
  asset: AssetDTO;
  selected: boolean;
  onToggle: () => void;
}) {
  const isImage = asset.kind === "IMAGE" && asset.status === "READY";
  const Icon = KIND_ICON[asset.kind as keyof typeof KIND_ICON] ?? FileText;
  return (
    <button
      onClick={onToggle}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-surface-2 transition-all",
        selected ? "border-accent ring-2 ring-accent" : "border-border hover:border-border-strong",
      )}
      aria-label={asset.fileName}
    >
      {isImage ? (
        <img
          src={asset.thumbUrl}
          alt={asset.fileName}
          loading="lazy"
          className="size-full object-cover"
          style={{ backgroundColor: asset.dominantColor ?? "#f4f4f5" }}
        />
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-1.5 p-2">
          <Icon className="size-6 text-muted-2" strokeWidth={1.4} />
          <span className="line-clamp-2 text-center text-[10px] text-muted">{asset.fileName}</span>
        </span>
      )}
      <span
        className={cn(
          "absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border-2 shadow transition-colors",
          selected ? "border-accent bg-accent text-background" : "border-white/90 bg-black/30",
        )}
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}
