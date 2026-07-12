"use client";

import { UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";

/** Overlay hiện khi kéo file vào bất kỳ đâu trong app. */
export function UploadOverlay({ onDropFiles }: { onDropFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;

    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onDropFiles(files);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [onDropFiles]);

  if (!dragging) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="hc-scale-in flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-accent/60 bg-surface px-16 py-12">
        <UploadCloud className="size-12 text-accent" strokeWidth={1.5} />
        <div className="text-center">
          <p className="text-lg font-medium">Thả để tải lên HuaCloud</p>
          <p className="mt-1 text-sm text-muted">Tối đa 20MB/file</p>
        </div>
      </div>
    </div>
  );
}
