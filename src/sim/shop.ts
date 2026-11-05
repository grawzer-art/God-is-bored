/** Boutiques : rayons, prix, articles non payés, paiement à la caisse. Les articles pris existent vraiment (inventaire) ; sortir sans payer est un délit. */
import { ITEMS } from './interact';
import * as L from './layout';
import type { SimChar } from './simchar';
import type { World } from './world';

export const PRICE: Record<string, number> = { sandwich: 3, chips: 2, bonbons: 2, briquet: 4 };
/** Articles de chaque rayon (un par emplacement, de gauche à droite). */
export const SHELF_ITEMS: Record<string, string[]> = { shelf_a: ['sandwich', 'chips', 'bonbons'], shelf_b: ['chips', 'sandwich', 'bonbons', 'briquet'], shelf_c: ['bonbons', 'chips', 'sandwich'] };
export const CASH_CELL = { x: 63, y: 17 };           // devant la caisse
export const inStore = (c: SimChar) => L.buildingAt(c.cell().x, c.cell().y)?.name === 'store';
export const owed = (c: SimChar) => Object.entries(c.unpaid).reduce((n, [k, v]) => n + (PRICE[k] ?? 2) * v, 0);
export const hasUnpaid = (c: SimChar) => Object.values(c.unpaid).some((v) => v > 0);
export const itemLabel = (k: string) => ITEMS[k]?.label ?? k;

/** Article posé sur l'emplacement `slot` du rayon `furnIdx` (null si ce n'est pas un rayon). */
export function shelfItem(w: World, furnIdx: number, slot: number): string | null { const f = w.furn[furnIdx]; return f && SHELF_ITEMS[f.id] ? SHELF_ITEMS[f.id][slot] ?? null : null; }
export const encode = (furnIdx: number, slot: number) => furnIdx * 8 + slot;
export const decode = (code: number) => ({ furn: Math.floor(code / 8), slot: code % 8 });

/** Prendre un article sur un rayon : il passe dans l'inventaire, marqué non payé. */
export function take(w: World, c: SimChar, furnIdx: number, slot: number): string | null {
  const it = shelfItem(w, furnIdx, slot); if (!it) return null;
  c.inventory[it] = (c.inventory[it] ?? 0) + 1; c.unpaid[it] = (c.unpaid[it] ?? 0) + 1; w.stats.items_taken = (w.stats.items_taken ?? 0) + 1; return it;
}
/** Payer tout ce qui est dû. Renvoie le montant payé (0 si rien à payer ou fonds insuffisants). */
export function pay(w: World, c: SimChar): number {
  const due = owed(c); if (due <= 0) return 0; if (c.money < due) return 0;
  c.money -= due; const clerk = w.clerk; if (clerk) clerk.money += due; c.unpaid = {}; w.stats.shop_sales = (w.stats.shop_sales ?? 0) + due; return due;
}
/** Un PNJ consomme ce qu'il a acheté (la faim baisse) : les articles volés aussi. */
export function consume(c: SimChar) {
  for (const [k, n] of Object.entries(c.inventory)) { if (n <= 0 || c.kind === 'avatar') continue; const it = ITEMS[k]; if (it?.hunger) c.needs.hunger = Math.min(100, c.needs.hunger + it.hunger * n); if (it?.fun) c.needs.fun = Math.min(100, c.needs.fun + it.fun * n); c.inventory[k] = 0; }
}
