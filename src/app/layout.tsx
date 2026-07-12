import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HuaCloud — Quản lý hình ảnh thông minh",
    template: "%s · HuaCloud",
  },
  description:
    "HuaCloud — nền tảng quản lý hình ảnh và tài nguyên số tích hợp AI của Hua Hưng. Upload, tổ chức, tìm kiếm và chia sẻ ảnh với dung lượng không giới hạn.",
  applicationName: "HuaCloud",
  openGraph: {
    title: "HuaCloud",
    description: "Nền tảng quản lý hình ảnh và tài nguyên số tích hợp AI.",
    siteName: "HuaCloud",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
