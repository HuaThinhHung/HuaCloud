"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FolderPlus,
  Heart,
  Pencil,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import type { AssetDTO } from "@/types/asset";

type Props = {
  asset: AssetDTO;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onEdit: () => void;
  onManageAlbums?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  /** URL preview ảnh trước/sau — tải sẵn để vuốt qua lại hiện ra ngay. */
  prevSrc?: string;
  nextSrc?: string;
};

const MAX_ZOOM = 5;
const SWIPE_NAV = 70; // px vuốt ngang để đổi ảnh
const SWIPE_CLOSE = 110; // px vuốt xuống để đóng

export function Lightbox({
  asset,
  onClose,
  onPrev,
  onNext,
  onFavorite,
  onDelete,
  onRename,
  onEdit,
  onManageAlbums,
  hasPrev,
  hasNext,
  prevSrc,
  nextSrc,
}: Props) {
  const isImage = asset.kind === "IMAGE" && asset.status === "READY";

  // Tải trước ảnh kề (trình duyệt cache) → bấm/vuốt next-prev hiện ra tức thì.
  useEffect(() => {
    for (const src of [prevSrc, nextSrc]) {
      if (src) {
        const img = new window.Image();
        img.src = src;
      }
    }
  }, [prevSrc, nextSrc]);

  // Trạng thái zoom/pan (transform áp lên ảnh)
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [animate, setAnimate] = useState(false); // bật transition khi snap
  const [dragOpacity, setDragOpacity] = useState(1); // mờ dần khi vuốt xuống

  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(asset.fileName);

  const g = useRef({
    mode: "none" as "none" | "pan" | "swipe" | "pinch",
    x0: 0,
    y0: 0,
    tx0: 0,
    ty0: 0,
    dist0: 0,
    zoom0: 1,
    lastTap: 0,
    axis: "" as "" | "x" | "y",
  });

  // Reset khi đổi ảnh
  useEffect(() => {
    setZoom(1);
    setTx(0);
    setTy(0);
    setDragOpacity(1);
    setRenaming(false);
    setNameInput(asset.fileName);
  }, [asset.id, asset.fileName]);

  const resetView = useCallback(() => {
    setAnimate(true);
    setZoom(1);
    setTx(0);
    setTy(0);
    setDragOpacity(1);
  }, []);

  // Bàn phím (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (renaming) return;
      // Đang gõ trong ô nhập (vd ô tên album ở modal mở trên lightbox) → bỏ qua phím tắt,
      // tránh 'f'/'Delete' vô tình yêu thích/xóa ảnh phía dưới.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
      else if (e.key.toLowerCase() === "f") onFavorite();
      else if (e.key === "Delete") onDelete();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext, onFavorite, onDelete, hasPrev, hasNext, renaming]);

  const dist = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isImage) return;
    setAnimate(false);
    const s = g.current;
    if (e.touches.length === 2) {
      s.mode = "pinch";
      s.dist0 = dist(e.touches);
      s.zoom0 = zoom;
      return;
    }
    const t = e.touches[0];
    s.x0 = t.clientX;
    s.y0 = t.clientY;
    s.tx0 = tx;
    s.ty0 = ty;
    s.axis = "";
    s.mode = zoom > 1 ? "pan" : "swipe";

    // double-tap để zoom
    const now = Date.now();
    if (now - s.lastTap < 280) {
      s.mode = "none";
      setAnimate(true);
      if (zoom > 1) {
        setZoom(1);
        setTx(0);
        setTy(0);
      } else {
        setZoom(2.5);
      }
      s.lastTap = 0;
    } else {
      s.lastTap = now;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isImage) return;
    const s = g.current;
    if (s.mode === "pinch" && e.touches.length === 2) {
      const ratio = dist(e.touches) / (s.dist0 || 1);
      setZoom(Math.min(Math.max(s.zoom0 * ratio, 1), MAX_ZOOM));
      return;
    }
    const t = e.touches[0];
    const dx = t.clientX - s.x0;
    const dy = t.clientY - s.y0;

    if (s.mode === "pan") {
      setTx(s.tx0 + dx);
      setTy(s.ty0 + dy);
      return;
    }
    if (s.mode === "swipe") {
      if (!s.axis) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (s.axis === "x") {
        setTx(dx);
      } else if (dy > 0) {
        // chỉ cho vuốt xuống để đóng
        setTy(dy);
        setDragOpacity(Math.max(1 - dy / 500, 0.4));
      }
    }
  };

  const onTouchEnd = () => {
    if (!isImage) return;
    const s = g.current;

    if (s.mode === "pinch") {
      if (zoom < 1.05) resetView();
      s.mode = "none";
      return;
    }
    if (s.mode === "pan") {
      s.mode = "none";
      return;
    }
    if (s.mode === "swipe") {
      setAnimate(true);
      if (s.axis === "x" && Math.abs(tx) > SWIPE_NAV) {
        if (tx > 0 && hasPrev) onPrev();
        else if (tx < 0 && hasNext) onNext();
        else setTx(0);
      } else if (s.axis === "y" && ty > SWIPE_CLOSE) {
        onClose();
      } else {
        setTx(0);
        setTy(0);
        setDragOpacity(1);
      }
      s.mode = "none";
      s.axis = "";
    }
  };

  const saveRename = () => {
    const next = nameInput.trim();
    if (next && next !== asset.fileName) onRename(next);
    setRenaming(false);
  };

  return (
    <div
      className="hc-scale-in fixed inset-0 z-[95] flex flex-col bg-black backdrop-blur-sm"
      style={{ backgroundColor: `rgba(0,0,0,${0.96 * dragOpacity})` }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* header */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-3 md:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                autoFocus
                className="h-9 w-full max-w-xs rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white outline-none focus:border-white/40"
              />
              <button
                onClick={saveRename}
                aria-label="Lưu tên"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
              >
                <Check className="size-4.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRenaming(true)}
              className="group/name flex max-w-full items-center gap-1.5 text-left"
              title="Đổi tên"
            >
              <span className="truncate text-sm font-medium text-white">{asset.fileName}</span>
              <Pencil className="size-3.5 shrink-0 text-white/40 transition-colors group-hover/name:text-white/80" />
            </button>
          )}
          {!renaming && (
            <p className="truncate text-xs text-white/50">
              {formatBytes(asset.size)}
              {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
              {` · ${formatDate(asset.createdAt)}`}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onManageAlbums && (
            <IconBtn label="Thêm vào album" onClick={onManageAlbums}>
              <FolderPlus className="size-5" />
            </IconBtn>
          )}
          {isImage && (
            <IconBtn label="Chỉnh sửa (crop/xoay)" onClick={onEdit}>
              <SlidersHorizontal className="size-5" />
            </IconBtn>
          )}
          <IconBtn label="Yêu thích (F)" onClick={onFavorite}>
            <Heart className={cn("size-5", asset.isFavorite && "fill-rose-400 text-rose-400")} />
          </IconBtn>
          <a
            href={`${asset.originalUrl}&download=1`}
            title="Tải bản gốc"
            aria-label="Tải bản gốc"
            className="flex size-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="size-5" />
          </a>
          <IconBtn label="Xóa (Del)" onClick={onDelete}>
            <Trash2 className="size-5" />
          </IconBtn>
          <IconBtn label="Đóng (Esc)" onClick={onClose}>
            <X className="size-5" />
          </IconBtn>
        </div>
      </div>

      {/* nội dung */}
      <div
        className="relative flex flex-1 select-none items-center justify-center overflow-hidden px-2 pb-4 md:px-16"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {hasPrev && zoom === 1 && (
          <NavBtn side="left" onClick={onPrev}>
            <ChevronLeft className="size-6" />
          </NavBtn>
        )}

        {isImage ? (
          <img
            src={asset.previewUrl}
            alt={asset.fileName}
            draggable={false}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
              transition: animate ? "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)" : "none",
              cursor: zoom > 1 ? "grab" : "default",
              ...(asset.blurDataUrl
                ? {
                    backgroundImage: `url(${asset.blurDataUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}),
            }}
            onClick={(e) => e.stopPropagation()}
            onTransitionEnd={() => setAnimate(false)}
          />
        ) : (
          <div
            className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-14 py-12"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="size-12 text-white/40" strokeWidth={1.2} />
            <p className="max-w-xs truncate text-sm text-white/80">{asset.fileName}</p>
            <a
              href={`${asset.originalUrl}&download=1`}
              className="flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-medium text-background hover:bg-accent-strong"
            >
              <Download className="size-4" />
              Tải xuống
            </a>
          </div>
        )}

        {hasNext && zoom === 1 && (
          <NavBtn side="right" onClick={onNext}>
            <ChevronRight className="size-6" />
          </NavBtn>
        )}
      </div>

      {/* gợi ý thao tác (mobile) */}
      {isImage && (
        <p className="pointer-events-none pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-[11px] text-white/30 md:hidden">
          Vuốt ngang đổi ảnh · vuốt xuống để đóng · chạm 2 lần để phóng to
        </p>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20"
    >
      {children}
    </button>
  );
}

function NavBtn({
  children,
  side,
  onClick,
}: {
  children: React.ReactNode;
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      aria-label={side === "left" ? "Ảnh trước" : "Ảnh sau"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white md:flex",
        side === "left" ? "left-3 md:left-5" : "right-3 md:right-5",
      )}
    >
      {children}
    </button>
  );
}
