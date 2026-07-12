/* eslint-disable no-console */
// E2E test upload — nhiều chế độ. Yêu cầu dev server đang chạy (http://localhost:3000).
//
//   npm run test:upload                  → happy path: ảnh thường → READY → checksum khớp
//   npm run test:upload -- "C:\anh.jpg"  → upload file thật
//   npm run test:upload -- --oversize    → payload > 20MB PHẢI bị chặn 413, server KHÔNG sập
//   npm run test:upload -- --bomb        → ảnh khai báo > 100MP PHẢI xử lý an toàn, server KHÔNG sập
//   npm run test:upload -- --all         → chạy cả 3 ca liên tiếp
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AssetDTO = { id: string; status: string; fileName: string; originalUrl: string };

async function serverAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function makeTestImage(): Promise<{ buffer: Buffer; name: string; type: string }> {
  // Nền đổi màu theo thời gian → mỗi lần chạy là ảnh DUY NHẤT (Windows không render
  // chữ SVG nên không thể dựa vào text để tạo khác biệt), tránh dính dedupe.
  const t = Date.now();
  const buffer = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: t % 200, g: Math.floor(t / 256) % 200, b: Math.floor(t / 65536) % 200 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1200" height="800"><text x="60" y="420" font-size="90" font-family="Arial" fill="white">HuaCloud ✓ ${new Date().toISOString()}</text></svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
  return { buffer, name: `huacloud-test-${Date.now()}.jpg`, type: "image/jpeg" };
}

async function makeBombImage(): Promise<{ buffer: Buffer; name: string; type: string }> {
  // 11000×10000 = 110 MP (vượt ngưỡng 100 MP của server) nhưng nền trơn nên nén
  // JPEG rất nhỏ (< 1 MB) → lọt qua giới hạn 20MB, chỉ "nổ" khi server decode.
  const buffer = await sharp({
    create: { width: 11000, height: 10000, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
  return { buffer, name: `huacloud-bomb-${Date.now()}.jpg`, type: "image/jpeg" };
}

async function waitStatus(assetId: string, initial: string): Promise<string> {
  let status = initial;
  for (let i = 0; i < 60 && status !== "READY" && status !== "FAILED"; i++) {
    await sleep(2000);
    const res = await fetch(`${BASE}/api/assets?view=all&take=50`, { cache: "no-store" });
    const list = (await res.json()) as { items: (AssetDTO & { errorMessage?: string })[] };
    const found = list.items.find((a) => a.id === assetId);
    if (found && found.status !== status) {
      console.log(`  → ${found.status}`);
      status = found.status;
    }
  }
  return status;
}

async function testHappy(fileArg?: string) {
  const file = fileArg
    ? {
        buffer: readFileSync(fileArg),
        name: path.basename(fileArg),
        type: fileArg.match(/\.(png)$/i) ? "image/png" : "image/jpeg",
      }
    : await makeTestImage();

  const sha = createHash("sha256").update(file.buffer).digest("hex");
  console.log(`\n[happy] Upload: ${file.name} (${(file.buffer.length / 1024).toFixed(0)} KB)`);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.type }), file.name);
  const upRes = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
  const upBody = (await upRes.json()) as { kind?: string; asset?: AssetDTO; error?: string };
  if (!upRes.ok || !upBody.asset) throw new Error(`Upload lỗi: ${upBody.error ?? upRes.status}`);
  if (upBody.kind === "duplicate") console.log("! File trùng — dùng asset cũ để verify.");
  const assetId = upBody.asset.id;
  console.log(`✓ Upload nhận: asset ${assetId} (${upBody.asset.status})`);

  const status = await waitStatus(assetId, upBody.asset.status);
  if (status !== "READY") throw new Error(`Asset không READY (đang ${status})`);
  console.log("✓ Asset READY");

  const dl = await fetch(`${BASE}/f/${assetId}?v=original`);
  if (!dl.ok) throw new Error(`Tải original lỗi: ${dl.status}`);
  const gotSha = createHash("sha256").update(Buffer.from(await dl.arrayBuffer())).digest("hex");
  if (gotSha !== sha) throw new Error(`Checksum KHÔNG khớp!\n  gửi:  ${sha}\n  nhận: ${gotSha}`);
  console.log(`✓ Checksum khớp (${sha.slice(0, 16)}...) — original toàn vẹn 100%`);

  const th = await fetch(`${BASE}/f/${assetId}?v=thumb`);
  console.log(th.ok ? "✓ Thumbnail OK" : `! Thumbnail chưa có (${th.status})`);
}

async function testOversize() {
  const size = 21 * 1024 * 1024 + 512 * 1024; // ~21.5MB
  console.log(`\n[oversize] Gửi payload ${(size / 1024 / 1024).toFixed(1)}MB (mong đợi bị chặn 413)`);
  const big = Buffer.alloc(size, 0x7a);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(big)], { type: "application/octet-stream" }), "oversize.bin");
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
  console.log(`  → HTTP ${res.status}`);
  if (res.status !== 413) throw new Error(`Mong đợi 413, nhận ${res.status}`);
  if (!(await serverAlive())) throw new Error("Server không phản hồi sau khi từ chối file lớn!");
  console.log("✓ File > 20MB bị chặn 413 sớm, server vẫn sống");
}

async function testBomb() {
  const file = await makeBombImage();
  console.log(
    `\n[bomb] Upload ảnh 110MP: ${file.name} (${(file.buffer.length / 1024).toFixed(0)} KB nén — mong đợi server không sập)`,
  );
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.type }), file.name);
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
  const body = (await res.json()) as { asset?: AssetDTO; error?: string };
  if (!res.ok || !body.asset) {
    console.log(`  → bị từ chối ngay: HTTP ${res.status} (${body.error ?? "?"})`);
  } else {
    const status = await waitStatus(body.asset.id, body.asset.status);
    console.log(`  → trạng thái cuối: ${status}`);
    if (status !== "READY" && status !== "FAILED") throw new Error(`Asset kẹt ở ${status}`);
  }
  if (!(await serverAlive())) throw new Error("Server SẬP sau khi xử lý ảnh 110MP!");
  console.log("✓ Ảnh 110MP không làm sập server");
}

async function main() {
  const args = process.argv.slice(2);
  const has = (f: string) => args.includes(f);

  if (!(await serverAlive())) {
    throw new Error(`Dev server chưa chạy tại ${BASE} — chạy 'npm run dev' trước.`);
  }

  if (has("--all")) {
    await testHappy();
    await testOversize();
    await testBomb();
  } else if (has("--oversize")) {
    await testOversize();
  } else if (has("--bomb")) {
    await testBomb();
  } else {
    await testHappy(args.find((a) => !a.startsWith("--")));
  }

  console.log("\n✓✓ TEST UPLOAD PASS");
}

main().catch((e) => {
  console.error(`\n✗ TEST FAIL: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
