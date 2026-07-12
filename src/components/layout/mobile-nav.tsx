"use client";

import { Heart, Image as ImageIcon, LayoutDashboard, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/gallery", label: "Thư viện", icon: ImageIcon },
  { href: "/favorites", label: "Yêu thích", icon: Heart },
  { href: "/trash", label: "Thùng rác", icon: Trash2 },
  { href: "/settings", label: "Cài đặt", icon: Settings },
] as const;

/** Thanh điều hướng dưới cùng — chỉ hiện trên điện thoại (sidebar ẩn ở mobile). */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors active:bg-surface-2",
              active ? "text-foreground" : "text-muted-2",
            )}
          >
            <Icon className={cn("size-5", active && "text-accent")} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
