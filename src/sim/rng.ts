/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export class Rng {
  state: number;
  constructor(seed = 1) { this.state = (seed >>> 0) || 1; }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  randf(): number { return this.next(); }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}
