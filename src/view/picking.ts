/** Sélection par toucher (rendu uniquement) : quel meuble ou mur est sous le doigt ? Teste les pixels réellement visibles, du plus proche au plus lointain. */
import type Phaser from 'phaser';
import type { GameScene } from './scene';

export interface PropHit { furn?: number; wall?: boolean }

const opaque = (scene: Phaser.Scene, img: Phaser.GameObjects.Image, wx: number, wy: number): boolean => {
  if (!img.visible || img.alpha < 0.1) return false;
  const lx = Math.floor(wx - img.x), ly = Math.floor(wy - img.y); if (lx < 0 || ly < 0 || lx >= img.width || ly >= img.height) return false;
  return scene.textures.getPixelAlpha(lx, ly, img.texture.key) > 24;
};
/** Meuble (ou mur qui le masque) à la position monde donnée. Les murs devant un meuble l'emportent : on ne touche pas ce qu'on ne voit pas. */
export function pickProp(scene: GameScene, wx: number, wy: number): PropHit {
  let best: PropHit = {}; let bd = -Infinity;
  for (const [fi, nodes] of scene.furnNodes) for (const img of nodes) if (img.depth > bd && opaque(scene, img, wx, wy)) { bd = img.depth; best = { furn: fi }; }
  for (const wd of scene.walls) if (wd.s.depth > bd && opaque(scene, wd.s, wx, wy)) { bd = wd.s.depth; best = { wall: true }; }
  return best;
}
