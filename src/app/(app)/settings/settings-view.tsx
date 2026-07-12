"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";

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
      </main>
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
