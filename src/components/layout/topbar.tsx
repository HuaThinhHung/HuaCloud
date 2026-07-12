"use client";

import { Plus } from "lucide-react";
import { useUpload } from "@/features/upload/upload-provider";

export function Topbar({ title, children }: { title: string; children?: React.ReactNode }) {
  const { pickFiles } = useUpload();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-1 items-center justify-end gap-3">
        {children}
        <button
          onClick={pickFiles}
          className="flex h-8.5 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-background transition-colors hover:bg-accent-strong"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Tải lên
        </button>
      </div>
    </header>
  );
}
