"use client";

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCircle2,
  FolderMinus,
  FolderPlus,
  ImageIcon,
  Loader2,
  Pencil,
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
import { cn, dateGroupKey, dateGroupLabel } from "@/lib/utils";
import type { AssetDTO, AssetKind, AssetListResponse } from "@/types/asset";
import {
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
import { BulkRenameModal } from "./bulk-rename-modal";
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
  actions,
}: {
  view: ViewKind;
  albumId?: string;
  title?: string;
  actions?: React.ReactNode;
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
  const [renameOpen, setRenameOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hideInAlbum, setHideInAlbum] = useState(false);
  const [albumManageId, setAlbumManageId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Ảnh FAILED đã tự thử lại — nhớ QUA localStorage để ảnh hỏng vĩnh viễn không bị
  // gọi Telegram lại mỗi lần mở app (chỉ thử tự động 1 lần đời/ảnh; vẫn có nút tay).
  const autoRetriedRef = useRef<Set<string> | null>(null);

  // Chip "Ẩn ảnh đã có album" chỉ có nghĩa ở Thư viện chính.
  const canHideInAlbum = view === "all" && !albumId;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Đọc sau mount (không đọc trong useState) để HTML server/client khớp nhau.
  useEffect(() => {
    if (canHideInAlbum) setHideInAlbum(localStorage.getItem("hc.hide-in-album") === "1");
  }, [canHideInAlbum]);

  const toggleHideInAlbum = () =>
    setHideInAlbum((v) => {
      localStorage.setItem("hc.hide-in-album", v ? "0" : "1");
      return !v;
    });

  const noAlbum = canHideInAlbum && hideInAlbum;
  const query = useInfiniteQuery({
    queryKey: ["assets", view, debouncedQ, kind, sort, albumId ?? "", noAlbum],
    queryFn: ({ pageParam }) =>
      fetchAssets({ view, q: debouncedQ, cursor: pageParam, kind, sort, albumId, noAlbum }),
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

  // Nhóm theo NGÀY tải lên — chỉ khi sắp xếp theo thời gian (Mới/Cũ nhất).
  // Sắp theo tên/dung lượng thì giữ lưới phẳng (nhóm ngày vô nghĩa).
  const groups = useMemo(() => {
    if (sort !== "new" && sort !== "old") return null;
    const out: { key: string; label: string; items: AssetDTO[] }[] = [];
    for (const a of items) {
      const key = dateGroupKey(a.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(a);
      else out.push({ key, label: dateGroupLabel(a.createdAt), items: [a] });
    }
    return out;
  }, [items, sort]);

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

  // Tự sửa ảnh "Lỗi": thấy asset FAILED → tự thử lại ĐÚNG 1 lần đời/ảnh (âm thầm,
  // không toast). Nếu vẫn lỗi (vd mất staging) thì giữ nút "Thử lại" tay. Nhớ id đã
  // thử qua localStorage nên ảnh hỏng vĩnh viễn không bị gọi lại mỗi lần mở app.
  useEffect(() => {
    if (view === "trash") return;
    const KEY = "hc.auto-retried";
    if (!autoRetriedRef.current) {
      try {
        autoRetriedRef.current = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
      } catch {
        autoRetriedRef.current = new Set();
      }
    }
    const tried = autoRetriedRef.current;
    let changed = false;
    for (const a of items) {
      if (a.status === "FAILED" && !tried.has(a.id)) {
        tried.add(a.id);
        changed = true;
        retryAssetApi(a.id)
          .then(() => queryClient.invalidateQueries({ queryKey: ["assets"] }))
          .catch(() => {});
      }
    }
    if (changed) {
      try {
        localStorage.setItem(KEY, JSON.stringify([...tried]));
      } catch {
        /* localStorage đầy/không dùng được — bỏ qua, vẫn chặn trong phiên */
      }
    }
  }, [items, view, queryClient]);

  // Sửa/xóa 1 ảnh trong MỌI cache ["assets"] tại chỗ (optimistic) — trả null để bỏ ảnh.
  const patchAssetInCache = (id: string, patch: (a: AssetDTO) => AssetDTO | null) => {
    queryClient.setQueriesData<InfiniteData<AssetListResponse>>(
      { queryKey: ["assets"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => {
            let removed = 0;
            const items = p.items.flatMap((a) => {
              if (a.id !== id) return [a];
              const r = patch(a);
              if (!r) {
                removed++;
                return [];
              }
              return [r];
            });
            return { ...p, items, total: Math.max(0, p.total - removed) };
          }),
        };
      },
    );
  };
  const snapshotAssets = () => queryClient.getQueriesData({ queryKey: ["assets"] });
  const rollbackAssets = (snap: [readonly unknown[], unknown][]) =>
    snap.forEach(([key, data]) => queryClient.setQueryData(key, data));

  // Bấm tim: đổi ngay trên màn hình (ở trang Yêu thích, bỏ tim = biến mất ngay).
  // Không refetch danh sách khi thành công → mượt, không nháy; lỗi thì hoàn lại.
  const favorite = useMutation({
    mutationFn: toggleFavoriteApi,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["assets"] });
      const snap = snapshotAssets();
      patchAssetInCache(id, (a) => {
        const nf = !a.isFavorite;
        if (view === "favorites" && !nf) return null;
        return { ...a, isFavorite: nf };
      });
      return { snap };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.snap) rollbackAssets(ctx.snap);
      toast.error(e.message);
    },
  });
  // Xóa: ảnh biến mất ngay khỏi lưới; lỗi thì hiện lại. onSettled đồng bộ đếm/thùng rác.
  const remove = useMutation({
    mutationFn: ({ id, hard }: { id: string; hard: boolean }) => deleteAssetApi(id, hard),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["assets"] });
      const snap = snapshotAssets();
      patchAssetInCache(id, () => null);
      return { snap };
    },
    onSuccess: (_d, v) => toast.success(v.hard ? "Đã xóa vĩnh viễn." : "Đã chuyển vào thùng rác."),
    onError: (e, _v, ctx) => {
      if (ctx?.snap) rollbackAssets(ctx.snap);
      toast.error(e.message);
    },
    onSettled: invalidate,
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
  // Thứ tự đánh số khi đổi tên hàng loạt = đúng thứ tự đang HIỂN THỊ (trên → dưới).
  const orderedSelectedIds = useMemo(
    () => items.filter((a) => selected.has(a.id)).map((a) => a.id),
    [items, selected],
  );
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

  // Chọn/bỏ chọn toàn bộ ảnh của một ngày (bật chế độ chọn nếu chưa).
  const selectDay = (dayItems: AssetDTO[]) => {
    setSelecting(true);
    setSelected((s) => {
      const n = new Set(s);
      const ids = dayItems.map((a) => a.id);
      const allSelected = ids.every((id) => n.has(id));
      for (const id of ids) {
        if (allSelected) n.delete(id);
        else n.add(id);
      }
      return n;
    });
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

  const renderCard = (a: AssetDTO) => (
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
  );

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
        <button
          onClick={() => setSearchOpen((o) => !o)}
          aria-label="Tìm kiếm"
          className={cn(
            "flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-border sm:hidden",
            searchOpen || q ? "border-accent/60 text-accent" : "hover:bg-surface-2",
          )}
        >
          <Search className="size-4" />
        </button>
        {actions}
      </Topbar>

      <main className="px-4 py-4 md:px-6">
        {/* thanh tìm kiếm mobile */}
        {searchOpen && !selecting && (
          <div className="hc-fade-up sticky top-14 z-20 -mx-4 mb-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo tên file..."
                autoFocus
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-sm outline-none placeholder:text-muted-2 focus:border-accent/60"
              />
              <button
                onClick={() => {
                  setQ("");
                  setSearchOpen(false);
                }}
                aria-label="Đóng tìm kiếm"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-2 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

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
              {view !== "trash" && (
                <BarBtn
                  onClick={() => setRenameOpen(true)}
                  disabled={!selected.size}
                  label="Đổi tên"
                >
                  <Pencil className="size-4" />
                </BarBtn>
              )}
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
              {canHideInAlbum && (
                <button
                  onClick={toggleHideInAlbum}
                  title="Chỉ hiện ảnh chưa nằm trong album nào"
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors",
                    hideInAlbum
                      ? "bg-accent text-background"
                      : "bg-surface-2 text-muted hover:text-foreground",
                  )}
                >
                  <FolderMinus className="size-3.5" />
                  Ẩn ảnh đã có album
                </button>
              )}
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
          <EmptyState
            view={view}
            inAlbum={!!albumId}
            hasQuery={!!debouncedQ}
            hiddenByAlbumFilter={noAlbum}
            onUpload={pickFiles}
          />
        ) : (
          <>
            {!selecting && (
              <p className="mb-4 text-xs text-muted-2">
                {total} mục{debouncedQ ? ` khớp “${debouncedQ}”` : ""}
              </p>
            )}
            {groups ? (
              <div className="space-y-5">
                {groups.map((g) => (
                  <section key={g.key}>
                    <DateHeader
                      label={g.label}
                      count={g.items.length}
                      allSelected={selecting && g.items.every((a) => selected.has(a.id))}
                      onSelectDay={() => selectDay(g.items)}
                    />
                    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5">
                      {g.items.map(renderCard)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5">
                {items.map(renderCard)}
              </div>
            )}
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
          prevSrc={items[lightboxIndex - 1]?.previewUrl}
          nextSrc={items[lightboxIndex + 1]?.previewUrl}
          onFavorite={() => favorite.mutate(lightboxAsset.id)}
          onDelete={() => openDelete(lightboxAsset)}
          onRename={(name) => rename.mutate({ id: lightboxAsset.id, name })}
          onEdit={() => setEditingId(lightboxAsset.id)}
          onManageAlbums={
            view === "trash" ? undefined : () => setAlbumManageId(lightboxAsset.id)
          }
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
            invalidate(); // toggle "ẩn ảnh đã có album" bật → ảnh vừa thêm biến khỏi thư viện ngay
          }}
        />
      )}

      {albumManageId && (
        <AlbumPicker
          assetIds={[albumManageId]}
          manage
          onClose={() => setAlbumManageId(null)}
          onDone={() => setAlbumManageId(null)}
        />
      )}

      {renameOpen && (
        <BulkRenameModal
          assetIds={orderedSelectedIds}
          onClose={() => setRenameOpen(false)}
          onDone={() => {
            setRenameOpen(false);
            exitSelect();
          }}
        />
      )}
    </>
  );
}

function DateHeader({
  label,
  count,
  allSelected,
  onSelectDay,
}: {
  label: string;
  count: number;
  allSelected: boolean;
  onSelectDay: () => void;
}) {
  return (
    <div className="sticky top-14 z-10 -mx-4 mb-3 flex items-center gap-2.5 bg-background/85 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
      <h3 className="text-sm font-semibold">{label}</h3>
      <span className="text-xs text-muted-2">{count} mục</span>
      <button
        onClick={onSelectDay}
        className={cn(
          "ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] transition-colors",
          allSelected
            ? "bg-accent text-background"
            : "text-muted hover:bg-surface-2 hover:text-foreground",
        )}
      >
        <CheckCircle2 className="size-3.5" />
        {allSelected ? "Bỏ chọn ngày" : "Chọn cả ngày"}
      </button>
    </div>
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
  hiddenByAlbumFilter,
  onUpload,
}: {
  view: ViewKind;
  inAlbum: boolean;
  hasQuery: boolean;
  hiddenByAlbumFilter?: boolean;
  onUpload: () => void;
}) {
  const copy = hasQuery
    ? { title: "Không tìm thấy kết quả", desc: "Thử từ khóa khác hoặc đổi bộ lọc." }
    : hiddenByAlbumFilter
      ? {
          title: "Mọi ảnh đều đã vào album",
          desc: "Đang bật 'Ẩn ảnh đã có album'. Tắt bộ lọc này để xem lại toàn bộ thư viện.",
        }
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
      {view === "all" && !inAlbum && !hasQuery && !hiddenByAlbumFilter && (
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
