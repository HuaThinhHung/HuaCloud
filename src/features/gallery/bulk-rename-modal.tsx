"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { bulkRenameAssetsApi } from "./api";

/**
 * Đổi tên hàng loạt theo mẫu `{tên}-{số}`. `assetIds` truyền vào theo ĐÚNG thứ tự
 * hiển thị (ảnh trên đầu = 1). Tùy chọn: số bắt đầu, thêm số 0, đảo thứ tự đánh số.
 * Đuôi file gốc (.jpg/.png…) luôn được giữ nguyên ở server.
 */
export function BulkRenameModal({
  assetIds,
  onClose,
  onDone,
}: {
  assetIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [base, setBase] = useState("");
  const [start, setStart] = useState(1);
  const [pad, setPad] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [busy, setBusy] = useState(false);

  const count = assetIds.length;
  const last = start + count - 1;
  const padWidth = pad ? String(Math.max(last, 0)).length : 0;
  const fmt = (n: number) => (padWidth ? String(n).padStart(padWidth, "0") : String(n));
  const sample = base.trim() || "tên";
  const preview =
    count <= 2
      ? Array.from({ length: count }, (_, i) => `${sample}-${fmt(start + i)}`).join(" , ")
      : `${sample}-${fmt(start)} , ${sample}-${fmt(start + 1)} … ${sample}-${fmt(last)}`;

  const apply = async () => {
    const b = base.trim();
    if (!b || busy) return;
    setBusy(true);
    try {
      const ids = reverse ? [...assetIds].reverse() : assetIds;
      const r = await bulkRenameAssetsApi(ids, { baseName: b, start, pad: padWidth });
      toast.success(`Đã đổi tên ${r.renamed} ảnh.`);
      qc.invalidateQueries({ queryKey: ["assets"] });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Đổi tên thất bại");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="hc-scale-in w-full max-w-md rounded-t-2xl border border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Đổi tên {count} ảnh</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3.5 p-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Tên gốc</span>
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              placeholder="vd: cycle7"
              autoFocus
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent/60"
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium">Bắt đầu từ số</span>
            <input
              type="number"
              min={0}
              value={start}
              onChange={(e) => setStart(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
              className="h-9 w-24 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent/60"
            />
          </label>

          <ToggleRow
            active={pad}
            onClick={() => setPad((v) => !v)}
            title="Thêm số 0 đứng đầu"
            desc="cycle7-01, cycle7-02 … (dễ sắp xếp đúng)"
          />
          <ToggleRow
            active={reverse}
            onClick={() => setReverse((v) => !v)}
            title="Đảo thứ tự đánh số"
            desc="Ảnh dưới đáy (cũ nhất) sẽ là số 1"
            icon={<ArrowUpDown className="size-4" />}
          />

          <div className="rounded-lg border border-border bg-surface-2/60 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-2">Xem trước</p>
            <p className="mt-1 break-all text-[13px] text-foreground">{preview}</p>
            <p className="mt-1 text-[11px] text-muted-2">Giữ nguyên đuôi file gốc (.jpg, .png…).</p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border p-3">
          <button
            onClick={onClose}
            className="h-10 flex-1 rounded-lg bg-surface-2 text-sm font-medium hover:bg-border/60"
          >
            Hủy
          </button>
          <button
            onClick={apply}
            disabled={!base.trim() || busy}
            className="flex h-10 flex-[1.4] items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-background disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Đổi tên {count} ảnh
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  active,
  onClick,
  title,
  desc,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-surface-2"
    >
      {icon && <span className="text-muted-2">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-[11px] text-muted-2">{desc}</span>
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          active ? "bg-accent" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
            active ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
