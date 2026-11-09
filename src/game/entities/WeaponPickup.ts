
import Phaser from 'phaser';

export default class WeaponPickup extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number
  ) {
    super(scene, x, y);

    const graphics = scene.add.graphics();

    // 地面标记
    graphics.fillStyle(0x222222, 0.6);
    graphics.fillCircle(0, 0, 17);

    graphics.lineStyle(2, 0xffd54a, 1);
    graphics.strokeCircle(0, 0, 17);

    // 枪械图标
    graphics.fillStyle(0x292929, 1);
    graphics.fillRect(-11, -3, 20, 6);
    graphics.fillRect(7, -5, 7, 4);
    graphics.fillRect(-5, 2, 5, 8);
    graphics.fillRect(-12, -5, 5, 3);

    this.add(graphics);

    scene.add.existing(this);
    this.setDepth(4);
  }
}
