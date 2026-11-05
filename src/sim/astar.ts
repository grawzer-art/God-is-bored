import type { V2 } from './defs';
/** A* sur grille, 8 voisins, diagonale uniquement si les deux cases adjacentes sont libres (comme AStarGrid2D ONLY_IF_NO_OBSTACLES). */
export class AStar {
  solid: Uint8Array;
  constructor(public w: number, public h: number) { this.solid = new Uint8Array(w * h); }
  setSolid(x: number, y: number, v: boolean) { this.solid[y * this.w + x] = v ? 1 : 0; }
  isSolid(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h || this.solid[y * this.w + x] === 1; }
  path(a: V2, b: V2): V2[] {
    if (this.isSolid(b.x, b.y)) return [];
    const W = this.w, n = this.w * this.h;
    const g = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const open: number[] = [];
    const s = a.y * W + a.x, t = b.y * W + b.x;
    g[s] = 0; open.push(s);
    const hf = (i: number) => Math.hypot((i % W) - b.x, Math.floor(i / W) - b.y);
    const f = new Float32Array(n); f[s] = hf(s);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === t) break;
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % W, cy = Math.floor(cur / W);
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (this.isSolid(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (this.isSolid(cx + dx, cy) || this.isSolid(cx, cy + dy))) continue;
        const ni = ny * W + nx; if (closed[ni]) continue;
        const ng = g[cur] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; f[ni] = ng + hf(ni); open.push(ni); }
      }
    }
    if (from[t] === -1 && s !== t) return [];
    const out: V2[] = []; let c = t;
    while (c !== -1) { out.push({ x: c % W, y: Math.floor(c / W) }); c = from[c]; }
    return out.reverse();
  }
}
