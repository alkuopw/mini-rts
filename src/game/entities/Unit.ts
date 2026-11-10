
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

  private unitGraphics: Phaser.GameObjects.Graphics;
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

    this.unitGraphics = scene.add.graphics();
    this.add(this.unitGraphics);

    this.drawBody();

    scene.add.existing(this);
    this.setDepth(5);
  }

  private drawBody() {
    const color = this.team === 'red'
      ? 0xc94b42
      : 0x3979c8;

    this.unitGraphics.clear();

    // 工人身体
    this.unitGraphics.fillStyle(0x222222, 1);
    this.unitGraphics.fillCircle(0, 0, 13);

    this.unitGraphics.fillStyle(color, 1);
    this.unitGraphics.fillCircle(0, 0, 10);

    this.unitGraphics.fillStyle(0xffffff, 1);
    this.unitGraphics.fillCircle(0, -2, 3);

    // 持枪状态：绘制枪械
    if (this.armed) {
      this.unitGraphics.fillStyle(0x252525, 1);
      this.unitGraphics.fillRect(-2, -12, 17, 5);
      this.unitGraphics.fillRect(11, -14, 4, 3);
      this.unitGraphics.fillRect(1, -7, 4, 7);
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

  setMoveTarget(x: number, y: number) {
  this.target = new Phaser.Math.Vector2(x, y);
}
// 判断工人是否与建筑碰撞
private collidesWithBuildings(
  x: number,
  y: number,
  buildings: Phaser.Geom.Rectangle[]
): boolean {

  const radius = 13;

  for (const building of buildings) {

    // 找到建筑矩形上距离工人最近的点
    const nearestX = Phaser.Math.Clamp(
      x,
      building.left,
      building.right
    );

    const nearestY = Phaser.Math.Clamp(
      y,
      building.top,
      building.bottom
    );

    const distance = Phaser.Math.Distance.Between(
      x,
      y,
      nearestX,
      nearestY
    );

    if (distance < radius) {
      return true;
    }
  }

  return false;
}
  updateUnit(
  delta: number,
  buildings: Phaser.Geom.Rectangle[]
) {

  if (!this.target) return;

  const distance = Phaser.Math.Distance.Between(
    this.x,
    this.y,
    this.target.x,
    this.target.y
  );

  // 已经到达目标
  if (distance < 3) {
    this.setPosition(this.target.x, this.target.y);
    this.target = null;
    return;
  }

  const radius = 13;

  // 减速开始距离
  const brakingDistance = 36;

  let nearestClearance = Infinity;

  // 计算工人距离最近建筑的净空距离
  for (const building of buildings) {

    const nearestX = Phaser.Math.Clamp(
      this.x,
      building.left,
      building.right
    );

    const nearestY = Phaser.Math.Clamp(
      this.y,
      building.top,
      building.bottom
    );

    const distanceToBuilding = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      nearestX,
      nearestY
    );

    const clearance = distanceToBuilding - radius;

    nearestClearance = Math.min(
      nearestClearance,
      clearance
    );
  }

  // 已经碰到建筑，立即停止
  if (nearestClearance <= 0) {
    this.target = null;
    return;
  }

  // 根据距离逐渐减速
  let speedFactor = 1;

  if (nearestClearance < brakingDistance) {

    speedFactor = Phaser.Math.Clamp(
      nearestClearance / brakingDistance,
      0.12,
      1
    );
  }

  const actualSpeed = this.speed * speedFactor;

  const step = Math.min(
    actualSpeed * delta / 1000,
    distance
  );

  const angle = Phaser.Math.Angle.Between(
    this.x,
    this.y,
    this.target.x,
    this.target.y
  );

  const nextX = this.x + Math.cos(angle) * step;
  const nextY = this.y + Math.sin(angle) * step;

  // 检查下一步是否会撞上建筑
  if (
    this.collidesWithBuildings(
      nextX,
      nextY,
      buildings
    )
  ) {

    // 碰撞后取消移动命令
    this.target = null;
    return;
  }

  this.setPosition(nextX, nextY);
}
}
