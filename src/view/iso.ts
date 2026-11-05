import type { V2 } from '../sim/defs';
export const toScreen = (x: number, y: number): V2 => ({ x: (x - y) * 32, y: (x + y) * 16 });
export const toGrid = (sx: number, sy: number): V2 => ({ x: (sx / 32 + sy / 16) * 0.5, y: (sy / 16 - sx / 32) * 0.5 });
export const cellKey = (cx: number, cy: number) => (cx + cy + 2) * 16 - 2;
export const zOf = (key: number) => Math.floor(key * 4);
