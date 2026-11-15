#!/usr/bin/env node
/**
 * B1sTeam — Build tool cho bộ Shadowrocket module (public_b1s_locket/shadowrocket).
 *
 *   node shadowrocket/build.mjs                 # build: js/*.js + dist/ (module + script đã nhúng key)
 *   node shadowrocket/build.mjs --key=B1S-XXXX-XXXX-XXXX
 *   node shadowrocket/build.mjs --check         # chỉ kiểm tra — exit 1 nếu có file stale
 *   node shadowrocket/build.mjs --out=dist      # thư mục output (mặc định: dist)
 *
 * VIỆC BUILD LÀM:
 *   1) Đọc version.json (nguồn sự thật duy nhất của version) ở thư mục cha.
 *   2) Chèn / chuẩn hoá banner tác giả + banner version vào TỪNG file js/*.js
 *      (idempotent + deterministic — KHÔNG có timestamp ⇒ chạy lại cho kết quả giống hệt).
 *   3) Kiểm tra cú pháp TỪNG file js/*.js bằng node:vm (tương đương `node --check`).
 *   4) Thay placeholder __LICENSE_KEY__ bằng license key (--key=...) trong bản phát hành
 *      và ghi ra dist/ — file nguồn trong js/ và modules/ GIỮ NGUYÊN placeholder.
 *
 * CẤU TRÚC:
 *   shadowrocket/js/*.js       — nguồn (self-contained, đã có banner)
 *   shadowrocket/modules/*     — nguồn (sgmodule / snippet / plugin / stoverride / module)
 *   shadowrocket/dist/         — OUTPUT (bản phát hành có key nhúng)
 *   shadowrocket/dist/js/      — script đã thay placeholder key
 *   shadowrocket/dist/modules/ — module đã thay placeholder key
 *
 * B1sTeam — b1s.id.vn · @b1steam · Nguyễn Hoàng Bách
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

/* ═══════════════════ Hằng số ═══════════════════ */
const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ROOT, "..");
const VERSION_JSON = join(REPO, "version.json");

const JS_DIR = join(ROOT, "js");
const MODULES_DIR = join(ROOT, "modules");
const ASSETS_DIR = join(ROOT, "assets");

/* Version của BỘ SCRIPT (banner bắt buộc trong từng file js) */
const SUITE_VERSION = "4.0.0";

/* Banner tác giả — chuẩn hoá cho mọi file js */
const AUTHOR_LINE = "// author: B1sTeam | b1s.id.vn | @b1steam | github.com/nhb-1201/public_b1s_locket";

/* Placeholder license key */
const KEY_PLACEHOLDER = "__LICENSE_KEY__";

/* File module được build (5 định dạng + file include phụ của Surge) */
const MODULE_FILES = [
  "B1sTeam_LocketGold.sgmodule",
  "B1sTeam_LocketGold.snippet",
  "B1sTeam_LocketGold.plugin",
  "B1sTeam_LocketGold_MITM.plugin",
  "B1sTeam_LocketGold.stoverride",
  "B1sTeam_LocketGold.module",
];

/* ═══════════════════ Đọc tham số ═══════════════════ */
const args = process.argv.slice(2);
const CHECK = args.includes("--check");
let KEY = "";
let OUT_DIR = join(ROOT, "dist");

for (const arg of args) {
  if (arg.startsWith("--key=")) KEY = arg.slice("--key=".length).trim();
  else if (arg.startsWith("--out=")) OUT_DIR = resolve(ROOT, arg.slice("--out=".length).trim());
}
if (!KEY && !CHECK) {
  const envKey = process.env.B1S_LICENSE_KEY;
  if (envKey) KEY = String(envKey).trim();
}

/* ═══════════════════ Version ═══════════════════ */
let VERSION = { product: "LocketGold (Free) — B1sTeam", version: "0.0.0", updated: "unknown" };
try {
  VERSION = JSON.parse(readFileSync(VERSION_JSON, "utf8"));
} catch (e) {
  console.error("Không đọc được version.json:", e.message);
}

const VERSION_COMMENT =
  `/* B1sTeam — ${VERSION.product} v${VERSION.version} · cap nhat ${VERSION.updated} · module suite ${SUITE_VERSION} */`;
const VERSION_VARS = [
  `var B1S_VERSION = "${VERSION.version}";`,
  `var B1S_UPDATED = "${VERSION.updated}";`,
  `var B1S_SUITE = "${SUITE_VERSION}";`,
];

/* ═══════════════════ Chuẩn hoá banner (idempotent) ═══════════════════ */

/* Các dòng "do build quản lý" — sẽ bị gỡ đi rồi chèn lại bản chuẩn */
const MANAGED_PATTERNS = [
  /^\/\/ author: /,
  /^\/\/ file:\s+/,
  /^\/\/ version:\s+/,
  /^\/\* B1sTeam — .*v\d+\.\d+\.\d+ .*\*\/$/,
  /^var B1S_VERSION = /,
  /^var B1S_UPDATED = /,
  /^var B1S_SUITE = /,
];

/**
 * Chuẩn hoá 1 file script: gỡ banner cũ, chèn banner tác giả + banner version.
 * Kết quả là hàm thuần túy của nội dung ⇒ chạy lại cho ra đúng file cũ (idempotent).
 */
function normalizeScript(source, fileName) {
  const lines = String(source).replace(/\r\n/g, "\n").split("\n");
  const kept = lines.filter((line) => !MANAGED_PATTERNS.some((re) => re.test(line)));

  const header = [
    AUTHOR_LINE,
    `// file:    ${fileName}`,
    `// version: ${SUITE_VERSION}`,
    VERSION_COMMENT,
    ...VERSION_VARS,
  ];

  return header.concat(kept).join("\n");
}

/* ═══════════════════ Kiểm tra cú pháp (node:vm ~ node --check) ═══════════════════ */
function syntaxCheck(content, fileName) {
  try {
    /* Bọc trong function wrapper — giống cách ios/build.mjs kiểm tra script Shadowrocket */
    new vm.Script("(function(){\n" + content + "\n});", { filename: fileName });
    return null;
  } catch (e) {
    return e.message;
  }
}

/* ═══════════════════ Tiện ích ═══════════════════ */
function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function readIfExists(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function listFiles(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort();
}

/** Thay placeholder key — nếu chưa có key thì giữ nguyên placeholder. */
function applyKey(content) {
  if (!KEY) return content;
  return content.split(KEY_PLACEHOLDER).join(KEY);
}

/* ═══════════════════ Build ═══════════════════ */
let stale = 0;
let wrote = 0;
const errors = [];

console.log(`BUILD  ${VERSION.product} v${VERSION.version} · cap nhat ${VERSION.updated} · suite ${SUITE_VERSION}`);
console.log(`       key: ${KEY ? KEY.slice(0, 6) + "…" + KEY.slice(-4) : "(chưa có — giữ placeholder)"}`);
console.log(`       out: ${relative(REPO, OUT_DIR) || OUT_DIR}`);

/* ── 1. js/*.js — chèn banner + kiểm tra cú pháp ── */
const jsFiles = listFiles(JS_DIR, ".js");
if (!jsFiles.length) {
  errors.push("Không tìm thấy file .js nào trong js/");
}

for (const file of jsFiles) {
  const source = join(JS_DIR, file);
  const raw = readIfExists(source);
  if (raw === null) {
    errors.push(`Không đọc được ${relative(REPO, source)}`);
    continue;
  }

  const expected = normalizeScript(raw, file);
  const current = raw;

  if (expected !== current) {
    if (CHECK) {
      console.error(`STALE  ${relative(REPO, source)} — banner/version lệch (chạy: node shadowrocket/build.mjs)`);
      stale++;
    } else {
      writeFileSync(source, expected, "utf8");
      wrote++;
      console.log(`WRITE  ${relative(REPO, source)} — banner + version đã chuẩn hoá`);
    }
  } else {
    console.log(`OK     ${relative(REPO, source)}`);
  }

  /* Kiểm tra cú pháp (luôn chạy, kể cả khi file vừa được ghi) */
  const checkContent = expected;
  const err = syntaxCheck(checkContent, file);
  if (err) {
    errors.push(`SYNTAX  ${relative(REPO, source)} — ${err}`);
    console.error(`SYNTAX FAIL  ${relative(REPO, source)} — ${err}`);
  }

  /* Bản phát hành: thay placeholder key */
  if (!CHECK) {
    ensureDir(join(OUT_DIR, "js"));
    const distPath = join(OUT_DIR, "js", file);
    const distContent = applyKey(checkContent);
    const distCurrent = readIfExists(distPath);
    if (distCurrent !== distContent) {
      writeFileSync(distPath, distContent, "utf8");
      wrote++;
      console.log(`WRITE  ${relative(REPO, distPath)} — ${(distContent.length / 1024).toFixed(1)} KB`);
    }
  } else {
    const distPath = join(OUT_DIR, "js", file);
    const distContent = applyKey(expected);
    const distCurrent = readIfExists(distPath);
    if (distCurrent !== distContent) {
      console.error(`STALE  ${relative(REPO, distPath)} — bản phát hành chưa đồng bộ`);
      stale++;
    }
  }
}

/* ── 2. modules/* — thay placeholder key, ghi ra dist/ ── */
for (const file of MODULE_FILES) {
  const source = join(MODULES_DIR, file);
  const raw = readIfExists(source);
  if (raw === null) {
    errors.push(`Không tìm thấy module ${relative(REPO, source)}`);
    continue;
  }

  const distContent = applyKey(raw);
  const distPath = join(OUT_DIR, "modules", file);

  if (CHECK) {
    const distCurrent = readIfExists(distPath);
    if (distCurrent !== distContent) {
      console.error(`STALE  ${relative(REPO, distPath)} — bản phát hành chưa đồng bộ`);
      stale++;
    } else {
      console.log(`OK     ${relative(REPO, distPath)}`);
    }
  } else {
    ensureDir(join(OUT_DIR, "modules"));
    const distCurrent = readIfExists(distPath);
    if (distCurrent !== distContent) {
      writeFileSync(distPath, distContent, "utf8");
      wrote++;
      console.log(`WRITE  ${relative(REPO, distPath)} — ${(distContent.length / 1024).toFixed(1)} KB`);
    } else {
      console.log(`OK     ${relative(REPO, distPath)}`);
    }
  }
}

/* ── 3. assets — copy catalog khung + ảnh vào dist ── */
const framesSrc = join(ASSETS_DIR, "frames");
if (existsSync(framesSrc)) {
  const frames = listFiles(framesSrc, ".png");
  for (const f of frames) {
    const target = join(OUT_DIR, "assets", "frames", f);
    if (CHECK) {
      if (!existsSync(target)) {
        console.error(`STALE  ${relative(REPO, target)} — thiếu ảnh trong dist/`);
        stale++;
      }
    } else {
      ensureDir(join(OUT_DIR, "assets", "frames"));
      const src = join(framesSrc, f);
      const data = readFileSync(src);
      let same = false;
      try {
        same = readFileSync(target).equals(data);
      } catch {
        same = false;
      }
      if (!same) {
        writeFileSync(target, data);
        wrote++;
        console.log(`WRITE  ${relative(REPO, target)}`);
      }
    }
  }
  const catalogSrc = join(framesSrc, "catalog.json");
  const catalogRaw = readIfExists(catalogSrc);
  if (catalogRaw !== null) {
    const catalogDist = join(OUT_DIR, "assets", "frames", "catalog.json");
    const catalogContent = applyKey(catalogRaw);
    if (CHECK) {
      if (readIfExists(catalogDist) !== catalogContent) {
        console.error(`STALE  ${relative(REPO, catalogDist)} — catalog chưa đồng bộ`);
        stale++;
      }
    } else {
      ensureDir(join(OUT_DIR, "assets", "frames"));
      const catalogCurrent = readIfExists(catalogDist);
      if (catalogCurrent !== catalogContent) {
        writeFileSync(catalogDist, catalogContent, "utf8");
        wrote++;
        console.log(`WRITE  ${relative(REPO, catalogDist)}`);
      } else {
        console.log(`OK     ${relative(REPO, catalogDist)}`);
      }
    }
  }
}

/* ── 4. README vào dist ── */
for (const extra of ["README.md"]) {
  const raw = readIfExists(join(ROOT, extra));
  if (raw === null) continue;
  const target = join(OUT_DIR, extra);
  if (CHECK) {
    if (readIfExists(target) !== raw) {
      console.error(`STALE  ${relative(REPO, target)} — chưa đồng bộ`);
      stale++;
    }
  } else {
    ensureDir(OUT_DIR);
    writeFileSync(target, raw, "utf8");
  }
}

/* ── 5. Kết quả ── */
if (errors.length) {
  console.error("\nLỖI:");
  for (const e of errors) console.error("  · " + e);
}

if (CHECK) {
  if (stale || errors.length) {
    console.error(`\n${stale} file stale, ${errors.length} lỗi — chạy: node shadowrocket/build.mjs`);
    process.exit(1);
  }
  console.log("\nOK — mọi file đã đồng bộ, cú pháp hợp lệ.");
  process.exit(0);
}

console.log(`\nXong — ${wrote} file đã ghi, ${errors.length} lỗi.`);
if (errors.length) process.exit(1);
