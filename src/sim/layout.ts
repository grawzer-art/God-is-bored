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
/** Monde : 96 x 40 cases. Le quartier d'origine (maison, bar, avenue) garde ses coordonnées ; la ville s'étend à l'est (centre-ville), au sud (parc, rue du Marché). */
export const W = 96;
export const H = 40;
/** Bâtiments : murs hauts sur les bords nord et ouest (vus de dos), bas ailleurs ; front = hauteur de façade. */
export interface Building { name: string; x0: number; y0: number; x1: number; y1: number; front: number; kind?: 'home' | 'bar' | 'store' | 'police' | 'cafe' | 'apartment'; solid?: boolean; /** coque : bâtiment ancien dont la carte intérieure est fixe mais qui reçoit façade et toit */ shell?: boolean; h?: number; wall?: 'brick' | 'concrete' | 'beige' | 'blue' | 'cream'; roof?: string; title?: string; door?: [number, number] }
export const BUILDINGS: Building[] = [
  { name: 'house', x0: 0, y0: 0, x1: 28, y1: 18, front: 24, kind: 'home', shell: true, h: 96, wall: 'cream', roof: '#b4573f', title: 'FOYER BONHEUR™', door: [16, 18] },
  { name: 'bar', x0: 31, y0: 8, x1: 49, y1: 18, front: 44, kind: 'bar', shell: true, h: 84, wall: 'brick', roof: '#4a2c3a', title: 'LE ZINC', door: [38, 18] },
  // --- Centre-ville (V open world) : façades pleines, toits, murs qui s'abaissent quand on entre
  { name: 'store', x0: 57, y0: 10, x1: 66, y1: 18, front: 64, kind: 'store', solid: true, h: 84, wall: 'cream', roof: '#c9573f', title: 'MINI-MARCHÉ', door: [61, 18] },
  { name: 'police', x0: 68, y0: 8, x1: 82, y1: 18, front: 80, kind: 'police', solid: true, h: 112, wall: 'blue', roof: '#3c4d6e', title: 'COMMISSARIAT', door: [75, 18] },
  { name: 'cafe', x0: 84, y0: 10, x1: 94, y1: 18, front: 66, kind: 'cafe', solid: true, h: 84, wall: 'beige', roof: '#8a5a3a', title: 'CAFÉ CULPA', door: [88, 18] },
  { name: 'flats1', x0: 57, y0: 24, x1: 68, y1: 32, front: 100, kind: 'apartment', solid: true, h: 124, wall: 'brick', roof: '#6a6f7a', title: 'LES MOUETTES™', door: [62, 32] },
  { name: 'flats2', x0: 70, y0: 24, x1: 82, y1: 32, front: 110, kind: 'apartment', solid: true, h: 136, wall: 'concrete', roof: '#5a606c', title: 'RÉSIDENCE ORION', door: [76, 32] },
  { name: 'flats3', x0: 84, y0: 24, x1: 94, y1: 32, front: 96, kind: 'apartment', solid: true, h: 112, wall: 'beige', roof: '#7a5a4a', title: 'LES TILLEULS', door: [89, 32] },
];
export const OUTDOOR = 'srg';
/** Pièces des nouveaux bâtiments : M épicerie, Q commissariat, C cellule, T café, N/O/P halls d'immeubles (une lettre par pièce : l'éclairage se calcule par lettre). */
export const CITY_ROOMS = 'MQCTNOPjmv';
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
  applyCity(g);
  return g.map((r) => r.join(''));
}

// ---------------------------------------------------------------- ville : rues, intersections, bâtiments
function applyCity(g: string[][]) {
  const set = (x: number, y: number, ch: string) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch; };
  const rect = (x0: number, y0: number, x1: number, y1: number, ch: string) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ch); };
  // Rue du Marché (est-ouest, rangées 33-36) sur toute la largeur, puis rue Centrale (nord-sud, colonnes 52-55) sur toute la hauteur
  for (let x = 0; x < W; x++) { set(x, 33, 's'); set(x, 34, 'r'); set(x, 35, 'r'); set(x, 36, 's'); }
  for (let y = 0; y < H; y++) { if (y >= 19 && y <= 22) continue; if (y >= 33 && y <= 36) continue; set(52, y, 's'); set(53, y, 'r'); set(54, y, 'r'); set(55, y, 's'); }
  // intersections : la chaussée continue à travers les trottoirs
  for (const [y0, y1] of [[19, 22], [33, 36]]) { rect(53, y0, 54, y1, 'r'); }
  rect(52, 20, 55, 21, 'r'); rect(52, 34, 55, 35, 'r');
  // bâtiments : murs sur le pourtour, sol d'une lettre unique, porte « X » sur la façade sud
  for (const b of BUILDINGS) {
    if (!b.solid) continue; const room = ({ store: 'M', police: 'Q', cafe: 'T' } as Record<string, string>)[b.kind!] ?? ({ flats1: 'N', flats2: 'O', flats3: 'P' } as Record<string, string>)[b.name];
    rect(b.x0, b.y0, b.x1, b.y1, '#'); rect(b.x0 + 1, b.y0 + 1, b.x1 - 1, b.y1 - 1, room); if (b.door) set(b.door[0], b.door[1], 'X');
  }
  // « Les Mouettes » : le rez-de-chaussée est un appartement habitable (séjour-cuisine j, chambre m, salle de bains v) derrière un couloir d'entrée N
  rect(58, 30, 67, 30, '#'); set(67, 30, 'X'); rect(62, 25, 62, 29, '#'); set(62, 28, 'X'); rect(58, 27, 61, 27, '#'); set(60, 27, 'X');
  rect(63, 25, 67, 29, 'j'); rect(58, 28, 61, 29, 'm'); rect(58, 25, 61, 26, 'v');
  // commissariat : cellule de garde à vue (x78-81, y9-13), porte intérieure en (77, 11)
  rect(77, 9, 77, 14, '#'); rect(78, 14, 81, 14, '#'); rect(78, 9, 81, 13, 'C'); set(77, 11, 'X');
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
  // --- Épicerie (x58..65, y11..17) : rayons, caisse
  f.push(P('shelf3', 58, 11, { id: 'shelf_a' }), P('shelf4', 62, 11, { id: 'shelf_b' }), P('shelf3', 59, 14, { id: 'shelf_c' }), P('shop_counter', 62, 16, { id: 'shop_counter' }), P('plant', 65, 17, { style: 1 }), P('bin', 58, 17));
  // --- Commissariat (x69..81, y9..17) : accueil, bureaux, cellule
  f.push(P('desk', 72, 14, { id: 'desk_a' }), P('desk', 70, 11), P('desk', 74, 11), P('bench', 70, 16), P('plant', 69, 9, { style: 0 }), P('plant', 76, 9, { style: 1 }), P('bin', 81, 17), P('bench', 79, 12, { w: 2, d: 1 }), P('toilet', 81, 9));
  // --- Café « Le Moulin » (x85..93, y11..17)
  f.push(P('shop_counter', 85, 12, { id: 'cafe_counter' }), P('stool', 85, 13), P('stool', 86, 13), P('stool', 87, 13), P('bar_table', 86, 16), P('chair_e', 85, 16), P('chair_w', 87, 16), P('bar_table', 90, 15), P('chair_e', 89, 15), P('chair_w', 91, 15),
    P('bar_table', 91, 12), P('chair_e', 90, 12), P('chair_w', 92, 12), P('plant', 93, 17, { style: 0 }), P('plant', 93, 11, { style: 1 }), P('floor_lamp', 85, 17));
  // --- Halls d'immeubles
  for (const [x0, x1] of [[71, 81], [85, 93]]) { f.push(P('console', x0 + 1, 25), P('plant', x1, 25, { style: 1 }), P('plant', x0, 31, { style: 0 }), P('bench', Math.floor((x0 + x1) / 2), 29, { w: 2, d: 1 })); }
  // --- Parc (x2..48, y24..32) et rues
  for (const [x, y] of [[4, 26], [9, 30], [16, 25], [22, 29], [28, 26], [33, 31], [39, 25], [44, 29], [47, 26], [12, 27], [24, 32]]) f.push(P('tree', x, y, { style: x * 5 + y }));
  for (const [x, y] of [[7, 28], [19, 27], [31, 28], [42, 27]]) f.push(P('park_bench', x, y));
  for (const x of [8, 16, 24, 32, 40, 48]) f.push(P('streetlamp', x, 33));
  for (const x of [58, 66, 74, 82, 90]) f.push(P('streetlamp', x, 22), P('streetlamp', x, 33));
  for (const y of [4, 12, 26, 29]) f.push(P('streetlamp', 52, y));
  f.push(P('street_bench', 60, 22), P('street_bench', 86, 22), P('bin', 70, 22), P('bin', 56, 33), P('bin', 80, 33), P('street_bench', 72, 36), P('bin', 14, 36));
  for (const [x, y] of [[57, 23], [66, 23], [75, 23], [84, 23], [93, 23]]) f.push(P('bush', x, y, { style: x * 3 + y }));
  // --- mobilier de rue varié (quartier pilote) : bornes, kiosques, cabines, distributeurs, panneaux satiriques, voitures garées
  // appartement habitable des Mouettes (x58-67, y25-29) : salle de bains, chambre, séjour-cuisine, couloir d'entrée
  f.push(P('shower', 58, 25), P('sink_b', 59, 25), P('toilet', 61, 25), P('rug', 59, 26, { w: 2, d: 1, style: 6 }));
  f.push(P('bed_y', 58, 28, { id: 'flat_bed', style: 1 }), P('wardrobe', 60, 29, { style: 2 }));
  f.push(P('fridge', 63, 25), P('counter', 64, 25), P('stove', 65, 25, { id: 'flat_stove' }), P('sink_k', 66, 25), P('counter', 67, 25));
  f.push(P('sofa_s', 63, 27, { id: 'flat_sofa' }), P('rug', 63, 28, { w: 3, d: 1, style: 3 }), P('tv', 64, 29, { id: 'flat_tv' }), P('floor_lamp', 67, 26), P('plant', 67, 28, { style: 1 }));
  f.push(P('coat_rack', 58, 31), P('plant', 59, 31, { style: 0 }));
  f.push(P('hydrant', 59, 19), P('mailbox', 65, 19), P('vending', 78, 19), P('phone_booth', 71, 19), P('kiosk', 84, 19), P('planter', 91, 19, { style: 1 }), P('bike_rack', 67, 19), P('planter', 57, 19, { style: 3 }));
  f.push(P('billboard', 71, 23, { style: 0 }), P('billboard', 85, 23, { style: 4 }), P('billboard', 60, 23, { style: 2 }), P('dumpster', 68, 23), P('billboard', 13, 23, { style: 1 }), P('billboard', 46, 23, { style: 5 }));
  [[62, 35, 0], [70, 35, 1], [86, 35, 2], [66, 34, 3], [90, 34, 5], [74, 34, 6], [58, 34, 4]].forEach(([x, y, st]) => f.push(P('car_p', x, y, { style: st })));
  f.push(P('hydrant', 64, 33), P('mailbox', 79, 33), P('planter', 85, 33, { style: 0 }), P('vending', 60, 33), P('hydrant', 92, 36));
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
  if (c === 'X') return doorRoom(x, y);
  return c;
}
export const isWall = (x: number, y: number) => y < 0 || y >= H || x < 0 || x >= W || MAP[y][x] === '#';
/** Pièce d'une porte « X » : la pièce intérieure voisine (sud/nord/est/ouest), sinon la rue. */
function doorRoom(x: number, y: number): string { for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const ch = MAP[y + dy]?.[x + dx]; if (ch && CITY_ROOMS.includes(ch)) return ch; } return 's'; }
export const isDoor = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && 'DEFGX'.includes(MAP[y][x]);
export const isOutdoor = (x: number, y: number) => OUTDOOR.includes(roomAt(x, y)) && roomAt(x, y) !== '';
/** Bâtiment qui reçoit façade, toit et ouverture à l'approche (pleins et coques). */
export const closable = (b: Building | undefined) => !!b && (!!b.solid || !!b.shell);
export function buildingAt(x: number, y: number) { return BUILDINGS.find((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1); }

/** Nom du quartier à une position (affiché dans le HUD). */
export function districtAt(x: number, y: number): string {
  const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 52) return cy <= 22 ? 'Centre-ville' : cy <= 32 ? 'Résidences' : cy <= 36 ? 'Rue du Marché' : 'Faubourg';
  if (cy >= 33 && cy <= 36) return 'Rue du Marché'; if (cy >= 19 && cy <= 22) return 'Avenue de NORIA'; if (cy > 22) return 'Parc des Tilleuls'; return cx <= 29 ? 'La Colocation' : cx >= 52 ? 'Centre-ville' : 'Quartier du Cinquième Ciel';
}
