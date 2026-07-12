/* eslint-disable no-console */
// Sao lưu "bộ não" của HuaCloud: file database (mapping tới Telegram) + thumbnail.
// Ảnh gốc đã nằm an toàn trên Telegram nên KHÔNG cần backup ở đây.
//
// Chạy: npm run backup   → tạo bản sao trong backups/<ngày-giờ>/
//
// Lưu ý: KHÔNG dùng fs.cpSync (recursive bị crash native trên Windows khi đường
// dẫn có dấu tiếng Việt) — tự copy từng file bằng copyFileSync cho chắc.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

function copyDir(src: string, dst: string) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

const root = process.cwd();
const dbPath = path.join(root, ".data", "huacloud.db");

if (!existsSync(dbPath)) {
  console.error("✗ Chưa có database .data/huacloud.db — chưa có gì để backup.");
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const destDir = path.join(root, "backups", stamp);
mkdirSync(destDir, { recursive: true });

copyFileSync(dbPath, path.join(destDir, "huacloud.db"));
const derived = path.join(root, ".data", "derived");
if (existsSync(derived)) copyDir(derived, path.join(destDir, "derived"));

console.log(`✓ Đã sao lưu vào: ${destDir}`);
console.log("  Gồm database + thumbnail. Ảnh gốc vẫn an toàn trên Telegram.");
console.log("  → Thỉnh thoảng copy thư mục backups/ lên Google Drive hoặc USB cho chắc.");
