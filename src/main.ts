import Phaser from 'phaser';
import { GameScene } from './view/scene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0c12',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [GameScene],
  input: { mouse: { preventDefaultWheel: true }, touch: { capture: true } },
  render: { powerPreference: 'high-performance' },
});
