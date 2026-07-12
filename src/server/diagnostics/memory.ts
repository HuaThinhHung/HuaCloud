import "server-only";

/** Format nhanh mức RAM tiến trình để log chẩn đoán upload/pipeline. */
export function memUsage(): string {
  const m = process.memoryUsage();
  const mb = (n: number) => Math.round(n / 1024 / 1024);
  return `rss=${mb(m.rss)}MB heap=${mb(m.heapUsed)}/${mb(m.heapTotal)}MB`;
}
