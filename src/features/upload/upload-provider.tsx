"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { UploadOverlay } from "./upload-overlay";
import { UploadPanel } from "./upload-panel";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Vercel (deploy): PUT thẳng lên Blob để né body-limit 4.5MB. Local: XHR multipart.
const BLOB_ENABLED = process.env.NEXT_PUBLIC_BLOB_ENABLED === "1";

export type UploadItem = {
  id: string;
  fileName: string;
  size: number;
  progress: number; // 0..100
  status: "queued" | "uploading" | "done" | "duplicate" | "error";
  error?: string;
};

type UploadContextValue = {
  items: UploadItem[];
  pickFiles: () => void;
  addFiles: (files: Iterable<File>) => void;
  clearFinished: () => void;
  /** Đặt album đích cho MỌI upload kế tiếp (trang album gọi lúc mở, null khi rời). */
  setUploadAlbum: (albumId: string | null) => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload phải nằm trong UploadProvider");
  return ctx;
}

// 2 (không phải 3): mỗi upload kích hoạt đẩy ảnh GỐC lên Telegram ở server;
// 3 ảnh nặng cùng lúc dễ làm Telegram nghẽn → timeout 55s → FAILED. 2 an toàn hơn.
const CONCURRENCY = 2;
// Tự thử lại khi lỗi TẠM THỜI (mạng chập chờn, Telegram nghẽn) — không thử lại lỗi
// vĩnh viễn (file quá lớn 413, trùng, sai định dạng 400).
const MAX_RETRIES = 2;
const RETRY_DELAY = 1200; // ms, nhân theo số lần đã thử (backoff nhẹ)

type QueueEntry = { item: UploadItem; file: File; albumId: string | null; attempt: number };
let itemSeq = 0;

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<QueueEntry[]>([]);
  const activeRef = useRef(0);
  const uploadAlbumIdRef = useRef<string | null>(null);
  const setUploadAlbum = useCallback((albumId: string | null) => {
    uploadAlbumIdRef.current = albumId;
  }, []);

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const pump = useCallback(() => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      activeRef.current += 1;

      const done = (patch: Partial<UploadItem>) => {
        update(next.item.id, patch);
        activeRef.current -= 1;
        queryClient.invalidateQueries({ queryKey: ["assets"] });
        // Upload vào album → làm mới đếm/cover album + danh sách album.
        if (next.albumId) queryClient.invalidateQueries({ queryKey: ["albums"] });
        pump();
      };

      // Lỗi tạm thời → tự đưa lại vào hàng đợi (backoff nhẹ); hết lượt mới báo "error".
      const settleError = (message: string, retryable: boolean) => {
        activeRef.current -= 1;
        if (retryable && next.attempt < MAX_RETRIES) {
          next.attempt += 1;
          update(next.item.id, {
            status: "queued",
            progress: 0,
            error: `Đang thử lại (${next.attempt}/${MAX_RETRIES})…`,
          });
          setTimeout(() => {
            queueRef.current.push(next);
            pump();
          }, RETRY_DELAY * next.attempt);
        } else {
          update(next.item.id, { status: "error", error: message });
          pump();
        }
      };

      if (BLOB_ENABLED) {
        update(next.item.id, { status: "uploading", progress: 0 });
        upload(next.file.name, next.file, {
          access: "public",
          handleUploadUrl: "/api/upload/handle",
          clientPayload: JSON.stringify({ fileName: next.file.name, albumId: next.albumId }),
          onUploadProgress: (e) =>
            update(next.item.id, { status: "uploading", progress: Math.round(e.percentage) }),
        })
          .then(() => {
            done({ status: "done", progress: 100 });
            // Asset được tạo server-side (onUploadCompleted) sau ít giây → refetch thêm
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ["assets"] }), 2500);
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ["assets"] }), 6000);
          })
          .catch((err: unknown) =>
            // Lỗi upload Blob thường do mạng → thử lại.
            settleError(err instanceof Error ? err.message : "Upload thất bại", true),
          );
        continue;
      }

      const form = new FormData();
      form.append("file", next.file, next.file.name);
      if (next.albumId) form.append("albumId", next.albumId);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          update(next.item.id, {
            status: "uploading",
            progress: Math.round((e.loaded / e.total) * 100),
          });
        }
      };
      xhr.onload = () => {
        // 5xx (Telegram nghẽn/timeout) hoặc status 0 → tạm thời, thử lại.
        // 4xx (413 quá lớn, 400 sai định dạng) → lỗi vĩnh viễn, không thử lại.
        const transient = xhr.status >= 500 || xhr.status === 0;
        try {
          const body = JSON.parse(xhr.responseText || "{}");
          if (xhr.status === 201) {
            done({ status: "done", progress: 100 });
          } else if (xhr.status === 200 && body.kind === "duplicate") {
            done({ status: "duplicate", progress: 100 });
            toast.info(`"${next.item.fileName}" đã có trong thư viện — bỏ qua bản trùng.`);
          } else {
            settleError(body.error ?? `Lỗi ${xhr.status}`, transient);
          }
        } catch {
          settleError(`Lỗi ${xhr.status}`, transient);
        }
      };
      xhr.onerror = () => settleError("Mất kết nối khi upload", true);
      xhr.send(form);
      update(next.item.id, { status: "uploading" });
    }
  }, [queryClient, update]);

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      // Chốt album đích tại thời điểm thả file (đang đứng ở trang album nào).
      const albumId = uploadAlbumIdRef.current;
      const accepted: QueueEntry[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`"${file.name}" vượt quá 20MB — giới hạn hiện tại là 20MB/file.`);
          continue;
        }
        if (file.size === 0) continue;
        const item: UploadItem = {
          id: `u${++itemSeq}-${Date.now()}`,
          fileName: file.name || "untitled",
          size: file.size,
          progress: 0,
          status: "queued",
        };
        accepted.push({ item, file, albumId, attempt: 0 });
      }
      if (accepted.length === 0) return;
      setItems((prev) => [...accepted.map((a) => a.item), ...prev].slice(0, 100));
      queueRef.current.push(...accepted);
      pump();
    },
    [pump],
  );

  const pickFiles = useCallback(() => inputRef.current?.click(), []);

  const clearFinished = useCallback(() => {
    setItems((prev) =>
      prev.filter((it) => it.status === "queued" || it.status === "uploading"),
    );
  }, []);

  // Ctrl+V paste ảnh từ clipboard — hoạt động trên mọi trang
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        const named = Array.from(files).map(
          (f) =>
            new File([f], f.name && f.name !== "image.png" ? f.name : `pasted-${Date.now()}.png`, {
              type: f.type,
            }),
        );
        addFiles(named);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const value = useMemo(
    () => ({ items, pickFiles, addFiles, clearFinished, setUploadAlbum }),
    [items, pickFiles, addFiles, clearFinished, setUploadAlbum],
  );

  return (
    <UploadContext.Provider value={value}>
      {children}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <UploadOverlay onDropFiles={addFiles} />
      <UploadPanel items={items} onClear={clearFinished} />
    </UploadContext.Provider>
  );
}
