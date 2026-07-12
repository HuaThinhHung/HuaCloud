"use client";

import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next") || "/gallery";
        router.replace(next);
        router.refresh();
      } else {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setError(b.error || "Đăng nhập thất bại");
        setLoading(false);
      }
    } catch {
      setError("Lỗi kết nối — thử lại");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="hc-scale-in w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-surface-2">
            <Lock className="size-5 text-accent" strokeWidth={1.8} />
          </div>
          <h1 className="text-lg font-semibold">HuaCloud</h1>
          <p className="mt-1 text-[13px] text-muted">Đăng nhập để vào kho ảnh</p>
        </div>

        <div className="relative mb-3">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <User className="size-4" strokeWidth={1.8} />
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tài khoản"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-border-strong"
          />
        </div>

        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="current-password"
            className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 pr-10 text-sm outline-none transition-colors focus:border-border-strong"
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            tabIndex={-1}
            className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:text-foreground"
          >
            {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Đăng nhập
        </button>
      </form>
    </main>
  );
}
