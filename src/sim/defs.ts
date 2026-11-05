/** Données statiques : besoins, activités, mobilier, émotions (port de Defs.gd). */
export type V2 = { x: number; y: number };
export const NEEDS = ['hunger', 'energy', 'bladder', 'hygiene', 'social', 'fun'] as const;
export type Need = (typeof NEEDS)[number];
export const NEED_LABEL: Record<Need, string> = { hunger: 'Faim', energy: 'Énergie', bladder: 'Vessie', hygiene: 'Hygiène', social: 'Social', fun: 'Loisirs' };
export const NEED_DECAY: Record<Need, number> = { hunger: 6.5, energy: 4.4, bladder: 6.0, hygiene: 3.0, social: 4.4, fun: 4.2 };
/** Minutes de jeu par seconde réelle (vitesse 1x) : 1 jour = 12 minutes réelles. */
export const MIN_PER_SEC = 2.0;
/** 0=SE(+x) 1=SW(+y) 2=NW(-x) 3=NE(-y) */
export const DIRS: V2[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

export interface ActDef { label: string; pose: string; rate: Partial<Record<Need, number>>; dur: [number, number]; interrupt: boolean }
const A = (label: string, pose: string, rate: Partial<Record<Need, number>>, dur: [number, number], interrupt: boolean): ActDef => ({ label, pose, rate, dur, interrupt });
export const ACT: Record<string, ActDef> = {
  sleep: A('Dort', 'lie', { energy: 13 }, [300, 600], false),
  nap: A('Fait la sieste', 'sit', { energy: 22, fun: 3 }, [30, 60], true),
  cook: A('Cuisine', 'use', { fun: 4 }, [18, 28], false),
  serve: A('Se sert', 'use', {}, [3, 5], false),
  eat: A('Mange', 'sit_eat', { hunger: 105, fun: 6 }, [24, 34], false),
  snack: A('Grignote', 'use', { hunger: 230, fun: 5 }, [5, 8], false),
  toilet: A('Aux toilettes', 'sit', { bladder: 1000 }, [5, 7], false),
  shower: A('Prend une douche', 'wash', { hygiene: 400, energy: 4 }, [13, 18], false),
  wash: A('Se débarbouille', 'wash', { hygiene: 150 }, [4, 6], false),
  bath: A('Prend un bain', 'sit', { hygiene: 150, fun: 28, energy: 8 }, [35, 50], true),
  tv: A('Regarde la télé', 'sit', { fun: 46, social: 3 }, [40, 90], true),
  read: A('Lit', 'sit_read', { fun: 36 }, [30, 60], true),
  browse: A('Feuillette un livre', 'use', { fun: 20 }, [6, 12], true),
  tidy: A('Range', 'use', { fun: -2 }, [5, 9], true),
  dishes: A('Fait la vaisselle', 'use', { fun: -2 }, [6, 10], true),
  water: A('Arrose les plantes', 'use', { fun: 8 }, [4, 6], true),
  laundry: A('Fait la lessive', 'use', { fun: -1 }, [10, 16], true),
  idle: A('Traîne', 'stand', { fun: 1 }, [3, 8], true),
  chat: A('Discute', 'talk', {}, [10, 24], false),
  feast: A('Festoie', 'sit_eat', { hunger: 140, fun: 30, social: 18 }, [30, 40], false),
  pray: A('Prie', 'stand', { fun: 6 }, [4, 7], true),
  drink: A('Boit un verre', 'use', { fun: 16, social: 6 }, [6, 12], true),
  bartend: A('Sert au bar', 'use', {}, [9999, 9999], false),
  look: A('Observe la pièce', 'stand', { fun: 1 }, [4, 9], true),
  search: A('Fouille discrètement', 'stand', {}, [4, 6], false),
  music: A('Choisit un morceau', 'use', { fun: 4 }, [2, 3], true),
};
export const actLabel = (a: string) => ACT[a]?.label ?? a;

export interface SlotDef { tags: string[]; stands: [number, number][]; anchor?: [number, number]; pose: string; face: number }
export interface FurnDef { w: number; d: number; blocks: boolean; slots: SlotDef[]; flat?: boolean; light?: { h: number; r: number }; overlay?: boolean; tv?: boolean }
const S = (tags: string[], stands: [number, number][], pose: string, face: number, anchor?: [number, number]): SlotDef => ({ tags, stands, pose, face, anchor });
const F = (w: number, d: number, blocks: boolean, slots: SlotDef[] = [], extra: Partial<FurnDef> = {}): FurnDef => ({ w, d, blocks, slots, ...extra });
const CHAIR_TAGS = ['eat', 'sit', 'read', 'feast'];
const SOFA_TAGS = ['tv', 'read', 'nap'];
export const FURN: Record<string, FurnDef> = {
  bed_y: F(1, 2, true, [S(['sleep'], [[1, 1], [1, 0]], 'lie', 1, [0.5, 1.0])]),
  bed_yw: F(1, 2, true, [S(['sleep'], [[-1, 1], [-1, 0]], 'lie', 1, [0.5, 1.0])]),
  nightstand: F(1, 1, true, [], { light: { h: 26, r: 0.9 } }),
  wardrobe: F(2, 1, true), dresser: F(2, 1, true),
  rug: F(1, 1, false, [], { flat: true }),
  fridge: F(1, 1, true, [S(['snack'], [[0, 1]], 'use', 3)]),
  stove: F(1, 1, true, [S(['cook', 'serve'], [[0, 1]], 'use', 3)]),
  counter: F(1, 1, true), counter_w: F(1, 1, true),
  sink_k: F(1, 1, true, [S(['dishes'], [[0, 1]], 'use', 3)]),
  table: F(3, 2, true),
  chair_s: F(1, 1, false, [S(CHAIR_TAGS, [[0, 0]], 'sit', 1, [0.5, 0.5])]),
  chair_n: F(1, 1, false, [S(CHAIR_TAGS, [[0, 0]], 'sit', 3, [0.5, 0.5])]),
  chair_e: F(1, 1, false, [S(CHAIR_TAGS, [[0, 0]], 'sit', 0, [0.5, 0.5])]),
  chair_w: F(1, 1, false, [S(CHAIR_TAGS, [[0, 0]], 'sit', 2, [0.5, 0.5])]),
  sofa_s: F(3, 1, true, [0, 1, 2].map((i) => S(SOFA_TAGS, [[i, 1]], 'sit', 1, [i + 0.5, 0.42]))),
  armchair_e: F(1, 1, true, [S(SOFA_TAGS, [[1, 0]], 'sit', 0, [0.42, 0.5])]),
  tv: F(2, 1, true, [], { tv: true }),
  coffee_table: F(2, 1, true),
  bookshelf: F(2, 1, true, [S(['browse'], [[0, 1]], 'use', 3), S(['browse'], [[1, 1]], 'use', 3)]),
  plant: F(1, 1, true, [S(['water'], [[0, 1], [1, 0], [-1, 0], [0, -1]], 'use', 3)]),
  floor_lamp: F(1, 1, true, [], { light: { h: 70, r: 1.3 } }),
  toilet: F(1, 1, true, [S(['toilet'], [[0, 1]], 'sit', 1, [0.5, 0.42])]),
  shower: F(1, 1, true, [S(['shower'], [[0, 1]], 'wash', 1, [0.5, 0.5])], { overlay: true }),
  sink_b: F(1, 1, true, [S(['wash'], [[0, 1]], 'wash', 3)]),
  bathtub: F(2, 1, true, [S(['bath'], [[0, -1], [1, -1], [0, 1]], 'sit', 1, [1.0, 0.5])], { overlay: true }),
  washer: F(1, 1, true, [S(['laundry'], [[0, 1]], 'use', 3)]),
  basket: F(1, 1, true), bench: F(2, 1, true), coat_rack: F(1, 1, true), shoe_rack: F(1, 1, true),
  console: F(2, 1, true, [], { light: { h: 40, r: 1.0 } }),
  bin: F(1, 1, true),
  altar: F(1, 1, true, [S(['pray'], [[0, 1]], 'stand', 3)]),
  // --- quartier
  back_shelf: F(2, 1, true), dance_floor: F(1, 1, false, [], { flat: true }),
  bar_counter: F(2, 1, true, [0, 1, 2, 3, 4, 5, 6].map((i) => S(['order'], [[i, 1]], 'use', 3))),
  stool: F(1, 1, false, [S(['sit', 'drink'], [[0, 0]], 'sit', 3, [0.5, 0.5])]),
  jukebox: F(1, 1, true, [S(['music'], [[0, 1]], 'use', 3)], { light: { h: 40, r: 1.1 } }),
  bar_table: F(1, 1, true),
  streetlamp: F(1, 1, true, [], { light: { h: 84, r: 2.0 } }),
  street_bench: F(2, 1, true), bar_sign: F(1, 1, false, [], { light: { h: 70, r: 1.7 } }),
  tree: F(1, 1, true), bush: F(1, 1, true),
};
export const EMOTIONS: Record<string, string> = {
  joy: 'Joyeux', content: 'Content', neutral: 'Calme', tired: 'Fatigué', hungry: 'Affamé', lonely: 'Seul', bored: "S'ennuie",
  irritated: 'Irrité', angry: 'En colère', sad: 'Triste', anxious: 'Anxieux', dirty: 'Mal à l\'aise', love: 'Attendri', awe: 'Émerveillé',
};
export const ROOM_NAMES: Record<string, string> = { B: 'Bar « Le Cinquième Ciel »', R: 'Toilettes du bar', s: 'Trottoir', r: 'Rue', g: 'Jardin', a: 'Chambre 1', b: 'Chambre 2', c: 'Chambre 3', d: 'Chambre 4', h: 'Couloir', k: 'Cuisine', l: 'Salon', w: 'Salle de bains', u: 'Buanderie' };
