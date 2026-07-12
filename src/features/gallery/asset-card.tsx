"use client";

import {
  AlertTriangle,
  ArchiveRestore,
  Check,
  FileText,
  Film,
  Heart,
  Loader2,
  Music,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import type { AssetDTO } from "@/types/asset";

const KIND_ICON = { VIDEO: Film, AUDIO: Music, DOCUMENT: FileText } as const;

type Props = {
  asset: AssetDTO;
  inTrash?: boolean;
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpen: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  onRetry?: () => void;
};

export function AssetCard({
  asset,
  inTrash,
  selecting,
  selected,
  onToggleSelect,
  onOpen,
  onFavorite,
  onDelete,
  onRestore,
  onRetry,
}: Props) {
  const isImage = asset.kind === "IMAGE";
  const processing = asset.status === "PENDING" || asset.status === "PROCESSING";
  const failed = asset.status === "FAILED";
  const ratio =
    asset.width && asset.height ? `${asset.width} / ${asset.height}` : isImage ? "1 / 1" : "4 / 3";

  return (
    <figure
      className={cn(
        "group relative mb-3 break-inside-avoid overflow-hidden rounded-[10px] border bg-surface transition-all duration-200",
        selected
          ? "border-accent ring-2 ring-accent"
          : "border-border hover:border-border-strong hover:shadow-md",
      )}
      style={{ aspectRatio: ratio }}
    >
      <button
        onClick={selecting ? onToggleSelect : onOpen}
        className={cn("absolute inset-0 w-full", selecting ? "cursor-pointer" : "cursor-zoom-in")}
        aria-label={asset.fileName}
      >
        {isImage && !processing ? (
          <img
            src={asset.thumbUrl}
            alt={asset.fileName}
            loading="lazy"
            className="size-full object-cover"
            style={
              asset.blurDataUrl
                ? {
                    backgroundImage: `url(${asset.blurDataUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : { backgroundColor: asset.dominantColor ?? "#f4f4f5" }
            }
          />
        ) : (
          <NonImagePlaceholder asset={asset} processing={processing} failed={failed} />
        )}
      </button>

      {selecting && (
        <span
          className={cn(
            "pointer-events-none absolute left-2 top-2 z-10 flex size-6 items-center justify-center rounded-full border-2 shadow",
            selected ? "border-accent bg-accent text-background" : "border-white/90 bg-black/30",
          )}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}

      {/* gradient + tên file khi hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2.5 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <p className="truncate text-xs font-medium text-white">{asset.fileName}</p>
        <p className="text-[10.5px] text-white/70">{formatBytes(asset.size)}</p>
      </div>

      {/* trạng thái xử lý */}
      {processing && (
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10.5px] font-medium text-white backdrop-blur">
          <Loader2 className="size-3 animate-spin text-accent" />
          Đang xử lý
        </span>
      )}
      {failed && (
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-danger/20 px-2.5 py-1 text-[10.5px] font-medium text-danger backdrop-blur">
          <AlertTriangle className="size-3" />
          Lỗi
        </span>
      )}

      {/* actions */}
      <div
        className={cn(
          "absolute right-2 top-2 flex gap-1 transition-opacity duration-150",
          asset.isFavorite && !inTrash ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          selecting && "hidden",
        )}
      >
        {failed && onRetry && (
          <CardAction label="Thử lại" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
          </CardAction>
        )}
        {inTrash ? (
          <>
            {onRestore && (
              <CardAction label="Khôi phục" onClick={onRestore}>
                <ArchiveRestore className="size-3.5" />
              </CardAction>
            )}
            <CardAction label="Xóa vĩnh viễn" onClick={onDelete} danger>
              <Trash2 className="size-3.5" />
            </CardAction>
          </>
        ) : (
          <>
            <CardAction label="Yêu thích" onClick={onFavorite}>
              <Heart
                className={cn("size-3.5", asset.isFavorite && "fill-rose-400 text-rose-400")}
              />
            </CardAction>
            <CardAction label="Chuyển vào thùng rác" onClick={onDelete} danger>
              <Trash2 className="size-3.5" />
            </CardAction>
          </>
        )}
      </div>
    </figure>
  );
}

function CardAction({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur transition-colors",
        danger ? "hover:bg-danger/80" : "hover:bg-black/85",
      )}
    >
      {children}
    </button>
  );
}

function NonImagePlaceholder({
  asset,
  processing,
  failed,
}: {
  asset: AssetDTO;
  processing: boolean;
  failed: boolean;
}) {
  const Icon = KIND_ICON[asset.kind as keyof typeof KIND_ICON] ?? FileText;
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2.5 bg-surface-2/60 p-4">
      {processing ? (
        <Loader2 className="size-7 animate-spin text-accent" strokeWidth={1.5} />
      ) : (
        <Icon className={cn("size-8", failed ? "text-danger" : "text-muted-2")} strokeWidth={1.4} />
      )}
      <p className="max-w-full truncate text-center text-xs text-muted">{asset.fileName}</p>
      {failed && asset.errorMessage && (
        <p className="line-clamp-2 max-w-full text-center text-[10.5px] text-danger/80">
          {asset.errorMessage}
        </p>
      )}
    </div>
  );
}
