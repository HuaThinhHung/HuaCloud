"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FolderPlus,
  Heart,
  ImageIcon,
  Loader2,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlbumPicker } from "@/features/albums/album-picker";
import { Topbar } from "@/components/layout/topbar";
import { useUpload } from "@/features/upload/upload-provider";
import { cn } from "@/lib/utils";
import type { AssetDTO, AssetKind } from "@/types/asset";
import {
  addToAlbumApi,
  deleteAssetApi,
  fetchAssets,
  removeFromAlbumApi,
  renameAssetApi,
  restoreAssetApi,
  retryAssetApi,
  toggleFavoriteApi,
  type GalleryView as ViewKind,
  type SortKey,
} from "./api";
import { AssetCard } from "./asset-card";
import { ImageEditor } from "./image-editor";
import { Lightbox } from "./lightbox";

const VIEW_TITLE: Record<ViewKind, string> = {
  all: "Thư viện",
  favorites: "Yêu thích",
  trash: "Thùng rác",
};

const KINDS: { label: string; value: AssetKind | "" }[] = [
  { label: "Tất cả", value: "" },
  { label: "Ảnh", value: "IMAGE" },
  { label: "Video", value: "VIDEO" },
];

const SORTS: { label: string; value: SortKey }[] = [
  { label: "Mới nhất", value: "new" },
  { label: "Cũ nhất", value: "old" },
  { label: "Tên A–Z", value: "name" },
  { label: "Dung lượng", value: "size" },
];

export function GalleryView({
  view,
  albumId,
  title,
}: {
  view: ViewKind;
  albumId?: string;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const { pickFiles } = useUpload();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [kind, setKind] = useState<AssetKind | "">("");
  const [sort, setSort] = useState<SortKey>("new");
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useInfiniteQuery({
    queryKey: ["assets", view, debouncedQ, kind, sort, albumId ?? ""],
    queryFn: ({ pageParam }) =>
      fetchAssets({ view, q: debouncedQ, cursor: pageParam, kind, sort, albumId }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.pages.some((p) =>
        p.items.some((a) => a.status === "PENDING" || a.status === "PROCESSING"),
      );
      return hasProcessing ? 2500 : false;
    },
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
    if (hard && !window.confirm(`Xóa vĩnh viễn "${a.fileName}"? File trên Telegram cũng sẽ bị xóa.`))
      return;
    remove.mutate({ id: a.id, hard });
    if (lightboxId === a.id) setLightboxId(null);
  };

  // ----- chọn nhiều -----
  const selectedIds = useMemo(() => [...selected], [selected]);
  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    const hard = view === "trash";
    if (!window.confirm(`${hard ? "Xóa vĩnh viễn" : "Chuyển vào thùng rác"} ${selected.size} mục?`))
      return;
    try {
      await Promise.all(selectedIds.map((id) => deleteAssetApi(id, hard)));
      toast.success(`Đã ${hard ? "xóa" : "chuyển thùng rác"} ${selectedIds.length} mục.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa thất bại");
    }
    invalidate();
    exitSelect();
  };
  const bulkRemoveFromAlbum = async () => {
    if (!albumId) return;
    try {
      await removeFromAlbumApi(albumId, selectedIds);
      toast.success(`Đã bỏ ${selectedIds.length} mục khỏi album.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    }
    invalidate();
    exitSelect();
  };

  const showToolbar = !selecting && view !== "trash";

  return (
    <>
      <Topbar title={title ?? VIEW_TITLE[view]}>
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

      <main className="px-4 py-4 md:px-6">
        {/* thanh chọn nhiều */}
        {selecting && (
          <div className="hc-fade-up sticky top-14 z-20 -mx-4 mb-3 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur md:-mx-6 md:px-6">
            <button
              onClick={exitSelect}
              className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
              aria-label="Hủy chọn"
            >
              <X className="size-4.5" />
            </button>
            <span className="text-sm font-medium">Đã chọn {selected.size}</span>
            <div className="flex flex-1 items-center justify-end gap-1.5">
              {albumId ? (
                <BarBtn onClick={bulkRemoveFromAlbum} disabled={!selected.size} label="Bỏ khỏi album">
                  <X className="size-4" />
                </BarBtn>
              ) : (
                <BarBtn
                  onClick={() => setPickerOpen(true)}
                  disabled={!selected.size}
                  label="Thêm vào album"
                >
                  <FolderPlus className="size-4" />
                </BarBtn>
              )}
              <BarBtn onClick={bulkDelete} disabled={!selected.size} label="Xóa" danger>
                <Trash2 className="size-4" />
              </BarBtn>
            </div>
          </div>
        )}

        {/* thanh bộ lọc + sắp xếp */}
        {showToolbar && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
            <div className="flex shrink-0 gap-1">
              {KINDS.map((k) => (
                <button
                  key={k.value || "all"}
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-3 text-[13px] transition-colors",
                    kind === k.value
                      ? "bg-accent text-background"
                      : "bg-surface-2 text-muted hover:text-foreground",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-8 rounded-lg border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent/60"
                aria-label="Sắp xếp"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSelecting(true)}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-surface-2"
              >
                <CheckCircle2 className="size-4" />
                Chọn
              </button>
            </div>
          </div>
        )}

        {query.isLoading ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <EmptyState view={view} inAlbum={!!albumId} hasQuery={!!debouncedQ} onUpload={pickFiles} />
        ) : (
          <>
            {!selecting && (
              <p className="mb-4 text-xs text-muted-2">
                {total} mục{debouncedQ ? ` khớp “${debouncedQ}”` : ""}
              </p>
            )}
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5">
              {items.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  inTrash={view === "trash"}
                  selecting={selecting}
                  selected={selected.has(a.id)}
                  onToggleSelect={() => toggleSelect(a.id)}
                  onOpen={() => setLightboxId(a.id)}
                  onFavorite={() => favorite.mutate(a.id)}
                  onDelete={() => openDelete(a)}
                  onRestore={view === "trash" ? () => restore.mutate(a.id) : undefined}
                  onRetry={a.status === "FAILED" ? () => retry.mutate(a.id) : undefined}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="flex h-16 items-center justify-center">
              {query.isFetchingNextPage && <Loader2 className="size-5 animate-spin text-muted-2" />}
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

      {editingAsset && <ImageEditor asset={editingAsset} onClose={() => setEditingId(null)} />}

      {pickerOpen && (
        <AlbumPicker
          assetIds={selectedIds}
          onClose={() => setPickerOpen(false)}
          onDone={() => {
            setPickerOpen(false);
            exitSelect();
          }}
        />
      )}
    </>
  );
}

function BarBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors disabled:opacity-40",
        danger
          ? "text-danger hover:bg-danger/10"
          : "bg-accent text-background hover:bg-accent-strong",
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
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
  inAlbum,
  hasQuery,
  onUpload,
}: {
  view: ViewKind;
  inAlbum: boolean;
  hasQuery: boolean;
  onUpload: () => void;
}) {
  const copy = hasQuery
    ? { title: "Không tìm thấy kết quả", desc: "Thử từ khóa khác hoặc đổi bộ lọc." }
    : inAlbum
      ? { title: "Album đang trống", desc: "Vào Thư viện, chọn ảnh rồi 'Thêm vào album'." }
      : view === "favorites"
        ? { title: "Chưa có ảnh yêu thích", desc: "Bấm trái tim trên ảnh để đánh dấu yêu thích." }
        : view === "trash"
          ? { title: "Thùng rác trống", desc: "Ảnh bị xóa nằm đây 30 ngày trước khi xóa vĩnh viễn." }
          : {
              title: "Thư viện đang trống",
              desc: "Kéo thả ảnh, dán từ clipboard (Ctrl+V), hoặc bấm nút bên dưới.",
            };

  return (
    <div className="hc-fade-up flex flex-col items-center justify-center py-28 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-surface">
        <ImageIcon className="size-7 text-muted-2" strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 text-[15px] font-medium">{copy.title}</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{copy.desc}</p>
      {view === "all" && !inAlbum && !hasQuery && (
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
