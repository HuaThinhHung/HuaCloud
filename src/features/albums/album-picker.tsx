"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Folder, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  addToAlbumApi,
  createAlbumApi,
  fetchAlbums,
  fetchAssetAlbums,
  removeFromAlbumApi,
} from "@/features/gallery/api";
import { cn } from "@/lib/utils";

/**
 * Modal album cho ảnh đã chọn. Hai chế độ:
 *  - mặc định: thêm các ảnh vào 1 album rồi đóng (dùng cho chọn nhiều).
 *  - manage (1 ảnh): hiện ảnh đang thuộc album nào, bấm để thêm/bỏ ngay (2 chiều).
 */
export function AlbumPicker({
  assetIds,
  onClose,
  onDone,
  manage = false,
}: {
  assetIds: string[];
  onClose: () => void;
  onDone: () => void;
  manage?: boolean;
}) {
  const qc = useQueryClient();
  const { data: albums, isLoading } = useQuery({ queryKey: ["albums"], queryFn: fetchAlbums });
  const membership = useQuery({
    queryKey: ["asset-albums", assetIds[0]],
    queryFn: () => fetchAssetAlbums(assetIds[0]),
    enabled: manage && assetIds.length === 1,
  });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // override membership tại chỗ để toggle mượt (optimistic), fallback về dữ liệu server.
  const [override, setOverride] = useState<Set<string> | null>(null);
  const members = override ?? new Set(membership.data ?? []);

  const manual = (albums ?? []).filter((a) => !a.isSmart);

  const finish = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["albums"] });
    onDone();
  };

  // --- chế độ thêm hàng loạt ---
  const addTo = async (albumId: string) => {
    setBusy(albumId);
    try {
      const r = await addToAlbumApi(albumId, assetIds);
      finish(`Đã thêm ${r.added} ảnh vào album.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
      setBusy(null);
    }
  };

  // --- chế độ quản lý: bấm để thêm/bỏ 1 album ---
  const toggle = async (albumId: string) => {
    const isMember = members.has(albumId);
    const next = new Set(members);
    if (isMember) next.delete(albumId);
    else next.add(albumId);
    setOverride(next);
    setBusy(albumId);
    try {
      if (isMember) await removeFromAlbumApi(albumId, assetIds);
      else await addToAlbumApi(albumId, assetIds);
      qc.invalidateQueries({ queryKey: ["albums"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    } catch (e) {
      setOverride(new Set(members)); // rollback
      toast.error(e instanceof Error ? e.message : "Thất bại");
    } finally {
      setBusy(null);
    }
  };

  const createAndAdd = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy("__new__");
    try {
      const { album } = await createAlbumApi({ name: n });
      await addToAlbumApi(album.id, assetIds);
      if (manage) {
        setOverride(new Set([...members, album.id]));
        setName("");
        setCreating(false);
        setBusy(null);
        qc.invalidateQueries({ queryKey: ["albums"] });
        qc.invalidateQueries({ queryKey: ["assets"] });
        toast.success(`Đã tạo "${n}" và thêm ảnh.`);
      } else {
        finish(`Đã tạo "${n}" và thêm ${assetIds.length} ảnh.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
      setBusy(null);
    }
  };

  const title = manage ? "Album chứa ảnh này" : `Thêm ${assetIds.length} ảnh vào album`;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="hc-scale-in max-h-[80dvh] w-full max-w-sm overflow-hidden rounded-t-2xl border border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {/* tạo album mới */}
          {creating ? (
            <div className="flex items-center gap-2 p-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                placeholder="Tên album mới"
                autoFocus
                className="h-9 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent/60"
              />
              <button
                onClick={createAndAdd}
                disabled={!name.trim() || busy === "__new__"}
                className="flex size-9 items-center justify-center rounded-lg bg-accent text-background disabled:opacity-40"
                aria-label="Tạo"
              >
                {busy === "__new__" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-accent hover:bg-surface-2"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2">
                <Plus className="size-4" />
              </span>
              Tạo album mới
            </button>
          )}

          {/* danh sách album */}
          {isLoading || (manage && membership.isLoading) ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-2" />
            </div>
          ) : manual.length === 0 && !creating ? (
            <p className="px-3 py-4 text-center text-[13px] text-muted">
              Chưa có album — tạo album đầu tiên ở trên.
            </p>
          ) : (
            manual.map((a) => {
              const isMember = manage && members.has(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => (manage ? toggle(a.id) : addTo(a.id))}
                  disabled={busy === a.id || (!manage && !!busy)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
                    {a.coverUrl ? (
                      <img src={a.coverUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Folder className="size-4 text-muted-2" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{a.name}</span>
                    <span className="text-[11px] text-muted-2">{a.count} mục</span>
                  </span>
                  {busy === a.id ? (
                    <Loader2 className="size-4 animate-spin text-muted-2" />
                  ) : manage ? (
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border transition-colors",
                        isMember
                          ? "border-accent bg-accent text-background"
                          : "border-border text-transparent",
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {manage && (
          <div className="border-t border-border p-2">
            <button
              onClick={onDone}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-surface-2 text-sm font-medium hover:bg-border/60"
            >
              Xong
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
