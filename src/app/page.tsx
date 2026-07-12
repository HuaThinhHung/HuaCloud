import { ArrowRight, Cloud, Search, Share2, Sparkles, UploadCloud } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-foreground">
            <Cloud className="size-4.5 text-background" strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">HuaCloud</span>
        </div>
        <Link
          href="/gallery"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-4 text-[13px] font-medium transition-colors hover:bg-surface-2"
        >
          Mở thư viện
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center md:pt-24">
        <p className="hc-fade-up mx-auto mb-5 w-fit rounded-full border border-border bg-surface-2 px-3.5 py-1 text-xs text-muted">
          Kho ảnh cá nhân · Lưu trên Telegram
        </p>
        <h1 className="hc-fade-up text-balance text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          Kho ảnh không giới hạn.
          <br />
          <span className="text-muted">Gọn gàng. Riêng tư.</span>
        </h1>
        <p className="hc-fade-up mx-auto mt-6 max-w-xl text-pretty text-[15px] leading-relaxed text-muted">
          Upload kéo-thả hoặc từ điện thoại, ảnh gốc lưu an toàn trên Telegram,
          thư viện mượt mà, quản lý thêm–xóa–sửa dễ dàng.
        </p>
        <div className="hc-fade-up mt-9 flex items-center justify-center gap-3">
          <Link
            href="/gallery"
            className="flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-medium text-background transition-colors hover:bg-accent-strong"
          >
            <UploadCloud className="size-4.5" />
            Bắt đầu tải ảnh lên
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-3">
        {[
          {
            icon: UploadCloud,
            title: "Upload tức thì",
            desc: "Kéo thả, dán Ctrl+V, chụp từ điện thoại — nhiều file cùng lúc.",
          },
          {
            icon: Search,
            title: "Tìm là thấy",
            desc: "Tìm nhanh theo tên file, không phân biệt hoa thường.",
          },
          {
            icon: Share2,
            title: "Riêng tư, an toàn",
            desc: "Có mật khẩu bảo vệ, ảnh gốc nằm trên kho Telegram riêng của bạn.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
          >
            <Icon className="size-5 text-foreground" strokeWidth={1.8} />
            <h3 className="mt-3 text-sm font-medium">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-2">
        <p className="flex items-center justify-center gap-1.5">
          <Sparkles className="size-3.5" />
          HuaCloud — sản phẩm của Hua Hưng · {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  );
}
