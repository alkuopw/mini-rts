
import Phaser from 'phaser';

export type UnitTeam = 'red' | 'blue';

export default class Unit extends Phaser.GameObjects.Container {
  team: UnitTeam;
  hp = 100;
  maxHp = 100;
  speed = 100;

  private selected = false;
  private armed = false;
  private target: Phaser.Math.Vector2 | null = null;

  private body: Phaser.GameObjects.Graphics;
  private selectionRing: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    team: UnitTeam
  ) {
    super(scene, x, y);

    this.team = team;

    this.selectionRing = scene.add.graphics();
    this.selectionRing.lineStyle(2, 0xffff66, 1);
    this.selectionRing.strokeCircle(0, 0, 19);
    this.selectionRing.setVisible(false);
    this.add(this.selectionRing);

    this.body = scene.add.graphics();
    this.add(this.body);

    this.drawBody();

    scene.add.existing(this);
    this.setDepth(5);
  }

  private drawBody() {
    const color = this.team === 'red'
      ? 0xc94b42
      : 0x3979c8;

    this.body.clear();

    // 工人身体
    this.body.fillStyle(0x222222, 1);
    this.body.fillCircle(0, 0, 13);

    this.body.fillStyle(color, 1);
    this.body.fillCircle(0, 0, 10);

    this.body.fillStyle(0xffffff, 1);
    this.body.fillCircle(0, -2, 3);

    // 持枪状态：绘制枪械
    if (this.armed) {
      this.body.fillStyle(0x252525, 1);
      this.body.fillRect(-2, -12, 17, 5);
      this.body.fillRect(11, -14, 4, 3);
      this.body.fillRect(1, -7, 4, 7);
    }
  }

  takeWeapon() {
    if (this.armed) return;

    this.armed = true;
    this.drawBody();
  }

  hasWeapon() {
    return this.armed;
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
  }

  isDead() {
    return this.hp <= 0;
  }

  setSelected(value: boolean) {
    this.selected = value;
    this.selectionRing.setVisible(value);
  }

  isSelected() {
    return this.selected;
  }

  containsPoint(x: number, y: number) {
    return Phaser.Math.Distance.Between(
      this.x,
      this.y,
      x,
      y
    ) < 20;
  }

  moveTo(x: number, y: number) {
    this.target = new Phaser.Math.Vector2(x, y);
  }

  updateUnit(delta: number) {
    if (!this.target) return;

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.target.x,
      this.target.y
    );

    if (distance < 3) {
      this.setPosition(this.target.x, this.target.y);
      this.target = null;
      return;
    }

    const step = Math.min(
      this.speed * delta / 1000,
      distance
    );

    const angle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      this.target.x,
      this.target.y
    );

    this.x += Math.cos(angle) * step;
    this.y += Math.sin(angle) * step;
  }
}
