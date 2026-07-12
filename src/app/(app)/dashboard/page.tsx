import { HardDrive, Heart, Images, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDefaultCtx } from "@/server/context";
import { listAssets, workspaceStats } from "@/server/services/asset.service";
import { formatBytes } from "@/lib/utils";
import { DashboardTopbar } from "./topbar";

export const metadata: Metadata = { title: "Tổng quan" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getDefaultCtx();
  const [stats, recent] = await Promise.all([
    workspaceStats(ctx),
    listAssets(ctx, { take: 12 }),
  ]);

  const cards = [
    { label: "Tổng số ảnh", value: String(stats.count), icon: Images },
    { label: "Dung lượng", value: formatBytes(stats.totalBytes), icon: HardDrive },
    { label: "Yêu thích", value: String(stats.favorites), icon: Heart },
    { label: "Thùng rác", value: String(stats.trash), icon: Trash2 },
  ];

  return (
    <>
      <DashboardTopbar />
      <main className="px-4 py-6 md:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">{label}</p>
                <Icon className="size-4 text-muted-2" strokeWidth={1.8} />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Ảnh gần đây</h2>
            <Link href="/gallery" className="text-xs text-accent hover:underline">
              Xem tất cả →
            </Link>
          </div>
          {recent.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
              <p className="text-[13px] text-muted">
                Chưa có ảnh nào — mở <Link href="/gallery" className="text-accent hover:underline">Thư viện</Link> và
                kéo thả ảnh đầu tiên vào.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {recent.items.map((a) => (
                <Link
                  key={a.id}
                  href="/gallery"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2"
                >
                  {a.kind === "IMAGE" && a.status === "READY" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbUrl}
                      alt={a.fileName}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center p-2">
                      <p className="truncate text-[11px] text-muted-2">{a.fileName}</p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
