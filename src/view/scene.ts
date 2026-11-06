import Phaser from 'phaser';
import { World } from '../sim/world';
import * as L from '../sim/layout';
import { MIN_PER_SEC } from '../sim/defs';
import * as Save from '../sim/save';
import { exportToFile, pickFile } from '../ui/saveio';
import { FLOOR_STYLES, canvas, ctx2, floorTile, wallTex, hash2, type FaceSpec, type C, c, shade } from '../art/core';
import { panes, storeys, type ExtSpec } from '../art/facade';
import { furnSprite, rugCanvas } from '../art/furn';
import { CharView } from './charview';
import { WeatherFx } from './weatherfx';
import { SeaFx } from './seafx';
import { Lighting } from './lighting';
import { cellKey, toGrid, toScreen, zOf } from './iso';
import { texKey } from './texreg';
import { Hud } from '../ui/hud';
import { pickProp } from './picking';
import { Doors } from './doors';
import { setupNoriaDemo, setupTrioDemo } from '../sim/demo';
import { brief } from '../sim/observe';
import { roofCanvas, signCanvas, type RoofStyle } from '../art/city';
import * as Act from '../sim/interact';
import * as Home from '../sim/home';
import * as Possess from '../sim/possess';
import * as Quests from '../sim/quests';
import * as Nav from '../ui/nav';
import * as Settings from '../start/settings';
import { StartFlow } from '../start/intro';
import { openCreator } from '../start/creator';

/** Vitesses : pause, ×1, ×2, ×3, ×8. La simulation (décisions, routines, trajets, conséquences) avance à ce rythme, pas seulement l'horloge. */
export const SPEEDS = [0, 1, 2, 3, 8];
export const WALL_FULL = 96, WALL_LOW = 24;
const BRICK = c(0.55, 0.27, 0.25);
const BAR_WINDOWS = [33, 35, 40, 43, 46, 48];
const WINDOWS_N = [2, 5, 9, 12, 16, 19, 23, 26], WINDOWS_W = [4, 12, 16], DOOR_W = 8;
const PICTURES_SW = ['5,6', '13,6', '20,6', '7,9', '18,9', '26,9', '3,9'];
const ROOM_COL: Record<string, C> = { j: c(0.93, 0.86, 0.7), m: c(0.82, 0.76, 0.9), v: c(0.62, 0.84, 0.88), a: c(0.58, 0.72, 0.86), b: c(0.66, 0.8, 0.68), c: c(0.88, 0.7, 0.74), d: c(0.9, 0.79, 0.56), h: c(0.86, 0.82, 0.74), k: c(0.92, 0.89, 0.7), l: c(0.8, 0.55, 0.44), w: c(0.6, 0.83, 0.88), u: c(0.72, 0.74, 0.78), B: c(0.36, 0.2, 0.25), R: c(0.5, 0.55, 0.58), M: c(0.93, 0.9, 0.78), Q: c(0.74, 0.78, 0.86), C: c(0.62, 0.64, 0.68), T: c(0.9, 0.78, 0.6), N: c(0.86, 0.82, 0.74), O: c(0.8, 0.84, 0.88), P: c(0.9, 0.84, 0.72) };
const WALLCOL: Record<string, C> = { brick: c(0.68, 0.32, 0.25), concrete: c(0.66, 0.68, 0.72), beige: c(0.9, 0.78, 0.55), blue: c(0.38, 0.52, 0.76), cream: c(0.95, 0.88, 0.7) };
const OUTSIDE = c(0.7, 0.66, 0.62);
const hashStr = (t: string) => { let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h); };

export class GameScene extends Phaser.Scene {
  world!: World; hud!: Hud; lighting!: Lighting; wfx?: WeatherFx; sea?: SeaFx; fx!: Phaser.GameObjects.Graphics;
  walls: { s: Phaser.GameObjects.Image; x: number; y: number }[] = []; furnNodes = new Map<number, Phaser.GameObjects.Image[]>();
  propNodes = new Map<number, Phaser.GameObjects.Image>(); feastNodes: Phaser.GameObjects.Image[] = []; chars: CharView[] = []; staticNodes: Phaser.GameObjects.GameObject[] = [];
  floorSprite?: Phaser.GameObjects.Image;
  mode: 'god' | 'human' = 'god'; wallMode = 1; speedIndex = 1; selectedId = -1; hoverId = -1; follow = false; autosave = 0; fxT = 0;
  tx = 0; ty = 0; tz = 1; cx = 0; cy = 0; cz = 1; minZoom = 0.2; maxZoom = 3.5; bounds = { x: 0, y: 0, w: 0, h: 0 };
  doors!: Doors; demo = false; demoKind: '' | 'theft' | 'trio' = ''; analog = { x: 0, y: 0, mag: 0 }; dest: { x: number; y: number; t0: number; fade: number } | null = null;
  trailDots = 0; keys = new Set<string>(); runLatch = false; params = new URLSearchParams(location.search);
  private pan = { down: false, moved: false, sx: 0, sy: 0, button: 0, t: 0 }; private pinch = 0; private lastClick = { t: 0, id: -1 };

  constructor() { super('game'); }

  create() {
    const seed = Number(this.params.get('seed') ?? 1337);
    let w: World | null = null; let hot: any = null;
    let loaded = false; if (this.params.has('load')) { w = Save.load(); loaded = !!w; }
    // Dev : l'état de la partie survit au rechargement automatique (hot reload)
    if (!w && import.meta.env.DEV && !this.params.has('fresh') && !this.params.has('simulate')) { try { hot = JSON.parse(localStorage.getItem('gib:hot') ?? 'null'); if (hot) w = Save.fromJSON(hot.world); } catch { hot = null; } }
    if (this.params.get('demo') === 'noria') { w = new World(seed); w.build(); setupNoriaDemo(w); hot = null; this.demo = true; this.demoKind = 'theft'; }
    if (this.params.get('demo') === 'trio') { w = new World(seed); w.build(); setupTrioDemo(w); hot = null; this.demo = true; this.demoKind = 'trio'; }
    if (!w) { w = new World(seed); w.build(); hot = null; }
    this.world = w;
    if (import.meta.hot) import.meta.hot.on('vite:beforeFullReload', () => { try { localStorage.setItem('gib:hot', JSON.stringify({ world: Save.toJSON(this.world), cam: { x: this.tx, y: this.ty, z: this.tz }, speed: this.speedIndex, walls: this.wallMode, sel: this.selectedId, mode: this.mode })); } catch { /* ignore */ } });
    // Nouvelle partie ordinaire : on démarre vers 8 h 30, la maison déjà réveillée (au lieu de 6 h 52 : tout le monde dort et rien ne bouge pendant une heure).
    const fresh = !this.params.has('simulate') && !this.params.has('fresh') && !this.params.has('load') && !this.params.has('human') && !this.demo && !hot && !loaded;
    const sim = fresh ? 48 : Number(this.params.get('simulate') ?? 0); for (let i = 0; i < Math.floor(sim / 0.1); i++) this.world.tick(0.1);
    if (this.params.has('feast')) { this.world.godEnergy = 100; import('../sim/god').then((G) => { G.feast(this.world); for (let i = 0; i < Number(this.params.get('feast')) * 10; i++) this.world.tick(0.1); }); }
    this.buildView();
    this.hud = new Hud(this);
    this.world.onAvatarArrive = (npc) => this.hud.openDialogue(npc); this.hookCrime();
    this.fitCamera();
    this.setupInput();
    if (hot) { this.tx = this.cx = hot.cam.x; this.ty = this.cy = hot.cam.y; this.tz = this.cz = hot.cam.z; this.wallMode = hot.walls; this.applyWalls(); this.setSpeed(hot.speed); if (hot.sel >= 0) this.selectChar(hot.sel); if (hot.mode === 'human') this.descend(false); }
    if (this.world.avatarControlled || this.params.has('human')) this.descend(false);
    if (this.params.has('walls')) { this.wallMode = Number(this.params.get('walls')); this.applyWalls(); }
    if (this.demoKind === 'trio') { this.setSpeed(2); this.focusTrio(); } else if (this.demo) { this.setSpeed(3); this.focusZone('house'); }
    if (fresh) this.setSpeed(2); // partie neuve : ×2 par défaut, la ville bouge deux fois plus vite sous les yeux (×1 reste à un toucher)
    if (this.params.has('speed')) this.setSpeed(Number(this.params.get('speed')));
    Settings.apply(); Settings.onChange(() => this.applyQuality()); this.applyQuality();
    if (this.params.has('zoom')) { this.tz = this.cz = Number(this.params.get('zoom')); }
    if (this.params.has('at')) { const [x, y] = this.params.get('at')!.split(',').map(Number); const p = toScreen(x, y); this.tx = this.cx = p.x; this.ty = this.cy = p.y; }
    if (this.params.has('focus')) this.selectChar(Number(this.params.get('focus')), true);
    this.scale.on('resize', (s: Phaser.Structs.Size) => this.lighting.resize(s.width, s.height));
    { const done = (window as any).__gibBootDone; if (done) done(); else document.getElementById('boot')?.remove(); }
    (window as any).__gib = this;
    // parcours de démarrage (générique, menu, créateur) : uniquement pour une ouverture ordinaire du jeu (les paramètres d'URL de test/démo le contournent)
    const skipIntro = ['fresh', 'load', 'simulate', 'human', 'demo', 'nohelp', 'nointro', 'feast'].some((k) => this.params.has(k)) || !!hot;
    if (!skipIntro) { this.start = new StartFlow(this); this.start.run(); }
  }
  start?: StartFlow;
  /** Qualité « économe » : sans fenêtres éclairées ni voitures, marge de chargement du sol réduite. */
  lowQuality = false;
  applyQuality() { this.lowQuality = Settings.get().quality === 'low'; for (const r of this.roofs) if (r.glow && this.lowQuality) r.glow.setVisible(false); for (const n of this.carNodes) n.forEach((i) => i.setVisible(!this.lowQuality)); }

  // ------------------------------------------------------------------ construction de la vue
  buildView() {
    this.bakeFloor(); this.buildWalls(); this.buildFurniture(); this.doors = new Doors(this, this.world, (x, y) => this.wallHeight(x, y)); this.buildRoofs(); this.buildDecor();
    this.chars = this.world.chars.map((c) => new CharView(this, c, this.world));
    this.fx = this.add.graphics().setDepth(3800);
    this.lighting = new Lighting(this, this.world); this.wfx = new WeatherFx(this, this.world, this.lighting, () => this.lowQuality); this.sea = new SeaFx(this, this.world, () => this.lowQuality);
    this.world.listeners.log = []; this.world.listeners.emote = [];
  }
  destroyView() {
    this.children.removeAll(true); this.carNodes = []; this.walls = []; this.floorChunks.clear(); this.roofs = []; this.furnNodes.clear(); this.propNodes.clear(); this.feastNodes = []; this.chars = []; this.staticNodes = [];
  }
  replaceWorld(w: World) { Nav.closeAll(); this.destroyView(); this.world = w; this.buildView(); this.selectedId = -1; this.world.onAvatarArrive = (npc) => this.hud.openDialogue(npc); this.hookCrime(); this.hud.rebind(); this.mode = 'god'; if (w.avatarControlled) this.descend(false); else this.hud.onMode('god'); }

  // ------------------------------------------------------------------ sol : blocs de 16 x 16 cases dessinés à la demande
  // (la ville est trop grande pour un seul canevas : iOS limite à ~16 millions de pixels ; on ne garde en mémoire que les blocs proches de la caméra)
  floorChunks = new Map<string, Phaser.GameObjects.Image>(); sunSprite!: Phaser.GameObjects.Image;
  private static CH = 16; private static FM = 8;
  private bakeFloor() { this.floorChunks.clear(); this.updateFloorChunks(99); this.bakeSun(); }
  /** Charge les blocs visibles (+1 bloc de marge), en décharge les lointains. `limit` : nombre maximal de blocs dessinés par image. */
  updateFloorChunks(limit = 2) {
    const CH = GameScene.CH, M = GameScene.FM; const cam = this.cameras.main; const wv = cam.worldView; const pad = this.lowQuality ? 380 : 600; const cxw = wv.centerX, cyw = wv.centerY;
    const nI = Math.ceil((L.W + 2 * M) / CH), nJ = Math.ceil((L.H + 2 * M) / CH); const want = new Set<string>(); const todo: { k: string; r: { a0: number; b0: number; a1: number; b1: number }; d: number; vis: boolean }[] = [];
    for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) {
      const r = { a0: -M + i * CH, b0: -M + j * CH, a1: -M + (i + 1) * CH, b1: -M + (j + 1) * CH };
      const x0 = toScreen(r.a0, r.b1).x - 64, x1 = toScreen(r.a1, r.b0).x + 64, y0 = toScreen(r.a0, r.b0).y - 8, y1 = toScreen(r.a1, r.b1).y + 40;
      if (x1 < wv.x - pad || x0 > wv.right + pad || y1 < wv.y - pad || y0 > wv.bottom + pad) continue;
      const k = `${i},${j}`; want.add(k); if (this.floorChunks.has(k)) continue;
      const vis = !(x1 < wv.x || x0 > wv.right || y1 < wv.y || y0 > wv.bottom); todo.push({ k, r, d: Math.hypot((x0 + x1) / 2 - cxw, (y0 + y1) / 2 - cyw), vis });
    }
    // les blocs les plus proches du centre d'abord ; si l'écran montre des blocs manquants (téléportation), on en dessine davantage d'un coup
    todo.sort((a, b) => a.d - b.d); const n = todo.some((t) => t.vis) ? Math.max(limit, 4) : limit;
    for (const t of todo.slice(0, n)) this.floorChunks.set(t.k, this.bakeChunk(t.r));
    for (const [k, img] of this.floorChunks) if (!want.has(k)) { const key = img.texture.key; img.destroy(); this.textures.remove(key); this.floorChunks.delete(k); }
  }
  private bakeChunk(r: { a0: number; b0: number; a1: number; b1: number }) {
    const W = L.W, H = L.H; const ox = toScreen(r.a0, r.b1).x - 64, oy = toScreen(r.a0, r.b0).y - 8;
    const wpx = toScreen(r.a1, r.b0).x + 64 - ox, hpx = toScreen(r.a1, r.b1).y + 40 - oy;
    const cv = canvas(Math.ceil(wpx), Math.ceil(hpx)); const g = ctx2(cv); g.translate(-ox, -oy);
    for (let cy = r.b0; cy < r.b1; cy++) for (let cx = r.a0; cx < r.a1; cx++) {
      const p = toScreen(cx, cy); const inside = cx >= 0 && cx < W && cy >= 0 && cy < H;
      if (inside) {
        let room = L.roomAt(cx, cy);
        if (room === '') {
          // sous un mur : le sol de la pièce voisine continue (on préfère l'intérieur à la rue)
          const cands: string[] = []; for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const r2 = L.roomAt(cx + dx, cy + dy); if (r2) cands.push(r2); }
          room = cands.find((q) => !L.OUTDOOR.includes(q)) ?? cands[0] ?? '';
          if (room === '') { g.globalAlpha = 0.9; g.drawImage(floorTile('concrete', 0), p.x - 32, p.y); g.globalAlpha = 1; continue; }
        }
        g.drawImage(floorTile(L.isDoor(cx, cy) ? FLOOR_STYLES.door : (this.world.homeStyle.floor[room] ?? FLOOR_STYLES[room]), (cx * 7 + cy * 13) % 3), p.x - 32, p.y);
      } else {
        const dx = Math.max(-cx, cx - (W - 1), 0), dy = Math.max(-cy, cy - (H - 1), 0); const dist = Math.hypot(dx, dy);
        let a = Math.max(0, Math.min(1, 1 - (dist - 1) / 6.5)); a *= a;
        if (a > 0.02) { g.globalAlpha = a; g.drawImage(floorTile((cy >= 19 && cy <= 22) || (cy >= 33 && cy <= 36) ? 'sidewalk' : 'grass', (cx * 5 + cy * 11) % 4), p.x - 32, p.y); g.globalAlpha = 1; }
      }
    }
    // marquages : bordures, lignes médianes, passages piétons (avenue, rue du Marché, rue Centrale)
    const gp = (x: number, y: number) => toScreen(x, y); const quad = (pts: number[][], col: string) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, i) => { const p = gp(q[0], q[1]); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); g.fill(); };
    const CURB = 'rgba(200,198,190,0.9)', DASH = 'rgba(235,205,110,0.95)', ZEB = 'rgba(235,235,230,0.9)';
    for (const [yc, yd, ye] of [[19.92, 20.96, 22.0], [33.92, 34.96, 36.0]]) { quad([[0, yc], [W, yc], [W, yc + 0.08], [0, yc + 0.08]], CURB); quad([[0, ye], [W, ye], [W, ye + 0.08], [0, ye + 0.08]], CURB); for (let x = 0; x < W; x += 2) quad([[x + 0.3, yd], [x + 1.4, yd], [x + 1.4, yd + 0.08], [x + 0.3, yd + 0.08]], DASH); }
    quad([[52.92, 0], [53.0, 0], [53.0, H], [52.92, H]], CURB); quad([[55.0, 0], [55.08, 0], [55.08, H], [55.0, H]], CURB);
    for (let y = 0; y < H; y += 2) if (!(y >= 18 && y <= 23) && !(y >= 32 && y <= 37)) quad([[53.96, y + 0.3], [54.04, y + 0.3], [54.04, y + 1.4], [53.96, y + 1.4]], DASH);
    for (const [x0, y0, y1] of [[14.1, 20.05, 21.95], [49.1, 20.05, 21.95], [56.0, 20.05, 21.95], [30.1, 34.05, 35.95], [49.1, 34.05, 35.95], [56.0, 34.05, 35.95], [78.1, 20.05, 21.95], [78.1, 34.05, 35.95]])
      for (let i = 0; i < 6; i++) quad([[x0 + i * 0.7, y0], [x0 + i * 0.7 + 0.4, y0], [x0 + i * 0.7 + 0.4, y1], [x0 + i * 0.7, y1]], ZEB);
    for (const [y0, x0, x1] of [[17.1, 53.05, 54.95], [23.0, 53.05, 54.95], [31.1, 53.05, 54.95], [37.0, 53.05, 54.95]])
      for (let i = 0; i < 5; i++) quad([[x0, y0 + i * 0.7], [x1, y0 + i * 0.7], [x1, y0 + i * 0.7 + 0.4], [x0, y0 + i * 0.7 + 0.4]], ZEB);
    for (const f of this.world.furn) if (f.flat) { const p = toScreen(f.x, f.y); g.drawImage(rugCanvas(f.w, f.d, f.opts.style ?? 0), p.x - f.d * 32, p.y); }
    const P = (o: { x: number; y: number }, dx: number, dy: number) => ({ x: o.x + dx, y: o.y + dy });
    const fill = (pts: { x: number; y: number }[], a: number) => { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.fill(); };
    for (let cy = Math.max(0, r.b0); cy < Math.min(H, r.b1); cy++) for (let cx = Math.max(0, r.a0); cx < Math.min(W, r.a1); cx++) {
      if (L.roomAt(cx, cy) === '') continue; const o = toScreen(cx, cy);
      if (L.isWall(cx, cy - 1)) { fill([o, P(o, 32, 16), P(o, 23, 20.5), P(o, -9, 4.5)], 0.16); fill([o, P(o, 32, 16), P(o, 12, 26), P(o, -20, 10)], 0.1); }
      if (L.isWall(cx - 1, cy)) { fill([o, P(o, -32, 16), P(o, -23, 20.5), P(o, 9, 4.5)], 0.16); fill([o, P(o, -32, 16), P(o, -12, 26), P(o, 20, 10)], 0.1); }
    }
    const TALL = ['wardrobe', 'fridge', 'bookshelf', 'coat_rack', 'stove', 'shower', 'floor_lamp', 'plant', 'sink_b', 'back_shelf', 'jukebox', 'streetlamp', 'tree', 'palm', 'parasol', 'bar_sign', 'shelf3', 'shelf4'];
    for (const f of this.world.furn) {
      if (!f.blocks || f.x > r.a1 + 1 || f.x + f.w < r.a0 || f.y > r.b1 + 1 || f.y + f.d < r.b0) continue; const k = TALL.includes(f.def) ? 1.8 : 1; const sh = { x: 7 * k, y: 3.5 * k };
      for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++) { const o = toScreen(f.x + i, f.y + j); fill([P(o, sh.x, sh.y), P(o, 32 + sh.x, 16 + sh.y), P(o, sh.x, 32 + sh.y), P(o, -32 + sh.x, 16 + sh.y)], 0.17); }
    }
    return this.add.image(ox, oy, texKey(this, cv)).setOrigin(0, 0).setDepth(-3000);
  }
  /** Taches de soleil des fenêtres de la maison (petit canevas : la maison seule, pas toute la ville). */
  private bakeSun() {
    const o = { x: toScreen(0, 8).x - 64, y: toScreen(0, 0).y - 8 }; const wpx = toScreen(31, 0).x + 64 - o.x, hpx = toScreen(31, 8).y + 40 - o.y;
    const sc = canvas(Math.ceil(wpx), Math.ceil(hpx)); const sg = ctx2(sc); sg.translate(-o.x, -o.y); sg.fillStyle = 'rgba(255,245,184,0.2)';
    for (const wx of WINDOWS_N) { const q = [toScreen(wx + 0.15, 1), toScreen(wx + 0.85, 1), toScreen(wx + 2.3, 3.4), toScreen(wx + 1.5, 3.4)]; sg.beginPath(); q.forEach((pt, i) => (i ? sg.lineTo(pt.x, pt.y) : sg.moveTo(pt.x, pt.y))); sg.closePath(); sg.fill(); }
    this.sunSprite = this.add.image(o.x, o.y, texKey(this, sc)).setOrigin(0, 0).setDepth(-2999).setAlpha(0);
  }
  private faceSpec(cx: number, cy: number, se: boolean, h: number): FaceSpec {
    const nx = se ? cx + 1 : cx, ny = se ? cy : cy + 1; const room = L.roomAt(nx, ny); const bld = L.buildingAt(cx, cy); const full = h === WALL_FULL;
    const spec: FaceSpec = { c: bld?.name === 'bar' ? BRICK : OUTSIDE, dec: 'none', tiled: false, art: 0 };
    const outdoor = room === '' || L.OUTDOOR.includes(room);
    // façade extérieure : la case voisine est hors du bâtiment
    if (bld && L.closable(bld) && bld.h && (nx < bld.x0 || nx > bld.x1 || ny < bld.y0 || ny > bld.y1) && h >= 40) {
      spec.c = WALLCOL[bld.wall ?? 'concrete']; if (se) spec.c = shade(spec.c, -0.15);
      spec.ext = this.extSpec(bld, cx, cy, se, h); return spec;
    }
    if (room && !outdoor) { const ov = this.world.homeStyle.wall[room]; const wv = ov ? Home.WALLS.find((q) => q.id === ov) : undefined; spec.c = wv ? c(wv.col[0], wv.col[1], wv.col[2]) : ROOM_COL[room]; spec.tiled = room === 'w' || room === 'C'; }
    if (se) spec.c = shade(spec.c, -0.15);
    if (!se && bld?.name === 'bar' && cy === bld.y0 && room === 'B' && [35, 41].includes(cx) && full) spec.dec = 'neon';
    if (full && room && !outdoor && bld?.name === 'house') {
      if (!se) { if (cy === 0 && WINDOWS_N.includes(cx)) spec.dec = 'window'; else if (PICTURES_SW.includes(`${cx},${cy}`)) { spec.dec = 'picture'; spec.art = cx; } }
      else if (cx === 0 && WINDOWS_W.includes(cy)) spec.dec = 'window'; else if (cx === 0 && cy === DOOR_W) spec.dec = 'door';
    }
    return spec;
  }
  /** Description d'une case de façade (matériau, vitrine ou fenêtres, affiches) : déterministe, donc stable entre deux sessions. */
  extSpec(b: L.Building, cx: number, cy: number, se: boolean, h: number): ExtSpec {
    const k = (b.kind === 'home' ? 'home' : b.kind) as ExtSpec['k']; const m = ({ brick: 'brick', concrete: 'concrete', beige: 'plaster', cream: 'plaster', blue: 'blue' } as Record<string, ExtSpec['m']>)[b.wall ?? 'concrete'];
    const front = !se; const rel = se ? cy - b.y0 : cx - b.x0; const len = se ? b.y1 - b.y0 : b.x1 - b.x0; const dh = hashStr(b.name);
    const dx = b.door ? Math.abs((front ? cx : cy) - (front ? b.door[0] : b.door[1])) : 99; const nearDoor = front && dx <= 1;
    const v = Math.floor(hash2(cx * 3 + 1, cy * 5 + 2, dh) * 16); let pane: ExtSpec['pane'] = 'none'; let poster = 0;
    const shopKind = k === 'store' || k === 'cafe' || k === 'bar';
    if (rel > 0 && rel < len) {
      if (shopKind) { if (front && !nearDoor && rel % 2 === 1) pane = 'shop'; else if (!front && rel % 3 === 1) pane = 'win'; }
      else if (rel % 3 === 1 && !nearDoor) pane = 'win';
    }
    if (pane === 'none' && !nearDoor) { const q = Math.floor(hash2(cx + 17, cy + 29, dh) * 9); poster = [0, 1, 0, 2, 0, 3, 0, 4, 0][q]; }
    return { m, k, pane, v, floors: storeys(h, k).floors, poster, cell: cx * 31 + cy * 17, awning: dh };
  }
  /** Bâtiment dans lequel se trouve le point d'attention (avatar en mode humain, habitant observé en mode Dieu) : ses murs avant s'abaissent, son toit disparaît. */
  insideBuilding = ''; peek = false;
  private wallHeight(cx: number, cy: number) {
    const b = L.buildingAt(cx, cy);
    if (b && L.closable(b)) {
      if (this.wallMode === 0) return WALL_LOW;
      if (this.wallMode === 2 || this.insideBuilding !== b.name) return b.h!;
      if (this.peek) return WALL_LOW;   // plan en coupe : on regarde ce qu'il y a derrière le bâtiment
      return cx === b.x0 || cy === b.y0 ? b.h! : WALL_LOW + 8;
    }
    if (this.wallMode === 2) return WALL_FULL; if (this.wallMode === 0) return WALL_LOW;
    if (!b) return WALL_LOW;
    if (cx === b.x0 || cy === b.y0) return WALL_FULL;
    return cx === b.x1 || cy === b.y1 ? b.front : WALL_LOW;
  }
  private buildWalls() {
    for (let cy = 0; cy < L.H; cy++) for (let cx = 0; cx < L.W; cx++) {
      if (!L.isWall(cx, cy)) continue;
      const s = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(zOf(cellKey(cx, cy))); this.walls.push({ s, x: cx, y: cy });
    }
    this.applyWalls();
  }
  applyWalls(only?: Set<string>) {
    this.doors?.invalidate();
    for (const wd of this.walls) {
      if (only) { const bb = L.buildingAt(wd.x, wd.y); if (!bb || !only.has(bb.name)) continue; }
      const h = this.wallHeight(wd.x, wd.y); let mask = 0;
      if (wd.x > 0 && L.isWall(wd.x - 1, wd.y)) mask |= 1; if (wd.y > 0 && L.isWall(wd.x, wd.y - 1)) mask |= 2;
      if (wd.x < L.W - 1 && L.isWall(wd.x + 1, wd.y)) mask |= 4; if (wd.y < L.H - 1 && L.isWall(wd.x, wd.y + 1)) mask |= 8;
      const cv = wallTex(h, mask, this.faceSpec(wd.x, wd.y, false, h), this.faceSpec(wd.x, wd.y, true, h), c(0.93, 0.91, 0.87));
      const p = toScreen(wd.x, wd.y); wd.s.setTexture(texKey(this, cv)).setPosition(p.x - 32, p.y - h);
    }
  }
  cycleWalls() { this.wallMode = (this.wallMode + 1) % 3; this.applyWalls(); return this.wallMode; }
  /** Redessine les meubles quand l'aménagement change (déplacement, rangement, achat). */
  furnSeen = 0; styleSeen = 0; profSeen = 0;
  /** Sols et murs de l'appartement modifiés : on redessine les blocs de sol et les murs du bâtiment concerné. */
  private refreshStyle() { this.styleSeen = this.world.styleVersion; for (const [k, img] of this.floorChunks) { const key = img.texture.key; img.destroy(); this.textures.remove(key); this.floorChunks.delete(k); } this.updateFloorChunks(99); this.applyWalls(new Set(['flats1'])); }
  private refreshFurniture() { for (const nodes of this.furnNodes.values()) nodes.forEach((n) => n.destroy()); this.furnNodes.clear(); this.buildFurniture(); this.furnSeen = this.world.furnVersion; }
  private buildFurniture() {
    for (const f of this.world.furn) {
      if (f.flat || f.gone) continue; const nodes: Phaser.GameObjects.Image[] = []; const style = f.opts.style ?? 0; let maxKey = 0;
      for (let j = 0; j < f.d; j++) for (let i = 0; i < f.w; i++) maxKey = Math.max(maxKey, cellKey(f.x + i, f.y + j));
      for (let j = 0; j < f.d; j++) for (let i = 0; i < f.w; i++) {
        const spr = furnSprite(f.def, style, i, j, f.w, f.d); const p = toScreen(f.x + i, f.y + j);
        nodes.push(this.add.image(p.x - 32, p.y - spr.pad, texKey(this, spr.canvas)).setOrigin(0, 0).setDepth(zOf(cellKey(f.x + i, f.y + j))));
        if (spr.overlay) nodes.push(this.add.image(p.x - 32, p.y - spr.pad, texKey(this, spr.overlay)).setOrigin(0, 0).setDepth(zOf(maxKey) + 3));
      }
      this.furnNodes.set(f.i, nodes);
    }
  }
  carNodes: Phaser.GameObjects.Image[][] = [];
  /** Voitures en circulation : 3 images par voiture (une par case), déplacées à chaque image. */
  private syncCars() {
    const tr = this.world.traffic; if (!tr) return;
    if (this.carNodes.length !== tr.cars.length) {
      this.carNodes.forEach((n) => n.forEach((i) => i.destroy())); this.carNodes = tr.cars.map((car) => [0, 1, 2].map((i) => { const spr = furnSprite(car.dir > 0 ? 'car_p' : 'car_w', car.style, i, 0, 3, 1); return this.add.image(0, 0, texKey(this, spr.canvas)).setOrigin(0, 0); }));
    }
    tr.cars.forEach((car, k) => {
      const nodes = this.carNodes[k]; const spr0 = furnSprite('car_p', 0, 0, 0, 3, 1);
      for (let i = 0; i < 3; i++) { const cx = car.x + i, p = toScreen(cx, car.lane); nodes[i].setPosition(p.x - 32, p.y - spr0.pad).setDepth(zOf(cellKey(Math.floor(car.x + 1.5), car.lane)) + 1).setVisible(!this.lowQuality && cx > -1 && cx < L.W + 1); }
    });
  }
  roofs: { b: L.Building; roof: Phaser.GameObjects.Image; sign: Phaser.GameObjects.Image | null; glow: Phaser.GameObjects.Image | null }[] = [];
  /** Style de toit par bâtiment : coque d'habitation à quatre pans, immeubles plats avec réservoirs, commissariat avec mât, panneaux publicitaires satiriques. */
  private roofPlan(b: L.Building): { style: RoofStyle; extras: string; ad: number } {
    const dh = hashStr(b.name);
    switch (b.kind) {
      case 'home': return { style: 'hip', extras: '', ad: -1 };
      case 'bar': return { style: 'flat', extras: 'ac', ad: 4 };
      case 'store': return { style: 'flat', extras: 'ac', ad: 0 };
      case 'cafe': return { style: 'flat', extras: 'ac', ad: 3 };
      case 'police': return { style: 'flat', extras: 'mast', ad: -1 };
      default: return { style: 'flat', extras: 'tank', ad: dh % 3 === 0 ? 1 + (dh % 5) : -1 };
    }
  }
  /** Toits, enseignes et fenêtres éclairées des bâtiments. Le toit s'efface quand on est dedans (ou en mode « murs bas »). */
  private buildRoofs() {
    this.roofs = []; this.insideBuilding = '';
    for (const b of L.BUILDINGS) {
      if (!L.closable(b)) continue; const w = b.x1 - b.x0 + 1, d = b.y1 - b.y0 + 1; const rp = this.roofPlan(b); const r = roofCanvas(w, d, b.roof ?? '#666666', b.x0 * 7 + b.y0, rp.style, rp.extras, rp.ad);
      const o = toScreen(b.x0, b.y0); const roof = this.add.image(o.x - d * 32 - 4, o.y - b.h! - 4 + r.oy, texKey(this, r.cv)).setOrigin(0, 0).setDepth(zOf(cellKey(b.x1, b.y1)) + 3);
      let sign: Phaser.GameObjects.Image | null = null;
      if (b.door && b.title) { const cv = signCanvas(b.h!, '#' + [WALLCOL[b.wall ?? 'concrete']].map((q) => q.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')).join(''), b.title); const p = toScreen(b.door[0], b.door[1]); sign = this.add.image(p.x - 32, p.y - b.h!, texKey(this, cv)).setOrigin(0, 0).setDepth(zOf(cellKey(b.door[0], b.door[1])) + 1); }
      this.roofs.push({ b, roof, sign, glow: this.buildGlow(b) });
    }
  }
  /** Fenêtres éclairées de nuit : un seul canevas par bâtiment (additif, au-dessus de la lumière ambiante), vitres allumées au hasard. */
  private buildGlow(b: L.Building): Phaser.GameObjects.Image | null {
    const h = b.h!; const x0 = toScreen(b.x0, b.y1 + 1).x - 16, x1 = toScreen(b.x1 + 1, b.y0).x + 16, y0 = toScreen(b.x0, b.y0).y - h - 8, y1 = toScreen(b.x1 + 1, b.y1 + 1).y + 8;
    const cv = canvas(Math.ceil(x1 - x0), Math.ceil(y1 - y0)); const g = ctx2(cv); let n = 0; const T1 = 0.65;
    const dh = hashStr(b.name);
    const quad = (pts: { x: number; y: number }[], col: string) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.fill(); };
    const cells: [number, number, boolean][] = []; for (let x = b.x0; x <= b.x1; x++) cells.push([x, b.y1, false]); for (let y = b.y0; y <= b.y1; y++) cells.push([b.x1, y, true]);
    for (const [cx, cy, se] of cells) {
      const sp = this.extSpec(b, cx, cy, se, h); if (sp.pane === 'none') continue;
      for (const [i, p] of panes(sp, h).entries()) {
        if (hash2(cx * 7 + i, cy * 3, dh) > (sp.pane === 'shop' ? 0.97 : b.kind === 'apartment' ? 0.62 : 0.4)) continue; // quelques vitres restent éteintes
        const at = (u: number, z: number) => { const q = se ? toScreen(cx + T1, cy + u) : toScreen(cx + u, cy + T1); return { x: q.x - x0, y: q.y - z - y0 - 0 }; };
        const col = sp.pane === 'shop' ? 'rgba(255,214,140,0.9)' : ['rgba(255,226,150,0.85)', 'rgba(255,200,120,0.85)', 'rgba(190,225,255,0.8)', 'rgba(255,170,200,0.75)'][Math.floor(hash2(cx, cy + i, dh + 3) * 4)];
        quad([at(p.u0 + 0.03, p.zb + 1), at(p.u1 - 0.03, p.zb + 1), at(p.u1 - 0.03, p.zt - 1), at(p.u0 + 0.03, p.zt - 1)], col); n++;
      }
    }
    if (!n) return null;
    return this.add.image(x0, y0, texKey(this, cv)).setOrigin(0, 0).setDepth(7900).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  }
  /** À chaque image : bâtiment occupé par le point d'attention → murs avant abaissés ; toits fondus ; blocs de sol chargés. */
  private updateCity(dt: number) {
    let name = ''; let peek = false; const a = this.world.avatar;
    const c = this.mode === 'human' ? a : this.selectedId >= 0 ? this.world.chars[this.selectedId] : null;
    if (c && !c.away) { const b = L.buildingAt(Math.floor(c.pos.x), Math.floor(c.pos.y)); if (L.closable(b)) name = b!.name; }
    else if (this.mode === 'god' && this.cz >= 0.72) {
      // sans personnage observé : le bâtiment qui masque le centre de l'écran s'ouvre comme une maison de poupée (le plus proche de la caméra l'emporte)
      let best = -1;
      for (const r of this.roofs) {
        const b = r.b; const ztop = b.h!; const dep = zOf(cellKey(b.x1, b.y1)); if (dep <= best) continue;
        const cxm = toScreen((b.x0 + b.x1 + 1) / 2, (b.y0 + b.y1 + 1) / 2); const hw = ((b.x1 - b.x0 + 1) + (b.y1 - b.y0 + 1)) * 16, hh = ((b.x1 - b.x0 + 1) + (b.y1 - b.y0 + 1)) * 8;
        for (let z = 0; z <= ztop; z += 10) { if (Math.abs(this.cx - cxm.x) / hw + Math.abs(this.cy + z - cxm.y) / hh <= 1) { best = dep; name = b.name; peek = true; break; } }
      }
    }
    if (name !== this.insideBuilding || peek !== this.peek) { const only = new Set([this.insideBuilding, name].filter(Boolean)); this.insideBuilding = name; this.peek = peek; this.applyWalls(only); }
    const k = 1 - Math.exp(-dt * 8); const dark = this.lighting.darkness;
    for (const r of this.roofs) {
      const open = r.b.name === this.insideBuilding || this.wallMode === 0; const t = open ? 0 : 1;
      r.roof.setAlpha(r.roof.alpha + (t - r.roof.alpha) * k).setVisible(r.roof.alpha > 0.02);
      if (r.sign) r.sign.setVisible(!open);
      if (r.glow) { const ga = open || this.lowQuality ? 0 : Math.min(1, dark * 1.3) * 0.85; r.glow.setAlpha(r.glow.alpha + (ga - r.glow.alpha) * k).setVisible(r.glow.alpha > 0.02); }
    }
    this.updateFloorChunks(2);
  }
  private buildDecor() {
    // arbres et buissons au-delà de la carte (les arbres du quartier sont de vrais meubles bloquants)
    const trees: number[][] = [[-3, 3], [-3, 14], [-3, 9], [10, -3], [20, -3], [34, -3], [45, -3], [-2, 21], [-3, 28], [-3, 36], [8, 43], [24, 43], [40, 43], [56, 43], [72, 43], [88, 43], [99, 4], [99, 14], [99, 28], [99, 36], [62, -3], [74, -3], [88, -3]];
    trees.forEach((t, i) => { const spr = furnSprite('tree', i, 0, 0, 1, 1); const p = toScreen(t[0], t[1]); this.add.image(p.x - 32, p.y - spr.pad, texKey(this, spr.canvas)).setOrigin(0, 0).setDepth(zOf(cellKey(t[0], t[1])) + 0); });
  }

  // ------------------------------------------------------------------ caméra
  mapRect() { const tl = toScreen(0, L.H), tr = toScreen(L.W, 0), br = toScreen(L.W, L.H); return { x: tl.x - 40, y: -WALL_FULL - 30, w: tr.x - tl.x + 80, h: br.y + WALL_FULL + 70 }; }
  houseRect() { const tl = toScreen(0, 19), tr = toScreen(29, 0), br = toScreen(29, 19); return { x: tl.x - 40, y: -WALL_FULL - 30, w: tr.x - tl.x + 80, h: br.y + WALL_FULL + 70 }; }
  fitCamera() {
    const r = this.houseRect(); const m = this.mapRect(); this.bounds = { x: m.x - 200, y: m.y - 200, w: m.w + 400, h: m.h + 400 };
    const small = this.scale.height < 520; const mob = this.hud?.mobile?.active; const z = mob ? Math.min(this.scale.width / r.w, this.scale.height / r.h) * 1.06 : Math.min(this.scale.width / r.w, (this.scale.height - (small ? 40 : 120)) / r.h); this.tz = this.cz = Math.max(this.minZoom, Math.min(this.maxZoom, z));
    this.tx = this.cx = r.x + r.w / 2; this.ty = this.cy = r.y + r.h / 2;
    this.cameras.main.setZoom(this.cz).centerOn(this.cx, this.cy);
  }
  /** Limites du centre de la caméra : la vue reste dans le monde (à une petite marge près) ; si le monde est plus petit que l'écran, la vue est centrée. */
  camLimits() {
    const m = this.mapRect(); const hw = this.scale.width / (2 * this.cz), hh = this.scale.height / (2 * this.cz); const mg = 48 / this.cz;
    let x0 = m.x + hw - mg, x1 = m.x + m.w - hw + mg, y0 = m.y + hh - mg, y1 = m.y + m.h - hh + mg;
    if (x0 > x1) x0 = x1 = m.x + m.w / 2; if (y0 > y1) y0 = y1 = m.y + m.h / 2;
    return { x0, x1, y0, y1 };
  }
  private clampCam() { const c = this.camLimits(); this.tx = Math.max(c.x0, Math.min(c.x1, this.tx)); this.ty = Math.max(c.y0, Math.min(c.y1, this.ty)); }
  zoomBy(f: number, mx?: number, my?: number) {
    const old = this.tz; this.tz = Math.max(this.minZoom, Math.min(this.maxZoom, this.tz * f));
    if (mx !== undefined && my !== undefined) { const ox = mx - this.scale.width / 2, oy = my - this.scale.height / 2; this.tx += ox * (1 / old - 1 / this.tz); this.ty += oy * (1 / old - 1 / this.tz); }
  }
  screenToWorld(sx: number, sy: number) { const cam = this.cameras.main; return { x: cam.worldView.x + sx / cam.zoom, y: cam.worldView.y + sy / cam.zoom }; }
  /** Position écran (px) du centre d'une case de la grille (utile aux tests et aux repères d'interface). */
  cellToScreen(gx: number, gy: number) { const p = toScreen(gx, gy); return this.worldToScreen(p.x, p.y); }
  worldToScreen(wx: number, wy: number) { const cam = this.cameras.main; return { x: (wx - cam.worldView.x) * cam.zoom, y: (wy - cam.worldView.y) * cam.zoom }; }
  focusChar(id: number) { const cv = this.chars[id]; this.tx = cv.x; this.ty = cv.y - 20; this.tz = Math.max(this.tz, 1.4); }

  private setupInput() {
    this.input.addPointer(1);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (Nav.blocksWorld()) { this.pan = { ...this.pan, down: false, moved: true }; return; } this.pan = { down: true, moved: false, sx: p.x, sy: p.y, button: p.button, t: performance.now() }; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const wp = this.screenToWorld(p.x, p.y); this.hoverId = this.charAt(wp.x, wp.y);
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) { const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y); if (this.pinch > 0) this.zoomBy(d / this.pinch, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2); this.pinch = d; this.pan.moved = true; return; }
      this.pinch = 0;
      if (!this.pan.down) return;
      const dx = p.x - p.prevPosition.x, dy = p.y - p.prevPosition.y;
      if (!this.pan.moved && Math.hypot(p.x - this.pan.sx, p.y - this.pan.sy) < 6 && this.pan.button === 0) return;
      this.pan.moved = true; if (this.mode === 'human') return; this.follow = false; this.tx -= dx / this.cz; this.ty -= dy / this.cz;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (Nav.blocksWorld()) { this.pan = { ...this.pan, down: false }; return; }
      this.pinch = 0; const was = this.pan; this.pan = { ...this.pan, down: false };
      if (was.moved || was.button !== 0) return;
      const wp = this.screenToWorld(p.x, p.y); const id = this.charAt(wp.x, wp.y); const now = performance.now();
      const dbl = id >= 0 && this.lastClick.id === id && now - this.lastClick.t < 350; this.lastClick = { t: now, id };
      if (this.mode === 'human') { this.humanTap(wp.x, wp.y); return; }
      this.hud.onWorldClick(id, p.x, p.y); if (dbl && id >= 0) this.selectChar(id, true);
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const ev = (p as any).event as WheelEvent | undefined; const k = ev?.ctrlKey ? 0.012 : 0.0015; this.zoomBy(Math.exp(-dy * k), p.x, p.y);
    });
    window.addEventListener('keydown', (e) => this.onKey(e, true)); window.addEventListener('keyup', (e) => this.onKey(e, false));
    // pincement trackpad Safari (macOS)
    let gs = 1; window.addEventListener('gesturestart', (e: any) => { e.preventDefault(); gs = 1; }); window.addEventListener('gesturechange', (e: any) => { e.preventDefault(); this.zoomBy(e.scale / gs, this.scale.width / 2, this.scale.height / 2); gs = e.scale; });
  }
  private onKey(e: KeyboardEvent, down: boolean) {
    const k = e.key.toLowerCase(); if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    if (!down) { this.keys.delete(k); this.syncInput(); return; }
    this.keys.add(k); this.syncInput(); if (e.repeat) return;
    if (this.hud.dialogueOpen() && /^[1-9]$/.test(k)) { this.hud.pickDialogue(Number(k) - 1); return; }
    if (this.hud.contextOpen() && /^[1-9]$/.test(k)) { this.hud.pickContext(Number(k) - 1); return; }
    switch (k) {
      case 'g': this.toggleMode(); break;
      case 'e': if (this.mode === 'human') this.interact(); break;
      case 'enter': this.actionA(); break; case 'b': this.actionB(); break;
      case 'i': if (this.mode === 'human') this.hud.toggleInventory(); break;
      case ' ': if (!this.hud.dialogueOpen()) this.setSpeed(this.speedIndex === 0 ? 1 : 0); break;
      case '1': if (this.mode === 'god') this.hud.pickPower('bless'); break; case '2': if (this.mode === 'god') this.hud.pickPower('whisper'); break; case '3': if (this.mode === 'god') this.hud.pickPower('fate'); break; case '4': if (this.mode === 'god') this.hud.pickPower('feast'); break;
      case 'f': this.toggleFollow(); break; case 'c': if (this.selectedId >= 0) this.hud.fiche.open(this.selectedId); break; case 'j': this.hud.journal.toggle(); break;
      case 'tab': if (this.mode === 'god') this.selectChar((this.selectedId + 1) % this.world.residents.length, true); break;
      case 'v': { const m = this.cycleWalls(); this.hud.toast('Murs : ' + ['bas', 'coupés', 'hauts'][m]); break; }
      case 'f5': e.preventDefault(); this.saveGame(); break; case 'f9': e.preventDefault(); this.loadGame(); break;
      case 'escape': this.hud.escape(); break; case 'h': case 'f1': this.hud.toggleHelp(); break; case 'f3': this.hud.toggleFps(); break;
      case '[': this.setSpeed(this.speedIndex - 1); break; case ']': this.setSpeed(this.speedIndex + 1); break;
    }
  }
  /** Touches virtuelles (croix directionnelle tactile) : mêmes effets que le clavier, appuis simultanés cumulés. */
  /** Joystick virtuel : vecteur écran (x droite, y bas) de longueur 0..1. Appliqué immédiatement (sans attendre l'image suivante). */
  setAnalog(x: number, y: number, mag: number) { this.analog = { x, y, mag: Math.min(1, mag * Settings.get().joy) }; this.syncInput(); }
  setVirtualKey(k: string, down: boolean) { if (down) this.keys.add(k); else this.keys.delete(k); this.syncInput(); }
  /** Bouton A : action principale. Humain : interagir. Dieu : choisir le personnage visé (puis fiche / pouvoir armé). */
  actionA() {
    if (Nav.blocksWorld()) return;
    if (this.hud.dialogueOpen()) return;
    if (this.mode === 'human') { this.interact(); return; }
    let id = this.selectedId;
    if (id < 0 || !this.hud.powerMode) { const near = this.nearestToCenter(); if (near >= 0) { if (near === this.selectedId && !this.hud.powerMode) { this.hud.mobile.openFiche(); return; } id = near; } }
    if (id < 0) { this.hud.toast('Rien à sélectionner ici'); return; }
    if (this.hud.powerMode) { this.hud.onWorldClick(id, this.scale.width / 2, this.scale.height / 2); return; }
    this.selectChar(id);
  }
  /** Bouton B : action secondaire. Humain : inventaire. Dieu : menu des pouvoirs (ou annule le pouvoir armé). */
  actionB() {
    if (Nav.back()) return;                 // B ferme / revient en arrière quand une fenêtre est ouverte
    if (this.hud.dialogueOpen()) { this.hud.closeDialogue(); return; }
    if (this.mode === 'human') { this.hud.toggleInventory(); return; }
    if (this.hud.powerMode) { this.hud.escape(); return; }
    this.hud.mobile.active ? this.hud.mobile.openPowers() : this.hud.toast('Pouvoirs : touches 1 à 4');
  }
  actionAHold() {
    if (this.mode === 'human') { const l = Act.nearby(this.world, this.world.avatar); if (l.length) this.hud.showContext(l); else this.hud.toast('Rien à faire ici'); return; }
    if (this.selectedId >= 0) this.toggleFollow(); else this.hud.toast('Choisissez d\'abord un habitant (A)');
  }
  actionBHold() { if (this.mode === 'human') { this.runLatch = !this.runLatch; this.hud.toast(this.runLatch ? 'Course activée' : 'Course désactivée'); } else if (this.hud.mobile.lastPower) this.hud.pickPower(this.hud.mobile.lastPower); }
  /** Branche les événements de la criminalité sur l'interface (bandeau d'arrestation, libération). */
  private hookCrime() {
    this.world.onArrest = (o, fine, min) => { this.hud.cityHud.show(`ARRESTATION<br><span style="font-size:13px;font-weight:400">${o.first} vous arrête — amende ${fine} €, ${min} min en garde à vue</span>`, 4); this.hud.closeDialogue(); };
    this.world.onJailEnd = () => this.hud.toast('Vous êtes libéré(e). Faites attention à vos fréquentations…');
  }
  nearestToCenter(): number {
    const cam = this.cameras.main; const cx = cam.worldView.centerX, cy = cam.worldView.centerY; let best = -1, bd = 1e9;
    for (const cv of this.chars) { if (!['resident', 'citizen', 'police', 'clerk'].includes(cv.sim.kind) || cv.sim.away) continue; const d = Math.hypot(cv.x - cx, cv.y - 20 - cy) * cam.zoom; if (d < bd && d < 180) { bd = d; best = cv.sim.id; } }
    return best;
  }
  /** Entrées du mode humain lues à chaque événement clavier (réactif même si l'affichage ralentit). */
  syncInput() {
    if (this.mode !== 'human') return; const K = this.keys;
    const ix = (K.has('d') || K.has('arrowright') ? 1 : 0) - (K.has('a') || K.has('q') || K.has('arrowleft') ? 1 : 0); const iy = (K.has('s') || K.has('arrowdown') ? 1 : 0) - (K.has('w') || K.has('z') || K.has('arrowup') ? 1 : 0);
    const an = this.analog; const useAn = !ix && !iy && an.mag > 0;
    this.world.input = this.hud.dialogueOpen() ? { dx: 0, dy: 0, run: false } : useAn ? { dx: an.x, dy: an.y, run: this.runLatch, mag: an.mag } : { dx: ix, dy: iy, run: K.has('shift') || this.runLatch, mag: 1 };
  }
  charAt(wx: number, wy: number): number {
    let best = -1, bd = 1e9;
    for (const cv of this.chars) { const r = cv.hitRect(); if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) { const d = Math.hypot(wx - cv.x, wy - (cv.y - 20)); if (d < bd) { bd = d; best = cv.sim.id; } } }
    return best;
  }
  selectChar(id: number, focus = false) { if (id >= 0 && this.mode === 'god') Quests.emit(this.world, 'observe'); this.selectedId = id; this.hud.onSelect(id); if (id >= 0 && focus) { this.follow = false; this.focusChar(id); } }
  // ------------------------------------------------------------------ modes DIEU / HUMAIN
  /** Mode Dieu → Descendre à l'endroit regardé : l'avatar apparaît sur la case libre la plus proche du centre de la vue. */
  descendHere() {
    const g = toGrid(this.cx, this.cy); const cell = this.world.nearestFreeCell({ x: Math.floor(g.x), y: Math.floor(g.y) }, 6); if (cell.x < 0) { this.hud.toast('Aucun endroit libre ici'); return; }
    const av = this.world.avatar; if (av.state === 'use') this.world.endUse(av, false); this.world.abortPlan(av, 'descend'); av.pos = { x: cell.x + 0.5, y: cell.y + 0.5 }; av.away = false; av.state = 'idle'; this.mode === 'god' ? this.descend(true) : (this.tx = this.cx = this.chars[av.id].x);
  }
  toggleMode() { if (this.mode === 'god') this.descend(true); else this.ascend(true); }
  descend(flash = true) {
    const w = this.world; this.mode = 'human'; w.avatarControlled = true; this.selectChar(-1); Quests.emit(w, 'descend'); this.follow = false; this.hud.cancelPower();
    const av = w.avatar; if (av.away) av.away = false; this.hud.onMode('human'); if (flash) this.hud.flash('descend'); this.tz = Math.max(2.0, Math.min(this.tz, 2.4)); const cv = this.chars[av.id]; if (cv) { this.tx = cv.x; this.ty = cv.y - 20; }
    this.hud.toast(this.hud.mobile?.active ? 'Croix : marcher · A : agir · B : inventaire' : 'Vous êtes descendu parmi eux — ZQSD pour marcher, E pour interagir');
  }
  /** INCARNER : prend possession de l'habitant `id` (même monde, même simulation) et passe en vue humaine sur son corps. */
  incarnate(id: number) {
    const w = this.world; const r = Possess.start(w, id); if (!r.ok) { this.hud.toast(r.msg); return false; }
    this.mode = 'human'; w.avatarControlled = true; this.selectChar(-1); this.follow = false; this.hud.cancelPower(); this.hud.onMode('human'); this.hud.flash('descend');
    const cv = this.chars[id]; this.tz = Math.max(2.0, Math.min(this.tz, 2.4)); if (cv) { this.tx = cv.x; this.ty = cv.y - 20; } this.hud.toast(`${r.msg} Quittez son corps avec « Redevenir dieu » : il reprendra sa vie.`); return true;
  }
  ascend(flash = true) {
    if (this.world.possess) { const r = Possess.end(this.world); if (r.msg) this.hud.toast(r.msg); }
    const w = this.world; this.mode = 'god'; w.avatarControlled = false; Quests.emit(w, 'god'); w.input = { dx: 0, dy: 0, run: false }; this.hud.closeDialogue(); this.hud.onMode('god'); if (flash) this.hud.flash('ascend');
    const r = this.houseRect(); this.tz = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(this.scale.width / r.w, (this.scale.height - 120) / r.h) * 1.1)); const cv = this.chars[w.avatar.id]; this.tx = cv ? cv.x : this.tx; this.ty = cv ? cv.y - 60 : this.ty;
    this.hud.toast('Vous reprenez votre place de dieu. L\'avatar reste là où vous l\'avez laissé.');
  }
  focusZone(z: 'house' | 'bar' | 'street' | 'downtown' | 'park') { this.follow = false; const t = z === 'downtown' ? { x: 75, y: 21, z: 0.8 } : z === 'park' ? { x: 24, y: 29, z: 0.8 } : z === 'house' ? { x: 14, y: 9, z: 0.95 } : z === 'bar' ? { x: 40, y: 13, z: 1.35 } : { x: 26, y: 20.5, z: 0.8 }; const p = toScreen(t.x, t.y); this.tx = p.x; this.ty = p.y; this.tz = t.z; }
  /** Le joueur peut-il parler à ce personnage depuis sa position (à portée et sans mur entre eux) ? */
  canTalkTo(id: number) { return Act.nearby(this.world, this.world.avatar).some((i) => i.npc?.id === id); }
  interact() {
    const w = this.world; const av = w.avatar; if (this.hud.dialogueOpen()) return; const list = Act.nearby(w, av);
    if (!list.length) { this.hud.toast('Rien à faire ici'); return; }
    if (list.length === 1 || list[1].d - list[0].d > 0.6) this.doInteract(list[0]); else this.hud.showContext(list);
  }
  doInteract(it: Act.Interactable) {
    const av = this.world.avatar; this.hud.hideContext();
    if (it.kind === 'sheet') { this.hud.fiche.open(it.npc!.id); return; }
    if (it.kind === 'home') {
      if (it.act === 'outfit') { openCreator(this, { mode: 'edit', cat: 'cloth', onDone: () => {}, onCancel: () => {} }); return; }
      if (it.act === 'rotate') { this.hud.toast(Home.rotate(this.world, it.furn!).msg); return; }
      if (it.act === 'stash') { const r = Home.stash(this.world, it.furn!); this.hud.toast(r.msg); } else { this.world.homeEdit = { mode: 'move', furn: it.furn! }; this.hud.toast(`Touchez la case où poser : ${Home.label(this.world.furn[it.furn!].def)} (Échap : annuler)`); }
      return;
    }
    if (it.kind === 'npc') { av.facing = this.world.dirFrom({ x: it.npc!.pos.x - av.pos.x, y: it.npc!.pos.y - av.pos.y }, av.facing); this.hud.openDialogue(it.npc!); } else Act.useFurniture(this.world, av, it);
  }
  /** Toucher en mode humain : PNJ, meuble ou sol. La décision est prise par la simulation (Act.planTap) ; ici on ne fait qu'exécuter. */
  humanTap(wx: number, wy: number) {
    if (this.hud.dialogueOpen()) return; this.hud.hideContext();
    if (this.world.homeEdit) { this.applyHomeEdit(wx, wy); return; }
    if (this.world.decoMode) { const h = pickProp(this, wx, wy); if (h.furn !== undefined && Home.isMovable(this.world.furn[h.furn])) { this.world.homeEdit = { mode: 'move', furn: h.furn }; this.hud.toast(`Touchez la case de destination : ${Home.label(this.world.furn[h.furn].def)}`); } return; }
    const w = this.world, av = w.avatar; const id = this.charAt(wx, wy); let target: Act.TapTarget;
    if (id >= 0 && id !== av.id) target = { npc: id };
    else { const hit = pickProp(this, wx, wy); if (hit.furn !== undefined && Act.furnitureOptions(w, hit.furn).length > 0) target = { furn: hit.furn }; else { if (hit.furn !== undefined) this.hud.toast('Rien à faire avec ça.'); const g = toGrid(wx, wy); target = { cell: { x: Math.floor(g.x), y: Math.floor(g.y) } }; } }
    this.runPlan(Act.planTap(w, av, target));
  }
  /** Mode aménagement : le prochain toucher sur le sol pose (ou déplace) le meuble choisi. */
  private applyHomeEdit(wx: number, wy: number) {
    const w = this.world, e = w.homeEdit!; const g = toGrid(wx, wy); const cx = Math.floor(g.x), cy = Math.floor(g.y);
    const r = e.mode === 'move' ? Home.moveFurn(w, e.furn, cx, cy) : Home.place(w, e.def, cx, cy); this.hud.toast(r.msg); if (r.ok) w.homeEdit = null;
  }
  runPlan(plan: Act.TapPlan) {
    const w = this.world, av = w.avatar;
    switch (plan.kind) {
      case 'none': if (plan.msg) this.hud.toast(plan.msg); break;
      case 'walk': this.walkTo(plan.cell); break;
      case 'talk': this.doInteract({ kind: 'npc', label: '', d: 0, npc: plan.npc }); break;
      case 'approach': this.dest = null; Act.walkToNpc(w, av, plan.npc); break;
      case 'use': this.markDest(plan.item.stand!); this.doInteract(plan.item); break;
      case 'menu': this.hud.showContext(plan.items); break;
    }
  }
  /** Déplacement automatique vers une case (chemin A*, lissé) avec repère de destination. */
  walkTo(cell: { x: number; y: number }) {
    const w = this.world; const av = w.avatar; if (av.state !== 'idle') w.abortPlan(av, 'tap'); av.plan = [{ type: 'goto', cell }]; w.startNextStep(av); this.markDest(cell);
  }
  groundClick(wx: number, wy: number) { const g = toGrid(wx, wy); this.runPlan(Act.planTap(this.world, this.world.avatar, { cell: { x: Math.floor(g.x), y: Math.floor(g.y) } })); }
  markDest(cell: { x: number; y: number }) { this.dest = { x: cell.x + 0.5, y: cell.y + 0.5, t0: this.fxT, fade: 0 }; }
  /** Suivre (ou ne plus suivre) avec la caméra l'habitant sélectionné. */
  followSelected() { if (this.selectedId < 0) { this.hud.toast('Choisissez d\'abord un habitant'); return; } this.follow = !this.follow; this.hud.toast(this.follow ? `Caméra : suit ${this.world.chars[this.selectedId].first}` : 'Caméra : libre'); this.hud.onFollow?.(); }
  toggleFollow() { this.follow = !this.follow; this.hud.toast('Caméra : ' + (this.follow ? 'suit le personnage' : 'libre')); }
  setSpeed(i: number) { this.speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, i)); this.hud?.onSpeed(this.speedIndex); }
  saveGame() { const ok = Save.save(this.world); this.hud.toast(ok ? 'Partie sauvegardée' : 'Échec de la sauvegarde'); return ok; }
  async exportGame() { try { const r = await exportToFile(this.world); if (r !== 'cancelled') this.hud.toast(r === 'shared' ? 'Sauvegarde exportée' : 'Fichier de sauvegarde téléchargé'); } catch { this.hud.toast('Export impossible'); } }
  async importGame() {
    const text = await pickFile(); if (text === null) return;
    const r = Save.parseImport(text); if (!r.ok) { this.hud.toast('Import refusé : ' + r.error); return; }
    if (!window.confirm(`Importer cette partie (jour ${r.summary.day}, ${r.summary.residents} habitants) ? La partie actuelle sera remplacée (une copie de secours est gardée).`)) return;
    Save.save(this.world); // l'état courant passe dans le slot, puis commitImport le range en secours
    if (!Save.commitImport(r.payload)) { this.hud.toast('Import impossible (stockage plein ?)'); return; }
    const w = Save.load(); if (!w) { this.hud.toast('Import échoué'); return; }
    this.replaceWorld(w); this.hud.toast('Partie importée');
  }
  restoreBackup() { const w = Save.restoreBackup(); if (!w) { this.hud.toast('Aucune copie de secours'); return; } this.replaceWorld(w); Save.save(w); this.hud.toast('Copie de secours restaurée'); }
  /** Démonstration LIVING NORIA : petite situation de départ (vol, témoin, rumeur, confrontation) puis vie autonome. N'écrase pas la sauvegarde : l'autosave est suspendue. */
  startDemo() {
    Save.save(this.world); const w = new World(1337); w.build(); setupNoriaDemo(w); this.demo = true; this.demoKind = 'theft'; this.replaceWorld(w); this.setSpeed(3); this.focusZone('house');
    this.hud.toast('Démo LIVING NORIA (x3) — votre partie est sauvegardée, l\'autosave est suspendue');
  }
  /** Démo vivante (A routine, B besoin urgent, C interaction spontanée). N'écrase pas la sauvegarde : l'autosave est suspendue. */
  startTrio() {
    Save.save(this.world); const w = new World(1337); w.build(); setupTrioDemo(w); this.demo = true; this.demoKind = 'trio'; this.replaceWorld(w); this.setSpeed(2); this.focusTrio(); this.hud.demoGuide.reset();
    this.hud.toast('Démo vivante (x2) — touchez A, B ou C pour suivre un habitant. Votre partie est sauvegardée.');
  }
  focusTrio() { this.follow = false; const p = toScreen(10.5, 14); this.tx = this.cx = p.x; this.ty = this.cy = p.y; this.tz = this.cz = 0.95; this.selectChar(-1); }
  loadGame() { const w = Save.load(); if (!w) { this.hud.toast('Aucune sauvegarde'); return false; } this.demo = false; this.demoKind = ''; this.replaceWorld(w); this.hud.toast('Partie chargée'); return true; }

  // ------------------------------------------------------------------ boucle
  private lastNow = performance.now();
  update() {
    // Horloge propre : le delta de Phaser est plafonné quand l'affichage est lent, pas la simulation
    const now = performance.now(); const real = Math.min((now - this.lastNow) / 1000, 1.0); this.lastNow = now; const dt = Math.min(real, 0.25); const sp = SPEEDS[this.speedIndex]; let remaining = real * sp, guard = 0;
    // la simulation suit le temps réel même si l'affichage ralentit (ex. rendu logiciel)
    while (remaining > 1e-4 && guard < 100) { const step = Math.min(remaining, 0.1); this.world.tick(step); remaining -= step; guard++; }
    // clavier
    const K = this.keys;
    if (this.mode === 'human') {
      this.syncInput();
    }
    let vx = 0, vy = 0; if (this.mode === 'god') { if (K.has('a') || K.has('q') || K.has('arrowleft')) vx -= 1; if (K.has('d') || K.has('arrowright')) vx += 1; if (K.has('w') || K.has('z') || K.has('arrowup')) vy -= 1; if (K.has('s') || K.has('arrowdown')) vy += 1; }
    if (this.mode === 'god' && !vx && !vy && this.analog.mag > 0) { vx = this.analog.x * this.analog.mag; vy = this.analog.y * this.analog.mag; }
    if (vx || vy) { this.follow = false; const n = Math.max(1, Math.hypot(vx, vy)); this.tx += (vx / n) * 620 * dt / this.cz; this.ty += (vy / n) * 620 * dt / this.cz; }
    if (K.has('-')) this.zoomBy(1 - 1.4 * dt); if (K.has('=') || K.has('+') || K.has('e')) this.zoomBy(1 + 1.4 * dt);
    if (this.mode === 'human' && this.world.decoMode) { const c0 = toScreen(62.5, 27.5); this.tx = c0.x + (this.scale.width * 0.26) / this.tz; this.ty = c0.y - 6; }     // décoration : l'appartement se place dans la moitié gauche, hors du panneau
    else if (this.mode === 'human') { const cv = this.chars[this.world.avatar.id]; this.tx = cv.x; this.ty = cv.y - 24; }
    else if (this.follow && this.selectedId >= 0) { const cv = this.chars[this.selectedId]; this.tx = cv.x; this.ty = cv.y - 20; }
    this.clampCam(); const k = 1 - Math.exp(-dt * (this.mode === 'human' ? 8 : 9)); this.cx += (this.tx - this.cx) * k; this.cy += (this.ty - this.cy) * k; this.cz += (this.tz - this.cz) * k;
    { const c = this.camLimits(); this.cx = Math.max(c.x0, Math.min(c.x1, this.cx)); this.cy = Math.max(c.y0, Math.min(c.y1, this.cy)); }
    const cam = this.cameras.main; cam.setZoom(this.cz); cam.centerOn(Math.round(this.cx * this.cz) / this.cz, Math.round(this.cy * this.cz) / this.cz);
    // vue
    this.syncProps(); this.syncFeast(); this.syncPlants(); this.doors.update(dt); this.updateCity(dt); this.syncCars(); if (this.profSeen !== this.world.profileVersion) { this.profSeen = this.world.profileVersion; this.chars[this.world.avatar.id]?.refreshLook(); } if (this.furnSeen !== this.world.furnVersion) this.refreshFurniture(); if (this.styleSeen !== this.world.styleVersion) this.refreshStyle();
    for (const cv of this.chars) cv.update(dt, cv.sim.id === this.selectedId || (this.mode === 'human' && cv.sim.kind === 'avatar'), cv.sim.id === this.hoverId, Math.max(1, Math.min(SPEEDS[this.speedIndex], 3)));
    this.lighting.update(dt); this.wfx?.update(dt); this.sea?.update(dt); this.lighting.render(); this.sunSprite.setAlpha(this.lighting.daylight * 0.9);
    this.drawFx(dt); this.hud.update(dt);
    { const a = this.world.avatar; const f = this.mode === 'human' ? a.pos : toGrid(this.cx, this.cy); this.world.focus = { x: f.x, y: f.y }; } // simulation détaillée près du joueur
    this.autosave += dt; if (this.autosave > 120) { this.autosave = 0; if (!this.demo) Save.save(this.world); }
  }
  private syncProps() {
    const alive = new Set<number>();
    for (const m of this.world.mess) {
      alive.add(m.id);
      if (!this.propNodes.has(m.id)) {
        const spr = furnSprite('m_' + m.kind, m.id % 3, 0, 0, 1, 1); const p = toScreen(m.pos.x - 0.5, m.pos.y - 0.5);
        const img = this.add.image(p.x - 32, p.y - spr.pad - m.elev, texKey(this, spr.canvas)).setOrigin(0, 0);
        img.setDepth(m.elev > 0 ? zOf(cellKey(Math.floor(m.pos.x), Math.floor(m.pos.y))) + 2 : zOf((m.pos.x + m.pos.y) * 16 - 6)); this.propNodes.set(m.id, img);
      }
    }
    for (const [id, n] of this.propNodes) if (!alive.has(id)) { n.destroy(); this.propNodes.delete(id); }
  }
  private syncFeast() {
    const active = this.world.feastActive(); const ti = this.world.furnById.get('table');
    if (active && this.feastNodes.length === 0 && ti !== undefined) {
      const t = this.world.furn[ti]; const kinds = ['m_feast0', 'm_feast1', 'm_feast2']; let n = 0;
      for (let j = 0; j < t.d; j++) for (let i = 0; i < t.w; i++) { const spr = furnSprite(kinds[n % 3], 0, 0, 0, 1, 1); const p = toScreen(t.x + i, t.y + j); this.feastNodes.push(this.add.image(p.x - 32, p.y - spr.pad - 25, texKey(this, spr.canvas)).setOrigin(0, 0).setDepth(zOf(cellKey(t.x + i, t.y + j)) + 2)); n++; }
    } else if (!active && this.feastNodes.length) { this.feastNodes.forEach((s) => s.destroy()); this.feastNodes = []; }
  }
  private syncPlants() {
    for (const f of this.world.furn) if (f.def === 'plant') { const dry = Math.max(0, Math.min(1, 1 - f.water / 100)); const col = Phaser.Display.Color.GetColor(255, 255 - dry * 0.9 * 18, 255 - dry * 0.9 * 90); for (const s of this.furnNodes.get(f.i) ?? []) s.setTint(col); }
  }
  private drawFx(dt: number) {
    this.fxT += dt; const g = this.fx; g.clear(); const t = this.fxT;
    if (this.world.decoMode) { // grille de placement de l'appartement : cases libres (violet) / occupées (rouge discret)
      g.lineStyle(1, 0xa78bfa, 0.55);
      for (let y = Home.APT.y0; y <= Home.APT.y1; y++) for (let x = Home.APT.x0; x <= Home.APT.x1; x++) {
        if (!Home.inApartment(x, y)) continue; const p = toScreen(x, y); const busy = this.world.furnAt(x, y) >= 0 || L.isWall(x, y);
        g.fillStyle(busy ? 0xff5a5a : 0x8f6bff, busy ? 0.12 : 0.1); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 32, p.y + 16); g.lineTo(p.x, p.y + 32); g.lineTo(p.x - 32, p.y + 16); g.closePath(); g.fillPath(); g.strokePath();
      }
    }
    { const d = this.dest; // repère de destination : anneau discret qui pulse pendant le trajet, s'efface à l'arrivée ou à l'annulation
      if (d) {
        const av = this.world.avatar; const going = av.state === 'walk' || av.plan.length > 0 || (av.state === 'enter');
        if (!going) d.fade += dt / 0.35; if (d.fade >= 1 || this.mode !== 'human') this.dest = null;
        else { const p = toScreen(d.x, d.y); const pul = 1 + 0.12 * Math.sin((t - d.t0) * 7); const a = (1 - d.fade) * 0.9; g.lineStyle(2, 0xfccd5c, a); g.strokeEllipse(p.x, p.y, 30 * pul, 15 * pul); g.lineStyle(1, 0xffffff, a * 0.6); g.strokeEllipse(p.x, p.y, 14 * pul, 7 * pul); g.fillStyle(0xfccd5c, a * 0.9); g.fillCircle(p.x, p.y, 2); }
      } }
    { // trajet de l'habitant observé : pointillés animés jusqu'à sa destination (ce qu'il va faire, d'après son plan réel)
      const c = this.selectedId >= 0 ? this.world.chars[this.selectedId] : null;
      if (!(c && !c.away && c.state === 'walk' && c.path.length > c.path_i)) this.trailDots = 0;
      if (c && !c.away && c.state === 'walk' && c.path.length > c.path_i) {
        const pts = [{ x: c.pos.x, y: c.pos.y }, ...c.path.slice(c.path_i)]; const ph = (t * 14) % 9; this.trailDots = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = toScreen(pts[i].x, pts[i].y), b = toScreen(pts[i + 1].x, pts[i + 1].y); const len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 1) continue;
          for (let d = (i === 0 ? ph : 0); d < len; d += 9) { g.fillStyle(0x7fd9ff, 0.8); g.fillCircle(a.x + ((b.x - a.x) * d) / len, a.y + ((b.y - a.y) * d) / len, 1.7); this.trailDots++; }
        }
        const e = toScreen(pts[pts.length - 1].x, pts[pts.length - 1].y); const pul = 1 + 0.1 * Math.sin(t * 6); g.lineStyle(2, 0x7fd9ff, 0.95); g.strokeEllipse(e.x, e.y, 26 * pul, 13 * pul); g.fillStyle(0x7fd9ff, 0.9); g.fillCircle(e.x, e.y, 2.2);
      }
    }
    for (const f of this.world.furn) {
      if (f.users.length && f.users[0] === -1) continue;
      if (f.def === 'shower') {
        const head = toScreen(f.x + 0.5, f.y + 0.28); head.y -= 60;
        for (let k = 0; k < 9; k++) { const u = (t * 2.2 + k * 0.29) % 1; const x = head.x + (k - 4) * 2.6, y = head.y + u * 58 + (k % 3) * 2; g.lineStyle(1, 0xb8e6ff, 0.75 * (1 - u * 0.5)); g.lineBetween(x, y, x - 0.5, y + 4); }
        for (let k = 0; k < 3; k++) { const u = (t * 0.7 + k * 0.33) % 1; g.fillStyle(0xffffff, 0.16 * (1 - u)); g.fillCircle(head.x + (k - 1) * 8, head.y + 20 - u * 38, 3 + u * 4); }
      } else if (f.def === 'stove') {
        const b = toScreen(f.x + 0.5, f.y + 0.5); b.y -= 34;
        for (let k = 0; k < 3; k++) { const u = (t * 0.55 + k * 0.33) % 1; g.fillStyle(0xffffff, 0.38 * (1 - u)); g.fillCircle(b.x + Math.sin(t * 2 + k) * 4 + (k - 1) * 4, b.y - u * 24, 2.5 + u * 4); }
      } else if (f.def === 'bathtub') {
        const b = toScreen(f.x + 1, f.y + 0.5); b.y -= 16;
        for (let k = 0; k < 6; k++) { const u = (t * 0.4 + k * 0.17) % 1; g.fillStyle(0xffffff, 0.55 * (1 - u)); g.fillCircle(b.x + (k - 3) * 9, b.y - u * 10 + 4, 2.5); }
      }
    }
  }
}
export { MIN_PER_SEC };
