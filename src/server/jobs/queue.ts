import "server-only";

/**
 * Queue in-process tối giản — LOCAL DEV FALLBACK cho Inngest (docs/03 mục 9).
 * Concurrency 1, retry 3 lần exponential backoff, tôn trọng retry_after của Telegram.
 * Bản production: thay bằng Inngest functions — chữ ký enqueue giữ nguyên.
 */

type Job = { name: string; run: () => Promise<void> };

const globalForQueue = globalThis as unknown as {
  __hcQueue?: { chain: Promise<void>; pending: number };
  __hcQueueGuardsSet?: boolean;
};

const state = (globalForQueue.__hcQueue ??= { chain: Promise.resolve(), pending: 0 });

// Lưới an toàn: một Promise reject lọt ra ngoài queue không được phép giết
// process (kéo sập dev server). Đăng ký handler đúng 1 lần.
if (!globalForQueue.__hcQueueGuardsSet) {
  globalForQueue.__hcQueueGuardsSet = true;
  process.on("unhandledRejection", (reason) => {
    console.error(
      "[queue] unhandledRejection:",
      reason instanceof Error ? reason.message : reason,
    );
  });
}

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function enqueue(job: Job): void {
  state.pending += 1;
  state.chain = state.chain.then(async () => {
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await job.run();
          return;
        } catch (e) {
          const retryAfter =
            e && typeof e === "object" && "retryAfter" in e
              ? Number((e as { retryAfter?: number }).retryAfter) || 0
              : 0;
          if (attempt >= MAX_RETRIES) throw e;
          const backoff = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
          console.warn(`[queue] ${job.name} lỗi (lần ${attempt + 1}), retry sau ${backoff}ms`);
          await sleep(backoff);
        }
      }
    } catch (e) {
      console.error(`[queue] ${job.name} thất bại hẳn:`, e instanceof Error ? e.message : e);
    } finally {
      state.pending -= 1;
    }
  });
}

export function pendingJobs(): number {
  return state.pending;
}
