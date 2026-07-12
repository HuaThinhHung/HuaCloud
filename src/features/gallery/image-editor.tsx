"use client";

import "react-easy-crop/react-easy-crop.css";
import { Check, Loader2, RotateCcw, RotateCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { useUpload } from "@/features/upload/upload-provider";
import { cn } from "@/lib/utils";
import type { AssetDTO } from "@/types/asset";

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: "Tự do", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
];

/**
 * Editor cắt (crop) + xoay ảnh. Tải ảnh GỐC same-origin (stream từ Telegram) → blob URL
 * để canvas không bị taint → xuất được. Kết quả lưu thành ẢNH MỚI qua luồng upload sẵn có
 * (→ Telegram + derivatives), không đụng ảnh gốc.
 */
export function ImageEditor({ asset, onClose }: { asset: AssetDTO; onClose: () => void }) {
  const { addFiles } = useUpload();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tải ảnh gốc → blob URL (an toàn cho canvas)
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(asset.originalUrl, { cache: "no-store" });
        if (!res.ok) throw new Error("fetch fail");
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        if (alive) {
          setImageSrc(url);
          setLoading(false);
        }
      } catch {
        toast.error("Không tải được ảnh gốc để chỉnh sửa");
        onClose();
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.originalUrl, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, saving]);

  const onCropComplete = useCallback((_: Area, px: Area) => setPixels(px), []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(undefined);
  };

  const save = async () => {
    if (!imageSrc || !pixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, pixels, rotation);
      const base = asset.fileName.replace(/\.[^.]+$/, "");
      const file = new File([blob], `${base}-edited.jpg`, { type: "image/jpeg" });
      addFiles([file]);
      toast.success("Đã lưu thành ảnh mới — đang tải lên…");
      onClose();
    } catch {
      toast.error("Lưu ảnh thất bại, thử lại");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-3 md:px-6">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          <X className="size-4.5" />
          Hủy
        </button>
        <span className="text-sm font-medium text-white">Chỉnh sửa ảnh</span>
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-40"
        >
          {saving ? <Loader2 className="size-4.5 animate-spin" /> : <Check className="size-4.5" />}
          Lưu
        </button>
      </div>

      {/* vùng crop */}
      <div className="relative flex-1">
        {loading || !imageSrc ? (
          <div className="flex size-full items-center justify-center">
            <Loader2 className="size-7 animate-spin text-white/50" />
          </div>
        ) : (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            showGrid
            objectFit="contain"
          />
        )}
      </div>

      {/* controls */}
      <div className="space-y-3 border-t border-white/10 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        {/* xoay */}
        <div className="flex items-center justify-center gap-2">
          <CtrlBtn label="Xoay trái" onClick={() => setRotation((r) => (r - 90) % 360)}>
            <RotateCcw className="size-4.5" />
          </CtrlBtn>
          <CtrlBtn label="Xoay phải" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw className="size-4.5" />
          </CtrlBtn>
          <button
            onClick={reset}
            className="ml-2 h-9 rounded-lg px-3 text-[13px] text-white/70 hover:bg-white/10 hover:text-white"
          >
            Đặt lại
          </button>
        </div>

        {/* tỉ lệ */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              onClick={() => setAspect(a.value)}
              className={cn(
                "h-8 rounded-lg px-3 text-[13px] transition-colors",
                aspect === a.value
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/80 hover:bg-white/20",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* zoom */}
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="text-[11px] text-white/50">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-white"
            aria-label="Phóng to"
          />
        </div>
      </div>
    </div>
  );
}

function CtrlBtn({
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
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
    >
      {children}
    </button>
  );
}

/** Vẽ ảnh (đã xoay) lên canvas rồi cắt vùng crop → blob JPEG. */
async function getCroppedBlob(src: string, crop: Area, rotation: number): Promise<Blob> {
  const image = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const { width: bw, height: bh } = rotatedSize(image.width, image.height, rad);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d ctx");
  canvas.width = bw;
  canvas.height = bh;
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate(rad);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  const out = document.createElement("canvas");
  const octx = out.getContext("2d");
  if (!octx) throw new Error("no 2d ctx");
  out.width = Math.round(crop.width);
  out.height = Math.round(crop.height);
  octx.drawImage(
    canvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  return new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), "image/jpeg", 0.92),
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function rotatedSize(w: number, h: number, rad: number) {
  return {
    width: Math.abs(Math.cos(rad) * w) + Math.abs(Math.sin(rad) * h),
    height: Math.abs(Math.sin(rad) * w) + Math.abs(Math.cos(rad) * h),
  };
}
