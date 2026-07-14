"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Loader2, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteAlbumApi, fetchAlbum, updateAlbumApi } from "@/features/gallery/api";
import { GalleryView } from "@/features/gallery/gallery-view";
import { AlbumAssetAdder } from "./album-asset-adder";

export function AlbumDetailView({ id }: { id: string }) {
  const { data: album } = useQuery({ queryKey: ["album", id], queryFn: () => fetchAlbum(id) });
  const [adding, setAdding] = useState(false);
  const editable = album && !album.isSmart;

  return (
    <>
      <GalleryView
        view="all"
        albumId={id}
        title={album?.name ?? "Album"}
        actions={
          editable ? (
            <>
              <button
                onClick={() => setAdding(true)}
                className="flex h-8.5 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-background hover:bg-accent-strong"
              >
                <ImagePlus className="size-4" />
                <span className="hidden sm:inline">Thêm ảnh</span>
              </button>
              <AlbumMenu id={id} name={album.name} />
            </>
          ) : undefined
        }
      />
      {adding && (
        <AlbumAssetAdder albumId={id} onClose={() => setAdding(false)} onDone={() => setAdding(false)} />
      )}
    </>
  );
}

/** Menu ⋮ trên trang chi tiết album: đổi tên + xóa (hoạt động cả mobile). */
function AlbumMenu({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const rename = useMutation({
    mutationFn: () => updateAlbumApi(id, { name: value.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["album", id] });
      qc.invalidateQueries({ queryKey: ["albums"] });
      setRenaming(false);
      toast.success("Đã đổi tên album.");
    },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => deleteAlbumApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Đã xóa album. (Ảnh không bị xóa)");
      router.replace("/albums");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Tùy chọn album"
          className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-border hover:bg-surface-2"
        >
          {del.isPending ? (
            <Loader2 className="size-4 animate-spin text-muted-2" />
          ) : (
            <MoreVertical className="size-4" />
          )}
        </button>
        {open && (
          <div className="hc-scale-in absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
            <button
              onClick={() => {
                setOpen(false);
                setValue(name);
                setRenaming(true);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-surface-2"
            >
              <Pencil className="size-4 text-muted" />
              Đổi tên album
            </button>
            <button
              onClick={() => {
                setOpen(false);
                if (window.confirm(`Xóa album "${name}"? (Ảnh không bị xóa)`)) del.mutate();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] text-danger hover:bg-danger/10"
            >
              <Trash2 className="size-4" />
              Xóa album
            </button>
          </div>
        )}
      </div>

      {renaming && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => setRenaming(false)}
        >
          <div
            className="hc-scale-in w-full max-w-sm rounded-t-2xl border border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold">Đổi tên album</h3>
            <div className="flex items-center gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && value.trim()) rename.mutate();
                  if (e.key === "Escape") setRenaming(false);
                }}
                autoFocus
                placeholder="Tên album"
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent/60"
              />
              <button
                onClick={() => rename.mutate()}
                disabled={!value.trim() || rename.isPending}
                aria-label="Lưu"
                className="flex size-10 items-center justify-center rounded-lg bg-accent text-background disabled:opacity-40"
              >
                {rename.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
              </button>
              <button
                onClick={() => setRenaming(false)}
                aria-label="Hủy"
                className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
              >
                <X className="size-4.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
