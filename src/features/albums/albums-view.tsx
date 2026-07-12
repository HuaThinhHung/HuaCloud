"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Folder, FolderPlus, Loader2, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { createAlbumApi, deleteAlbumApi, fetchAlbums } from "@/features/gallery/api";

export function AlbumsView() {
  const qc = useQueryClient();
  const { data: albums, isLoading } = useQuery({ queryKey: ["albums"], queryFn: fetchAlbums });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => createAlbumApi({ name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      setName("");
      setCreating(false);
      toast.success("Đã tạo album.");
    },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: deleteAlbumApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums"] });
      toast.success("Đã xóa album.");
    },
    onError: (e) => toast.error(e.message),
  });

  const list = albums ?? [];

  return (
    <>
      <Topbar title="Album">
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex h-8.5 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-surface-2"
        >
          <FolderPlus className="size-4" />
          Album mới
        </button>
      </Topbar>

      <main className="px-4 py-5 md:px-6">
        {creating && (
          <div className="hc-fade-up mb-4 flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) create.mutate();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Tên album (vd: Sản phẩm HUSSIO)"
              autoFocus
              className="h-10 max-w-sm flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent/60"
            />
            <button
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
              className="flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-background disabled:opacity-40"
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Tạo
            </button>
            <button
              onClick={() => setCreating(false)}
              className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
              aria-label="Hủy"
            >
              <X className="size-4.5" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="size-6 animate-spin text-muted-2" />
          </div>
        ) : list.length === 0 ? (
          <div className="hc-fade-up flex flex-col items-center justify-center py-28 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-surface">
              <Folder className="size-7 text-muted-2" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-[15px] font-medium">Chưa có album</h2>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
              Tạo album để gom ảnh theo chủ đề. Vào Thư viện → chọn ảnh → “Thêm vào album”.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-6 flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-[13px] font-medium text-background transition-all hover:bg-accent-strong"
            >
              <FolderPlus className="size-4" />
              Tạo album đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {list.map((a) => (
              <div key={a.id} className="group relative">
                <Link
                  href={`/albums/${a.id}`}
                  className="block overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-border-strong hover:shadow-md"
                >
                  <div className="relative aspect-square bg-surface-2">
                    {a.coverUrl ? (
                      <img src={a.coverUrl} alt={a.name} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Folder className="size-9 text-muted-2" strokeWidth={1.3} />
                      </div>
                    )}
                    {a.isSmart && (
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        <Sparkles className="size-3" />
                        Thông minh
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[13px] font-medium">{a.name}</p>
                    <p className="text-[11px] text-muted-2">{a.count} mục</p>
                  </div>
                </Link>
                {!a.isSmart && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Xóa album "${a.name}"? (Ảnh không bị xóa)`)) del.mutate(a.id);
                    }}
                    aria-label="Xóa album"
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 backdrop-blur transition-opacity hover:bg-danger/80 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
