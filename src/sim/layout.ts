/** Quartier 52x24. '#' mur ; D E F G = portes ; lettres = pièces ; s trottoir, r route, g herbe. */
const HOUSE: string[] = [
  '#############################',
  '#aaaaaa#bbbbbb#cccccc#dddddd#',
  '#aaaaaa#bbbbbb#cccccc#dddddd#',
  '#aaaaaa#bbbbbb#cccccc#dddddd#',
  '#aaaaaa#bbbbbb#cccccc#dddddd#',
  '#aaaaaa#bbbbbb#cccccc#dddddd#',
  '###D######D######D######D####',
  '#hhhhhhhhhhhhhhhhhhhhhhhhhhh#',
  '#hhhhhhhhhhhhhhhhhhhhhhhhhhh#',
  '#####D#########D########D####',
  '#kkkkkkkkk#lllllllll#wwwwwww#',
  '#kkkkkkkkk#lllllllll#wwwwwww#',
  '#kkkkkkkkkDlllllllll#wwwwwww#',
  '#kkkkkkkkkDlllllllll#wwwwwww#',
  '#kkkkkkkkkDlllllllll####D####',
  '#kkkkkkkkk#lllllllll#uuuuuuu#',
  '#kkkkkkkkk#lllllllll#uuuuuuu#',
  '#kkkkkkkkk#lllllllll#uuuuuuu#',
  '#############################',
];
export const W = 52;
export const H = 24;
/** Bâtiments : murs hauts sur les bords nord et ouest (vus de dos), bas ailleurs ; front = hauteur de façade. */
export const BUILDINGS = [
  { name: 'house', x0: 0, y0: 0, x1: 28, y1: 18, front: 24 },
  { name: 'bar', x0: 31, y0: 8, x1: 49, y1: 18, front: 44 },
];
export const OUTDOOR = 'srg';
function buildMap(): string[] {
  const g: string[][] = Array.from({ length: H }, () => Array(W).fill('g'));
  for (let x = 0; x < W; x++) { g[19][x] = 's'; g[20][x] = 'r'; g[21][x] = 'r'; g[22][x] = 's'; }
  HOUSE.forEach((row, y) => [...row].forEach((ch, x) => (g[y][x] = ch)));
  g[18][16] = 'G';
  for (let y = 8; y <= 18; y++) for (let x = 31; x <= 49; x++) g[y][x] = '#';
  for (let y = 9; y <= 17; y++) for (let x = 32; x <= 48; x++) g[y][x] = 'B';
  for (let y = 9; y <= 12; y++) for (let x = 45; x <= 48; x++) g[y][x] = 'R';
  for (let y = 9; y <= 13; y++) g[y][44] = '#';
  for (let x = 44; x <= 48; x++) g[13][x] = '#';
  g[13][46] = 'F'; g[18][38] = 'E';
  return g.map((r) => r.join(''));
}
export const MAP: string[] = buildMap();
export const BEDROOM_X = [1, 8, 15, 22];
export const BEDROOM_IDS = ['a', 'b', 'c', 'd'];

export interface FurnPlacement { def: string; x: number; y: number; opts: { id?: string; style?: number; w?: number; d?: number } }
const P = (def: string, x: number, y: number, opts: FurnPlacement['opts'] = {}): FurnPlacement => ({ def, x, y, opts });

export function furniture(): FurnPlacement[] {
  const f: FurnPlacement[] = [];
  for (let i = 0; i < 4; i++) {
    const bx = BEDROOM_X[i];
    const tag = BEDROOM_IDS[i];
    f.push(P('bed_y', bx, 1, { id: `bed_${tag}_0`, style: i }));
    f.push(P('bed_yw', bx + 5, 1, { id: `bed_${tag}_1`, style: (i + 2) % 4 }));
    f.push(P('nightstand', bx + 1, 1));
    f.push(P('nightstand', bx + 4, 1));
    f.push(P('wardrobe', bx + 2, 1, { style: i }));
    f.push(P('rug', bx + 2, 3, { w: 2, d: 2, style: i }));
    f.push(P('basket', bx, 5));
    f.push(P('plant', bx + 5, 5, { style: i % 2 }));
  }
  // Cuisine
  f.push(P('fridge', 1, 10), P('counter', 2, 10), P('stove', 3, 10, { id: 'stove' }), P('counter', 4, 10),
    P('sink_k', 6, 10), P('counter', 7, 10), P('counter', 8, 10), P('plant', 9, 10, { style: 1 }),
    P('counter_w', 1, 12), P('counter_w', 1, 13), P('rug', 3, 13, { w: 5, d: 4, style: 4 }), P('table', 4, 14, { id: 'table' }),
    P('chair_s', 4, 13), P('chair_s', 6, 13), P('chair_n', 4, 16), P('chair_n', 6, 16),
    P('chair_e', 3, 14), P('chair_e', 3, 15), P('chair_w', 7, 14), P('chair_w', 7, 15), P('bin', 9, 17));
  // Salon
  f.push(P('floor_lamp', 11, 10), P('sofa_s', 12, 10, { id: 'sofa' }), P('bookshelf', 16, 10, { style: 0 }), P('floor_lamp', 18, 10),
    P('plant', 19, 10, { style: 1 }), P('armchair_e', 11, 11), P('rug', 12, 12, { w: 5, d: 3, style: 5 }),
    P('coffee_table', 13, 13), P('tv', 13, 16, { id: 'tv' }), P('floor_lamp', 19, 16), P('altar', 19, 13, { id: 'altar' }));
  // Salle de bains
  f.push(P('shower', 21, 10), P('shower', 22, 10), P('sink_b', 25, 10), P('sink_b', 26, 10), P('toilet', 27, 10),
    P('bathtub', 26, 13), P('rug', 22, 12, { w: 2, d: 2, style: 6 }), P('basket', 21, 13), P('plant', 21, 12, { style: 0 }));
  // Buanderie
  f.push(P('washer', 21, 15), P('washer', 22, 15), P('washer', 26, 15), P('washer', 27, 15), P('basket', 23, 17), P('basket', 25, 17), P('bin', 27, 17));
  // Couloir
  f.push(P('coat_rack', 1, 7), P('bench', 5, 7), P('plant', 8, 7, { style: 0 }), P('console', 12, 7), P('bench', 14, 7),
    P('plant', 20, 7, { style: 1 }), P('shoe_rack', 22, 7), P('plant', 27, 7, { style: 0 }));
  // --- Bar « Le Cinquième Ciel » (x32..48, y9..17)
  f.push(P('back_shelf', 33, 9, { w: 6, d: 1, id: 'back_shelf' }), P('bar_counter', 33, 11, { w: 7, d: 1, id: 'bar_counter' }));
  for (let x = 34; x <= 38; x++) f.push(P('stool', x, 12));
  f.push(P('jukebox', 42, 9, { id: 'jukebox' }), P('dance_floor', 40, 13, { w: 4, d: 3, style: 7 }));
  f.push(P('bar_table', 34, 15), P('chair_e', 33, 15), P('chair_w', 35, 15), P('bar_table', 41, 17), P('chair_e', 40, 17), P('chair_w', 42, 17),
    P('bar_table', 46, 16), P('chair_e', 45, 16), P('chair_w', 47, 16));
  f.push(P('toilet', 47, 9), P('toilet', 48, 9), P('sink_b', 45, 9), P('plant', 32, 17, { style: 0 }), P('plant', 48, 17, { style: 1 }), P('bin', 44, 17), P('floor_lamp', 32, 9));
  // --- Rue, trottoirs, jardin
  for (const x of [5, 12, 22, 29, 37, 45]) f.push(P('streetlamp', x, 22));
  f.push(P('street_bench', 8, 22), P('street_bench', 26, 22), P('street_bench', 41, 22), P('bin', 20, 22), P('bin', 34, 22), P('bar_sign', 40, 19, { id: 'bar_sign' }));
  for (const [x, y] of [[30, 2], [30, 6], [30, 12], [30, 16], [51, 3], [51, 9], [51, 15], [34, 3], [40, 5], [46, 2]]) f.push(P('tree', x, y, { style: x + y }));
  for (const [x, y] of [[29, 9], [29, 14], [50, 6], [50, 12], [35, 6], [43, 4], [3, 23], [10, 23], [18, 23], [27, 23], [35, 23], [44, 23], [50, 23]]) f.push(P('bush', x, y, { style: x * 3 + y }));
  return f;
}

export const INITIAL_MESS: [string, number, number][] = [
  ['clothes', 3.5, 2.5], ['book', 1.4, 4.4], ['clothes', 24.5, 3.5], ['cup', 14.2, 13.4], ['pizza', 13.8, 13.4],
  ['clothes', 16.5, 4.5], ['cup', 12.5, 11.5], ['trash', 9.5, 16.5], ['clothes', 10.5, 2.5], ['book', 23.5, 4.5], ['clothes', 21.5, 13.5],
];

export function roomAt(x: number, y: number): string {
  if (y < 0 || y >= H || x < 0 || x >= W) return '';
  const c = MAP[y][x];
  if (c === '#') return '';
  if (c === 'D') return 'h';
  if (c === 'G') return 'l';
  if (c === 'E' || c === 'F') return 'B';
  return c;
}
export const isWall = (x: number, y: number) => y < 0 || y >= H || x < 0 || x >= W || MAP[y][x] === '#';
export const isDoor = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && 'DEFG'.includes(MAP[y][x]);
export const isOutdoor = (x: number, y: number) => OUTDOOR.includes(roomAt(x, y)) && roomAt(x, y) !== '';
export function buildingAt(x: number, y: number) { return BUILDINGS.find((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1); }
