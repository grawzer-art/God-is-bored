import Phaser from 'phaser';
const ids = new WeakMap<HTMLCanvasElement, string>(); let n = 0;
/** Enregistre un canvas comme texture Phaser (une seule fois) et renvoie sa clé. */
export function texKey(scene: Phaser.Scene, cv: HTMLCanvasElement): string {
  let k = ids.get(cv);
  if (!k) { k = 'cv' + n++; ids.set(cv, k); }
  if (!scene.textures.exists(k)) scene.textures.addCanvas(k, cv);
  return k;
}
