"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Heart,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import type { AssetDTO } from "@/types/asset";

type Props = {
  asset: AssetDTO;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  hasPrev: boolean;
  hasNext: boolean;
};

export function Lightbox({ asset, onClose, onPrev, onNext, onFavorite, onDelete, hasPrev, hasNext }: Props) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
      else if (e.key.toLowerCase() === "f") onFavorite();
      else if (e.key === "Delete") onDelete();
    },
    [onClose, onPrev, onNext, onFavorite, onDelete, hasPrev, hasNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onKey]);

  const isImage = asset.kind === "IMAGE" && asset.status === "READY";

  return (
    <div
      className="hc-scale-in fixed inset-0 z-[95] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* header */}
      <div
        className="flex items-center justify-between gap-4 px-4 py-3 md:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{asset.fileName}</p>
          <p className="text-xs text-white/50">
            {formatBytes(asset.size)}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
            {` · ${formatDate(asset.createdAt)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconBtn label="Yêu thích (F)" onClick={onFavorite}>
            <Heart className={cn("size-4.5", asset.isFavorite && "fill-rose-400 text-rose-400")} />
          </IconBtn>
          <a
            href={`${asset.originalUrl}&download=1`}
            title="Tải bản gốc"
            aria-label="Tải bản gốc"
            className="flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="size-4.5" />
          </a>
          <IconBtn label="Xóa (Del)" onClick={onDelete}>
            <Trash2 className="size-4.5" />
          </IconBtn>
          <IconBtn label="Đóng (Esc)" onClick={onClose}>
            <X className="size-4.5" />
          </IconBtn>
        </div>
      </div>

      {/* nội dung */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6 md:px-16">
        {hasPrev && (
          <NavBtn side="left" onClick={onPrev}>
            <ChevronLeft className="size-6" />
          </NavBtn>
        )}

        {isImage ? (
          <img
            src={asset.previewUrl}
            alt={asset.fileName}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            style={
              asset.blurDataUrl
                ? {
                    backgroundImage: `url(${asset.blurDataUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
            onClick={(e) => e.stopPropagation()}
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

        {hasNext && (
          <NavBtn side="right" onClick={onNext}>
            <ChevronRight className="size-6" />
          </NavBtn>
        )}
      </div>
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
      className="flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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
        "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/8 text-white/80 backdrop-blur transition-colors hover:bg-white/15 hover:text-white",
        side === "left" ? "left-3 md:left-5" : "right-3 md:right-5",
      )}
    >
      {children}
    </button>
  );
}
