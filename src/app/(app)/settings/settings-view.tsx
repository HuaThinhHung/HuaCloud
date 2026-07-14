"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { purgeAllAssetsApi } from "@/features/gallery/api";
import { cn } from "@/lib/utils";

const PURGE_CONFIRM = "XÓA TẤT CẢ";

type Health = {
  db: { ok: boolean; error?: string };
  telegram: { ok: boolean; botUsername?: string; chatTitle?: string; error?: string };
  ai: { configured: boolean };
  queue: { pending: number };
};

async function fetchHealth(): Promise<Health> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw new Error("Không đọc được trạng thái hệ thống");
  return res.json();
}

export function SettingsView() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  return (
    <>
      <Topbar title="Cài đặt">
        <button
          onClick={() => refetch()}
          className="flex h-8.5 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Kiểm tra lại
        </button>
      </Topbar>

      <main className="mx-auto max-w-2xl px-4 py-6 md:px-6">
        <h2 className="mb-3 text-sm font-medium">Chẩn đoán hệ thống</h2>

        {isLoading || !data ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-5 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Đang kiểm tra...
          </div>
        ) : (
          <div className="space-y-3">
            <HealthCard
              icon={Database}
              title="Database"
              ok={data.db.ok}
              detail={data.db.ok ? "SQLite local — hoạt động bình thường" : data.db.error}
            />
            <HealthCard
              icon={Bot}
              title="Telegram Storage"
              ok={data.telegram.ok}
              detail={
                data.telegram.ok
                  ? `Bot @${data.telegram.botUsername} → kho “${data.telegram.chatTitle}”`
                  : data.telegram.error
              }
              hint={
                !data.telegram.ok
                  ? "Chạy `npm run telegram:setup` trong terminal để hoàn tất kết nối."
                  : undefined
              }
            />
            <HealthCard
              icon={Sparkles}
              title="AI enrichment"
              ok={data.ai.configured}
              okLabel="Đã cấu hình"
              failLabel="Chưa bật"
              detail={
                data.ai.configured
                  ? "GEMINI_API_KEY đã cấu hình"
                  : "Thêm GEMINI_API_KEY vào .env.local để bật caption/tags AI (tùy chọn — app vẫn đầy đủ chức năng)"
              }
              neutral={!data.ai.configured}
            />
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-muted">
              Hàng đợi xử lý: <span className="font-medium text-foreground">{data.queue.pending}</span> job đang chờ
            </div>
          </div>
        )}

        <h2 className="mb-3 mt-8 text-sm font-medium">Về HuaCloud</h2>
        <div className="rounded-xl border border-border bg-surface p-4 text-[13px] leading-relaxed text-muted">
          <p>
            HuaCloud v0.1 — nền tảng quản lý hình ảnh của <span className="text-foreground">Hua Hưng</span>.
            Ảnh gốc được lưu an toàn trên kho lưu trữ riêng; thumbnail phục vụ từ đĩa local để thư viện luôn nhanh.
          </p>
          <p className="mt-2">
            Lộ trình: albums · chia sẻ có mật khẩu · tìm kiếm AI tiếng Việt · API key. Xem <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">docs/04_DEVELOPMENT_ROADMAP.md</code>.
          </p>
        </div>

        <DangerZone />
      </main>
    </>
  );
}

/** Vùng nguy hiểm — xóa VĨNH VIỄN toàn bộ ảnh (gõ đúng chuỗi xác nhận). */
function DangerZone() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  const close = () => {
    if (running) return;
    setOpen(false);
    setText("");
    setDone(0);
  };

  const run = async () => {
    setRunning(true);
    let total = 0;
    try {
      // Xóa theo từng lô tới khi hết — tránh timeout với thư viện lớn.
      for (;;) {
        const r = await purgeAllAssetsApi(PURGE_CONFIRM);
        total += r.purged;
        setDone(total);
        if (r.remaining === 0) break;
        if (r.purged === 0) throw new Error("Còn ảnh không xóa được — thử lại sau ít phút.");
      }
      toast.success(`Đã xóa vĩnh viễn ${total} mục.`);
      qc.invalidateQueries();
      setOpen(false);
      setText("");
      setDone(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa thất bại");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <h2 className="mb-3 mt-8 text-sm font-medium text-danger">Vùng nguy hiểm</h2>
      <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] leading-relaxed">
          <p className="font-medium text-foreground">Xóa toàn bộ ảnh</p>
          <p className="mt-0.5 text-muted">
            Xóa vĩnh viễn mọi ảnh/video (kể cả trong Thùng rác) khỏi database và file gốc trên
            Telegram. <span className="font-medium text-danger">Không thể hoàn tác.</span>
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-danger px-4 text-[13px] font-medium text-white hover:bg-danger/90"
        >
          <Trash2 className="size-4" />
          Xóa toàn bộ
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            className="hc-scale-in w-full max-w-sm rounded-t-2xl border border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertTriangle className="size-5" />
              </span>
              <h3 className="text-sm font-semibold">Xóa vĩnh viễn toàn bộ ảnh?</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              Thao tác này xóa sạch mọi ảnh/video và không thể khôi phục. Gõ{" "}
              <span className="font-mono font-semibold text-danger">{PURGE_CONFIRM}</span> để xác
              nhận.
            </p>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim() === PURGE_CONFIRM && !running) run();
                if (e.key === "Escape") close();
              }}
              placeholder={PURGE_CONFIRM}
              autoFocus
              disabled={running}
              className="mt-3 h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-danger/60 disabled:opacity-60"
            />
            {running && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
                <Loader2 className="size-3.5 animate-spin" />
                Đang xóa... đã xóa {done} mục
              </p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={close}
                disabled={running}
                className="flex h-9 items-center rounded-lg px-4 text-[13px] font-medium text-muted hover:bg-surface-2 disabled:opacity-40"
              >
                Hủy
              </button>
              <button
                onClick={run}
                disabled={text.trim() !== PURGE_CONFIRM || running}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-danger px-4 text-[13px] font-medium text-white hover:bg-danger/90 disabled:opacity-40"
              >
                {running ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HealthCard({
  icon: Icon,
  title,
  ok,
  detail,
  hint,
  okLabel = "Hoạt động",
  failLabel = "Lỗi",
  neutral,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  ok: boolean;
  detail?: string;
  hint?: string;
  okLabel?: string;
  failLabel?: string;
  neutral?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon className="size-4.5 text-muted" strokeWidth={1.8} />
          <p className="text-sm font-medium">{title}</p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            ok
              ? "bg-success/10 text-success"
              : neutral
                ? "bg-surface-2 text-muted"
                : "bg-danger/10 text-danger",
          )}
        >
          {ok ? <CheckCircle2 className="size-3" /> : neutral ? null : <XCircle className="size-3" />}
          {ok ? okLabel : failLabel}
        </span>
      </div>
      {detail && <p className="mt-2 text-[13px] leading-relaxed text-muted">{detail}</p>}
      {hint && (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-warning">{hint}</p>
      )}
    </div>
  );
}
