"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, Search, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { useUpload } from "@/features/upload/upload-provider";
import { cn } from "@/lib/utils";
import type { AssetDTO } from "@/types/asset";
import {
  deleteAssetApi,
  fetchAssets,
  renameAssetApi,
  restoreAssetApi,
  retryAssetApi,
  toggleFavoriteApi,
  type GalleryView as ViewKind,
} from "./api";
import { AssetCard } from "./asset-card";
import { ImageEditor } from "./image-editor";
import { Lightbox } from "./lightbox";

const VIEW_TITLE: Record<ViewKind, string> = {
  all: "Thư viện",
  favorites: "Yêu thích",
  trash: "Thùng rác",
};

export function GalleryView({ view }: { view: ViewKind }) {
  const queryClient = useQueryClient();
  const { pickFiles } = useUpload();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useInfiniteQuery({
    queryKey: ["assets", view, debouncedQ],
    queryFn: ({ pageParam }) => fetchAssets({ view, q: debouncedQ, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.pages.some((p) =>
        p.items.some((a) => a.status === "PENDING" || a.status === "PROCESSING"),
      );
      return hasProcessing ? 2500 : false;
    },
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.total ?? 0;

  // infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["assets"] });

  const favorite = useMutation({
    mutationFn: toggleFavoriteApi,
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: ({ id, hard }: { id: string; hard: boolean }) => deleteAssetApi(id, hard),
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(v.hard ? "Đã xóa vĩnh viễn." : "Đã chuyển vào thùng rác.");
    },
    onError: (e) => toast.error(e.message),
  });
  const restore = useMutation({
    mutationFn: restoreAssetApi,
    onSuccess: () => {
      invalidate();
      toast.success("Đã khôi phục.");
    },
    onError: (e) => toast.error(e.message),
  });
  const retry = useMutation({
    mutationFn: retryAssetApi,
    onSuccess: () => {
      invalidate();
      toast.info("Đang xử lý lại...");
    },
    onError: (e) => toast.error(e.message),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameAssetApi(id, name),
    onSuccess: () => {
      invalidate();
      toast.success("Đã đổi tên ảnh.");
    },
    onError: (e) => toast.error(e.message),
  });

  const lightboxIndex = items.findIndex((a) => a.id === lightboxId);
  const lightboxAsset = lightboxIndex >= 0 ? items[lightboxIndex] : null;
  const editingAsset = editingId ? (items.find((a) => a.id === editingId) ?? null) : null;

  const openDelete = (a: AssetDTO) => {
    const hard = view === "trash";
    if (hard && !window.confirm(`Xóa vĩnh viễn "${a.fileName}"? File trên Telegram cũng sẽ bị xóa.`)) return;
    remove.mutate({ id: a.id, hard });
    if (lightboxId === a.id) setLightboxId(null);
  };

  return (
    <>
      <Topbar title={VIEW_TITLE[view]}>
        <div className="relative hidden w-64 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên file..."
            className="h-8.5 w-full rounded-lg border border-border bg-surface pl-9 pr-8 text-[13px] outline-none transition-colors placeholder:text-muted-2 focus:border-accent/60"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-2 hover:text-foreground"
              aria-label="Xóa tìm kiếm"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </Topbar>

      <main className="px-4 py-5 md:px-6">
        {query.isLoading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <EmptyState view={view} hasQuery={!!debouncedQ} onUpload={pickFiles} />
        ) : (
          <>
            <p className="mb-4 text-xs text-muted-2">
              {total} mục{debouncedQ ? ` khớp “${debouncedQ}”` : ""}
            </p>
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5">
              {items.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  inTrash={view === "trash"}
                  onOpen={() => setLightboxId(a.id)}
                  onFavorite={() => favorite.mutate(a.id)}
                  onDelete={() => openDelete(a)}
                  onRestore={view === "trash" ? () => restore.mutate(a.id) : undefined}
                  onRetry={a.status === "FAILED" ? () => retry.mutate(a.id) : undefined}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="flex h-16 items-center justify-center">
              {query.isFetchingNextPage && (
                <Loader2 className="size-5 animate-spin text-muted-2" />
              )}
            </div>
          </>
        )}
      </main>

      {lightboxAsset && (
        <Lightbox
          asset={lightboxAsset}
          onClose={() => setLightboxId(null)}
          onPrev={() => setLightboxId(items[lightboxIndex - 1]?.id ?? lightboxAsset.id)}
          onNext={() => setLightboxId(items[lightboxIndex + 1]?.id ?? lightboxAsset.id)}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < items.length - 1}
          onFavorite={() => favorite.mutate(lightboxAsset.id)}
          onDelete={() => openDelete(lightboxAsset)}
          onRename={(name) => rename.mutate({ id: lightboxAsset.id, name })}
          onEdit={() => setEditingId(lightboxAsset.id)}
        />
      )}

      {editingAsset && (
        <ImageEditor asset={editingAsset} onClose={() => setEditingId(null)} />
      )}
    </>
  );
}

function SkeletonGrid() {
  const heights = [180, 240, 200, 280, 160, 220, 260, 190, 210, 240];
  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5">
      {heights.map((h, i) => (
        <div
          key={i}
          className="mb-3 animate-pulse break-inside-avoid rounded-[10px] bg-surface-2"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

function EmptyState({
  view,
  hasQuery,
  onUpload,
}: {
  view: ViewKind;
  hasQuery: boolean;
  onUpload: () => void;
}) {
  const copy = hasQuery
    ? { title: "Không tìm thấy kết quả", desc: "Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm." }
    : view === "favorites"
      ? { title: "Chưa có ảnh yêu thích", desc: "Bấm biểu tượng trái tim trên ảnh để đánh dấu yêu thích." }
      : view === "trash"
        ? { title: "Thùng rác trống", desc: "Ảnh bị xóa sẽ nằm ở đây 30 ngày trước khi xóa vĩnh viễn." }
        : {
            title: "Thư viện đang trống",
            desc: "Kéo thả ảnh vào bất kỳ đâu, dán từ clipboard (Ctrl+V), hoặc bấm nút bên dưới.",
          };

  return (
    <div className="hc-fade-up flex flex-col items-center justify-center py-28 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-surface">
        <ImageIcon className="size-7 text-muted-2" strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 text-[15px] font-medium">{copy.title}</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{copy.desc}</p>
      {view === "all" && !hasQuery && (
        <button
          onClick={onUpload}
          className={cn(
            "mt-6 flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-[13px] font-medium text-background",
            "transition-all hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20",
          )}
        >
          <UploadCloud className="size-4" />
          Tải ảnh đầu tiên lên
        </button>
      )}
    </div>
  );
}
