
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
  // A* 生成的移动路径
private movePath: Phaser.Math.Vector2[] = [];

// 当前正在前往的路径节点
private pathIndex = 0;

// 最低移动速度
private minSpeed = 30;

// 开始减速的距离
private brakingDistance = 48;

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

  // 普通移动命令清除旧路径
  this.movePath = [];
  this.pathIndex = 0;
}

setMovePath(path: Phaser.Math.Vector2[]) {
  // 保存新路径
  this.movePath = path.map(
    point => new Phaser.Math.Vector2(point.x, point.y)
  );

  this.pathIndex = 0;

  if (this.movePath.length === 0) {
    this.target = null;
    return;
  }

  // 最后一个节点就是最终目标
  const lastPoint = this.movePath[this.movePath.length - 1];

  this.target = lastPoint.clone();
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
  // 没有移动目标
  if (!this.target) return;

  // 当前应该前往的路径节点
  const currentPoint = this.movePath.length > 0
    ? this.movePath[this.pathIndex]
    : this.target;

  if (!currentPoint) {
    this.target = null;
    return;
  }

  // 计算距离当前路径节点的距离
  const distance = Phaser.Math.Distance.Between(
    this.x,
    this.y,
    currentPoint.x,
    currentPoint.y
  );

  // 到达当前节点
  if (distance < 3) {

    this.setPosition(
      currentPoint.x,
      currentPoint.y
    );

    // 如果还有下一个路径节点
    if (this.movePath.length > 0) {
      this.pathIndex++;

      // 所有节点都已经走完
      if (this.pathIndex >= this.movePath.length) {
        this.movePath = [];
        this.pathIndex = 0;
        this.target = null;
      }

      return;
    }

    // 普通直线移动已经到达目标
    this.target = null;
    return;
  }

  const radius = 13;

  // 计算距离最近建筑的净空距离
  let nearestClearance = Infinity;

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

  // 如果已经碰到建筑，停止移动
  if (nearestClearance <= 0) {
    this.target = null;
    this.movePath = [];
    this.pathIndex = 0;
    return;
  }

  // 根据建筑距离计算速度
  let actualSpeed = this.speed;

  if (nearestClearance < this.brakingDistance) {

    const speedRatio = Phaser.Math.Clamp(
      nearestClearance / this.brakingDistance,
      0,
      1
    );

    // 在最低速度与正常速度之间平滑变化
    actualSpeed = this.minSpeed +
      (this.speed - this.minSpeed) * speedRatio;
  }

  // 计算这一帧可以移动的距离
  const step = Math.min(
    actualSpeed * delta / 1000,
    distance
  );

  const angle = Phaser.Math.Angle.Between(
    this.x,
    this.y,
    currentPoint.x,
    currentPoint.y
  );

  const nextX = this.x + Math.cos(angle) * step;
  const nextY = this.y + Math.sin(angle) * step;

  // 防止移动过程中穿过建筑
  if (
    this.collidesWithBuildings(
      nextX,
      nextY,
      buildings
    )
  ) {
    this.target = null;
    this.movePath = [];
    this.pathIndex = 0;
    return;
  }

  this.setPosition(nextX, nextY);
}
}
