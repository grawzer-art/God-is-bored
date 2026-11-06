/** Mini-carte de NORIA : carte réelle du monde (sols, bâtiments, océan), points vivants (vous, habitants, citoyens, police), cadre de la caméra.
 *  Toucher la mini-carte ouvre la grande carte ; en mode Dieu, toucher la grande carte y déplace la caméra. Aucune donnée inventée. */
import type { GameScene } from '../view/scene';
import * as L from '../sim/layout';
import { toGrid, toScreen } from '../view/iso';
import * as Nav from './nav';
import { installTheme } from './theme';

const CSS = `
#mmap{position:absolute;z-index:5;right:calc(var(--sr,0px) + 10px);top:calc(var(--st,0px) + 160px);padding:3px;border-radius:10px;pointer-events:auto;display:none;cursor:pointer}
#mmap canvas{display:block;image-rendering:pixelated;border-radius:7px}
#bigmap{position:absolute;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(6,4,14,.72);padding:calc(var(--st,0px) + 8px) calc(var(--sr,0px) + 8px) calc(var(--sb,0px) + 8px) calc(var(--sl,0px) + 8px)}
#bigmap .box{position:relative;padding:10px;border-radius:16px;max-width:100%;max-height:100%;display:flex;flex-direction:column;gap:6px;align-items:center}
#bigmap canvas{display:block;image-rendering:pixelated;border-radius:10px;max-width:100%;max-height:calc(100vh - 120px)}
#bigmap .row{display:flex;gap:10px;font-size:11px;color:var(--gp-dim);flex-wrap:wrap;justify-content:center} #bigmap .row i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}
#bigmap .x{position:absolute;right:8px;top:8px;min-width:44px;min-height:44px}
`;
const COL: Record<string, string> = { g: '#3d6a3c', s: '#9a968c', r: '#2c2e35', y: '#dcc58f', n: '#a99a6f', z: '#2d84a8', q: '#8a6a49', '#': '#1b1722' };
const INDOOR = '#7b6a5a';
const dot = (g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, s: number) => { g.fillStyle = '#000'; g.beginPath(); g.arc(x * s, y * s, r + 0.8, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(x * s, y * s, r, 0, 7); g.fill(); };
export class MiniMap {
  private el: HTMLElement; private cv: HTMLCanvasElement; private big!: HTMLElement; private bigCv!: HTMLCanvasElement; private base: HTMLCanvasElement; private acc = 0; private open = false;
  static SCALE = 1.3; static BIG = 8;
  constructor(private g: GameScene, root: HTMLElement) {
    installTheme(); const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.base = this.paintBase(); this.el = document.createElement('div'); this.el.id = 'mmap'; this.el.className = 'gp'; this.el.setAttribute('role', 'button'); this.el.setAttribute('aria-label', 'Ouvrir la carte');
    this.cv = document.createElement('canvas'); this.cv.width = Math.round(L.W * MiniMap.SCALE); this.cv.height = Math.round(L.H * MiniMap.SCALE); this.el.appendChild(this.cv); root.appendChild(this.el);
    this.el.onclick = () => { if (!Nav.tooSoon('minimap')) this.openBig(root); };
  }
  private paintBase(): HTMLCanvasElement {
    const S = MiniMap.BIG, c = document.createElement('canvas'); c.width = L.W * S; c.height = L.H * S; const g = c.getContext('2d')!;
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) { const ch = L.MAP[y][x]; const room = L.roomAt(x, y); g.fillStyle = COL[ch] ?? (room && !L.OUTDOOR.includes(room) ? INDOOR : ch === 'X' || ch === 'D' ? '#c9a24a' : COL.g); g.fillRect(x * S, y * S, S, S); }
    g.strokeStyle = 'rgba(240,210,90,.55)'; g.lineWidth = 1; for (const b of L.BUILDINGS) g.strokeRect(b.x0 * S + 0.5, b.y0 * S + 0.5, (b.x1 - b.x0 + 1) * S - 1, (b.y1 - b.y0 + 1) * S - 1);
    return c;
  }
  private paint(cv: HTMLCanvasElement, big: boolean) {
    const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(this.base, 0, 0, cv.width, cv.height); const s = cv.width / L.W; const w = this.g.world; const r = big ? 3.2 : 1.7;
    for (const c of w.chars) { if (c.away || c.id === w.avatar.id || (c.state === 'ko' && false)) continue; const col = c.kind === 'police' ? '#5b8cff' : c.kind === 'resident' ? '#ffffff' : c.kind === 'clerk' || c.kind === 'staff' ? '#c8a3ff' : '#9fe0b0'; dot(g, c.pos.x, c.pos.y, r * (c.kind === 'police' ? 1.1 : 0.9), col, s); }
    const av = w.avatar; dot(g, av.pos.x, av.pos.y, r * 1.5, '#ffcf3a', s);
    const cam = toGrid(this.g.cx, this.g.cy); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = big ? 2 : 1; const half = 7 / this.g.cz * 1.1; g.strokeRect((cam.x - half * 1.25) * s, (cam.y - half * 0.7) * s, half * 2.5 * s, half * 1.4 * s);
  }
  private openBig(root: HTMLElement) {
    if (!this.big) {
      this.big = document.createElement('div'); this.big.id = 'bigmap'; this.big.innerHTML = '<div class="box gp"><button class="gp-btn x" aria-label="Fermer la carte">✕</button><b style="color:#fff;font-size:14px">NORIA</b><canvas></canvas><div class="row"><span><i style="background:#ffcf3a"></i>Vous</span><span><i style="background:#fff"></i>Habitants</span><span><i style="background:#9fe0b0"></i>Citoyens</span><span><i style="background:#5b8cff"></i>Police</span></div><div class="row" id="bmhint"></div></div>'; root.appendChild(this.big);
      this.bigCv = this.big.querySelector('canvas')!; this.bigCv.width = L.W * 8; this.bigCv.height = L.H * 8;
      (this.big.querySelector('.x') as HTMLElement).onclick = () => Nav.closeTop();
      this.bigCv.onclick = (e) => { if (this.g.mode !== 'god') return; const r = this.bigCv.getBoundingClientRect(); const gx = ((e.clientX - r.left) / r.width) * L.W, gy = ((e.clientY - r.top) / r.height) * L.H; const p = toScreen(gx, gy); this.g.follow = false; this.g.cx = p.x; this.g.cy = p.y; Nav.closeTop(); };
    }
    (this.big.querySelector('#bmhint') as HTMLElement).textContent = this.g.mode === 'god' ? 'Touchez la carte pour y déplacer la caméra.' : 'Carte du monde, mise à jour en temps réel.';
    this.big.style.display = 'flex'; this.open = true; Nav.open({ id: 'bigmap', close: () => { this.big.style.display = 'none'; this.open = false; Nav.closed('bigmap'); } }); this.paint(this.bigCv, true);
  }
  update(dt: number) {
    const hide = Nav.blocksWorld() || this.g.hud.fiche.isOpen(); this.el.style.display = hide ? 'none' : 'block';
    this.acc += dt; if (this.acc < 0.3) return; this.acc = 0; if (!hide) this.paint(this.cv, false); if (this.open) this.paint(this.bigCv, true);
  }
}
