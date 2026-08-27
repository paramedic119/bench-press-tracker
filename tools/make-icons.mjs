/**
 * アイコン生成スクリプト（依存ゼロ / node tools/make-icons.mjs）
 * 4x スーパーサンプリングで描画し、zlib で PNG を直接エンコードする。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SS = 4; // supersample factor

/* ---------- 極小ラスタライザ ---------- */
class Canvas {
  constructor(size) { this.n = size; this.buf = new Float64Array(size * size * 4); }
  blend(x, y, [r, g, b, a]) {
    if (x < 0 || y < 0 || x >= this.n || y >= this.n || a <= 0) return;
    const i = (y * this.n + x) * 4, d = this.buf, ia = 1 - a;
    d[i] = r * a + d[i] * ia; d[i + 1] = g * a + d[i + 1] * ia;
    d[i + 2] = b * a + d[i + 2] * ia; d[i + 3] = a + d[i + 3] * ia;
  }
  rect(x, y, w, h, color) {
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++)
      for (let px = Math.floor(x); px < Math.ceil(x + w); px++) this.blend(px, py, color);
  }
  roundRect(x, y, w, h, r, color) {
    r = Math.min(r, w / 2, h / 2);
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
      for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
        const cx = Math.min(Math.max(px + 0.5, x + r), x + w - r);
        const cy = Math.min(Math.max(py + 0.5, y + r), y + h - r);
        const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r + 1e-9) this.blend(px, py, color);
      }
    }
  }
  vGradient(x, y, w, h, top, bottom) {
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
      const t = h <= 1 ? 0 : (py - y) / (h - 1);
      const c = [top[0] + (bottom[0] - top[0]) * t, top[1] + (bottom[1] - top[1]) * t,
                 top[2] + (bottom[2] - top[2]) * t, 1];
      for (let px = Math.floor(x); px < Math.ceil(x + w); px++) this.blend(px, py, c);
    }
  }
  /** SS 倍のキャンバスを 1/SS に縮小して RGBA バイト列を返す */
  downsample(factor) {
    const out = this.n / factor;
    const px = Buffer.alloc(out * out * 4);
    for (let y = 0; y < out; y++) for (let x = 0; x < out; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < factor; sy++) for (let sx = 0; sx < factor; sx++) {
        const i = ((y * factor + sy) * this.n + x * factor + sx) * 4;
        r += this.buf[i]; g += this.buf[i + 1]; b += this.buf[i + 2]; a += this.buf[i + 3];
      }
      const k = factor * factor, o = (y * out + x) * 4;
      px[o] = Math.round(r / k); px[o + 1] = Math.round(g / k);
      px[o + 2] = Math.round(b / k); px[o + 3] = Math.round((a / k) * 255);
    }
    return { px, size: out };
  }
}

/* ---------- PNG エンコード ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePNG(px, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: None
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- アイコン意匠：ロード済みバーベル ---------- */
const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const BG_TOP = hex('#1E2732'), BG_BOT = hex('#0B0E12');
const KNURL = hex('#DFE4EA'), SLEEVE = hex('#8B95A3');
const PLATE_A = hex('#FF6A2B'), PLATE_B = hex('#C4501F');

function drawIcon(size, { maskable = false } = {}) {
  const n = size * SS, c = new Canvas(n);
  const U = n / 512;

  // 背景（通常アイコンは角丸、maskable は全面塗り）
  const bgMask = new Canvas(n);
  bgMask.vGradient(0, 0, n, n, BG_TOP, BG_BOT);
  if (maskable) { c.buf.set(bgMask.buf); }
  else {
    const r = 114 * U;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx2 = Math.min(Math.max(x + 0.5, r), n - r), cy2 = Math.min(Math.max(y + 0.5, r), n - r);
      const dx = x + 0.5 - cx2, dy = y + 0.5 - cy2;
      if (dx * dx + dy * dy <= r * r + 1e-9) {
        const i = (y * n + x) * 4;
        c.buf[i] = bgMask.buf[i]; c.buf[i + 1] = bgMask.buf[i + 1];
        c.buf[i + 2] = bgMask.buf[i + 2]; c.buf[i + 3] = 1;
      }
    }
  }

  // maskable は安全領域（中央 80%）に収めるため縮小
  const s = (maskable ? 0.58 : 0.86) * U;
  const cx = n / 2, cy = n / 2;
  const R = (x, y, w, h, r, col) => c.roundRect(cx + x * s, cy + y * s, w * s, h * s, r * s, col);

  R(-236, -16, 472, 32, 15, SLEEVE);   // バー全体（スリーブ）
  R(-104, -20, 208, 40, 19, KNURL);    // 中央のシャフト
  for (const d of [1, -1]) {
    const f = (x, w) => (d > 0 ? x : -x - w);
    R(f(112, 44), -110, 44, 220, 15, PLATE_A);  // 内側 大プレート
    R(f(166, 30), -80, 30, 160, 11, PLATE_B);   // 外側 中プレート
    R(f(206, 16), -30, 16, 60, 7, KNURL);       // カラー（留め具）
  }

  const { px, size: out } = c.downsample(SS);
  return encodePNG(px, out);
}

mkdirSync(join(ROOT, 'icons'), { recursive: true });
const files = [
  ['icons/icon-192.png', drawIcon(192)],
  ['icons/icon-512.png', drawIcon(512)],
  ['icons/maskable-512.png', drawIcon(512, { maskable: true })],
  ['icons/apple-touch-icon.png', drawIcon(180, { maskable: true })],
  ['icons/favicon-32.png', drawIcon(32)],
];
for (const [p, buf] of files) { writeFileSync(join(ROOT, p), buf); console.log(`${p}  ${(buf.length / 1024).toFixed(1)} KB`); }
