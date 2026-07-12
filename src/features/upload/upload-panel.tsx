"use client";

import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn, formatBytes } from "@/lib/utils";
import type { UploadItem } from "./upload-provider";

/** Panel nổi góc phải-dưới hiển thị tiến trình upload. */
export function UploadPanel({ items, onClear }: { items: UploadItem[]; onClear: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const { active, doneCount } = useMemo(() => {
    const activeItems = items.filter((i) => i.status === "queued" || i.status === "uploading");
    return {
      active: activeItems.length,
      doneCount: items.filter((i) => i.status === "done" || i.status === "duplicate").length,
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="hc-fade-up fixed bottom-20 right-4 z-[80] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border-strong bg-surface shadow-xl shadow-black/10 md:bottom-4">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-sm font-medium">
          {active > 0 ? (
            <>
              Đang tải lên {active} file
              <Loader2 className="ml-2 inline size-3.5 animate-spin text-accent" />
            </>
          ) : (
            `Đã xong ${doneCount}/${items.length} file`
          )}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label={collapsed ? "Mở rộng" : "Thu gọn"}
          >
            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {active === 0 && (
            <button
              onClick={onClear}
              className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <ul className="max-h-64 overflow-y-auto px-2 py-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <StatusIcon status={it.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{it.fileName}</p>
                {it.status === "error" ? (
                  <p className="truncate text-xs text-danger">{it.error}</p>
                ) : it.status === "duplicate" ? (
                  <p className="text-xs text-muted">Trùng — đã có trong thư viện</p>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-200",
                          it.status === "done" ? "bg-success" : "bg-accent",
                        )}
                        style={{ width: `${it.progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-2">
                      {formatBytes(it.size)}
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadItem["status"] }) {
  if (status === "done") return <CheckCircle2 className="size-4 shrink-0 text-success" />;
  if (status === "duplicate") return <Copy className="size-4 shrink-0 text-muted" />;
  if (status === "error") return <AlertCircle className="size-4 shrink-0 text-danger" />;
  return <Loader2 className="size-4 shrink-0 animate-spin text-accent" />;
}
