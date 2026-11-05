/** Police pixel 5×7 et sprites du générique (créés pour le jeu, aucun emoji système). */
const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'], C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'], E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'], K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'], O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'], Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'], W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'], ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'], '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'], '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
};
export const textWidth = (t: string, scale: number, gap = 1) => (t.length * 6 - gap) * scale;
export function drawText(g: CanvasRenderingContext2D, t: string, x: number, y: number, scale: number, color: string, gap = 1) {
  g.fillStyle = color; let cx = x; for (const ch of t.toUpperCase()) { const gl = G[ch] ?? G[' ']; gl.forEach((row, ry) => [...row].forEach((p, rx) => { if (p === '#') g.fillRect(cx + rx * scale, y + ry * scale, scale, scale); })); cx += (5 + gap) * scale; }
}
/** Main au doigt d'honneur levé, 16×20 (o contour, S peau, s ombre, h reflet). */
export const FINGER: string[] = [
  '.......oo.......', '......oSSo......', '......oShSo.....', '......oSSso.....', '......oSSso.....', '......oSSso.....', '..oo..oSSso.oo..', '.oSSo.oSSsoSSSo.',
  '.oSSsooSSsoSSso.', '.oSSsoSSSssSSso.', '.oSSSSSSSSSSSso.', '.oSSSSSSSSSSSso.', '.oSSSSSSSSSSSso.', '..oSSSSSSSSSSso.', '..oSSSSSSSSSsso.', '...oSSSSSSSSsso.',
  '...oSSSSSSSsso..', '....oSSSSSsso...', '....ooSSSssoo...', '.....oooooooo...',
];
export function drawSprite(g: CanvasRenderingContext2D, rows: string[], x: number, y: number, scale: number, pal: Record<string, string>) {
  rows.forEach((row, ry) => [...row].forEach((p, rx) => { const c = pal[p]; if (c) { g.fillStyle = c; g.fillRect(x + rx * scale, y + ry * scale, scale, scale); } }));
}
export const SKIN_PAL = { o: '#2a160f', S: '#f1c9a5', s: '#d39d78', h: '#fff0dc' };
/** Petite couronne pixel art (logo). */
export const CROWN: string[] = ['.o...o...o.', '.oo.ooo.oo.', 'ooyooyyyoyo', 'oyyyyyyyyyo', 'oyyyyyyyyyo', 'ooooooooooo'];
