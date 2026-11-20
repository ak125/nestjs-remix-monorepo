// zones-png-du13.cjs — boîtes des pixels différents (regroupés par bandes de 40 px) + extrait côte à côte.
// Usage : PW=... node zones-png-du13.cjs a.png b.png out-prefix
const fs = require("node:fs");
const { PNG } = require(require.resolve("pngjs", { paths: [process.env.PW] }));
const [fa, fb, outp] = process.argv.slice(2); const a = PNG.sync.read(fs.readFileSync(fa)), b = PNG.sync.read(fs.readFileSync(fb));
const W = a.width, H = a.height; const rows = new Map();
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) { const k = Math.floor(y / 40); const r = rows.get(k) || { x0: x, x1: x, y0: y, y1: y, n: 0 }; r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y); r.n++; rows.set(k, r); } }
const boxes = []; for (const r of [...rows.values()].sort((p, q) => p.y0 - q.y0)) { const l = boxes[boxes.length - 1]; if (l && r.y0 - l.y1 <= 41) { l.x0 = Math.min(l.x0, r.x0); l.x1 = Math.max(l.x1, r.x1); l.y1 = r.y1; l.n += r.n; } else boxes.push({ ...r }); }
console.log(JSON.stringify(boxes));
boxes.slice(0, 3).forEach((bx, j) => { const pad = 10, x0 = Math.max(0, bx.x0 - pad), y0 = Math.max(0, bx.y0 - pad), w = Math.min(W - x0, bx.x1 - bx.x0 + 2 * pad), h = Math.min(H - y0, bx.y1 - bx.y0 + 2 * pad);
  const o = new PNG({ width: w * 2 + 6, height: h }); o.data.fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (const [src, off] of [[a, 0], [b, w + 6]]) { const si = ((y0 + y) * W + x0 + x) * 4, di = (y * o.width + off + x) * 4; for (let c = 0; c < 4; c++) o.data[di + c] = src.data[si + c]; }
  fs.writeFileSync(`${outp}-zone${j}.png`, PNG.sync.write(o)); });
