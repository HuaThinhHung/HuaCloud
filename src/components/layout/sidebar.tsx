"use client";

import { Cloud, Heart, Image as ImageIcon, LayoutDashboard, Settings, Trash2 } from "lucide-react";
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col border-r border-border bg-surface/60 backdrop-blur md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 pb-2 pt-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-foreground">
          <Cloud className="size-4.5 text-background" strokeWidth={2.5} />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">HuaCloud</span>
      </Link>

      <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
                active
                  ? "bg-surface-2 font-medium text-foreground"
                  : "text-muted hover:bg-surface-2/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active && "text-accent")} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] text-muted-2">
        HuaCloud v0.1 · Hua Hưng
      </div>
    </aside>
  );
}
