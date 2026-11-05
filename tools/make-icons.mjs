// Génère les icônes PWA (pixel art 32x32, mises à l'échelle sans lissage) : node tools/make-icons.mjs
// ASSETS PROVISOIRES dessinés par code : un dieu blasé (auréole, paupières mi-closes) sur un ciel de nuit.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const G = 32;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const P = { bg: hex('#161a33'), bg2: hex('#1d2142'), star: hex('#f4f1de'), gold: hex('#ffd84a'), gold2: hex('#e8a317'), skin: hex('#f6d3ae'), skin2: hex('#dca97c'),
  line: hex('#2a1d2e'), robe: hex('#e9ecf7'), robe2: hex('#b7bfdc'), hair: hex('#c9ced9'), blush: hex('#f2a0a0'), zz: hex('#8fd0ff') };
const art = Array.from({ length: G }, () => Array(G).fill(null));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < G && y < G) art[y][x] = c; };
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
const disc = (cx, cy, r, c) => { for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r) set(x, y, c); };

// fond : bandes de ciel + étoiles
for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) set(x, y, y % 8 < 4 ? P.bg : P.bg2);
for (const [x, y] of [[3, 3], [27, 5], [6, 14], [28, 17], [4, 24], [25, 27], [14, 2], [20, 8]]) set(x, y, P.star);
// robe
rect(8, 23, 16, 9, P.robe); rect(8, 23, 16, 1, P.line); rect(6, 26, 2, 6, P.robe2); rect(24, 26, 2, 6, P.robe2); rect(12, 23, 8, 2, P.robe2);
// tête
disc(16, 15, 8, P.line); disc(16, 15, 7, P.skin);
rect(10, 19, 12, 2, P.skin2);
// barbe/cheveux
rect(9, 7, 14, 3, P.hair); rect(8, 9, 2, 5, P.hair); rect(22, 9, 2, 5, P.hair); rect(9, 7, 14, 1, P.line);
rect(10, 20, 12, 3, P.hair); rect(11, 23, 10, 1, P.hair);
// auréole
for (let x = 9; x < 23; x++) { set(x, 3, P.gold); set(x, 5, P.gold2); }
set(8, 4, P.gold); set(23, 4, P.gold); for (let x = 9; x < 23; x++) set(x, 4, P.bg);
// yeux mi-clos (paupières) + sourcils tombants
for (const ex of [11, 17]) { rect(ex, 13, 4, 1, P.line); rect(ex, 14, 4, 2, P.robe); rect(ex + 1, 14, 2, 2, P.line); rect(ex, 12, 4, 1, P.skin2); }
rect(11, 11, 3, 1, P.hair); rect(18, 11, 3, 1, P.hair);
// bouche plate + joues
rect(14, 19, 4, 1, P.line); set(10, 17, P.blush); set(21, 17, P.blush);
// zzz d'ennui
set(25, 10, P.zz); set(26, 10, P.zz); set(26, 11, P.zz); set(25, 12, P.zz); set(26, 12, P.zz);

function draw(size, { maskable = false } = {}) {
  const pad = maskable ? 4 : 0; const grid = G + pad * 2; const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = Math.floor((x * grid) / size) - pad, gy = Math.floor((y * grid) / size) - pad;
    const c = art[Math.min(G - 1, Math.max(0, gy))][Math.min(G - 1, Math.max(0, gx))] ?? P.bg; // les bords du fond se prolongent (zone sûre maskable)
    const inside = gx >= 0 && gx < G && gy >= 0 && gy < G;
    const out = inside ? c : (gy < 0 || gy >= G ? ((gy < 0 ? 0 : G - 1) % 8 < 4 ? P.bg : P.bg2) : c);
    px.set(out, (y * size + x) * 4);
  }
  return px;
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size, opts) {
  const raw = draw(size, opts); const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { rows[y * (size * 4 + 1)] = 0; raw.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync('public/icons', { recursive: true });
const out = { 'icon-192.png': png(192), 'icon-512.png': png(512), 'icon-maskable-512.png': png(512, { maskable: true }), 'apple-touch-icon.png': png(180), 'favicon-32.png': png(32) };
for (const [n, b] of Object.entries(out)) writeFileSync('public/icons/' + n, b);
console.log('icônes générées :', Object.keys(out).join(', '));
