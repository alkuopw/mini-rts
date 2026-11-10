
import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import Unit from '../entities/Unit';
import WeaponPickup from '../entities/WeaponPickup';
interface BuildingFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}
export default class BattleScene extends Phaser.Scene {
  private mapContainer!: Phaser.GameObjects.Container;

// 电脑鼠标拖动
private dragging = false;
private lastPointerX = 0;
private lastPointerY = 0;

// 手机触屏
private activeTouches = new Map<
  number,
  { x: number; y: number }
>();

private touchPointerId = -1;
private touchStartX = 0;
private touchStartY = 0;
private touchLastX = 0;
private touchLastY = 0;

private touchMoved = false;
private touchMultiGesture = false;

// 双指缩放
private pinchStartDistance = 0;
private pinchStartScale = 1;
private pinchAnchorX = 0;
private pinchAnchorY = 0;
  private units: Unit[] = [];
  private selectedUnit: Unit | null = null;
  private weaponPickups: WeaponPickup[] = [];
  // 所有建筑的碰撞范围
private buildingObstacles: Phaser.Geom.Rectangle[] = [];
  // 所有建筑的占地记录
  private buildingFootprints: BuildingFootprint[] = [];
  constructor() {
    super('BattleScene');
  }

  create() {
    const { mapWidth, mapHeight, tileSize, colors } = GAME_CONFIG;

    this.cameras.main.setBackgroundColor(colors.background);

    this.mapContainer = this.add.container(0, 0);

    // 绘制地图
    const graphics = this.add.graphics();

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const color =
          (x + y) % 2 === 0
            ? colors.grass1
            : colors.grass2;

        graphics.fillStyle(color, 1);
        graphics.fillRect(
          x * tileSize,
          y * tileSize,
          tileSize,
          tileSize
        );
      }
    }

    // 绘制网格
    graphics.lineStyle(1, colors.grid, 0.35);

    for (let x = 0; x <= mapWidth; x++) {
      graphics.lineBetween(
        x * tileSize, 0,
        x * tileSize, mapHeight * tileSize
      );
    }

    for (let y = 0; y <= mapHeight; y++) {
      graphics.lineBetween(
        0, y * tileSize,
        mapWidth * tileSize, y * tileSize
      );
    }

    this.mapContainer.add(graphics);

    // 红队基地
    this.createBase(4, 4, colors.red, 'RED BASE');

    // 蓝队基地
    this.createBase(56, 56, colors.blue, 'BLUE BASE');
    // 随机生成六个工厂
    this.createRandomFactories(6);
    // 创建红队工人
    this.createUnit(6, 9, 'red');

    // 创建蓝队工人
    this.createUnit(54, 54, 'blue');
    // 在地图中央放置一把枪
    this.createWeaponPickup(30, 30);
    // 初始镜头位置
    this.mapContainer.setPosition(0, 0);

    // 鼠标拖动地图
    

// 禁止浏览器右键菜单
this.input.mouse?.disableContextMenu();

// 增加一个触屏指针：支持两根手指同时操作
this.input.addPointer(1);

// 禁止手机浏览器接管游戏画布的触摸手势
this.game.canvas.style.touchAction = 'none';


// ==============================
// 鼠标 / 触屏按下
// ==============================
this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {

  // ------------------------------
  // 手机触屏
  // ------------------------------
  if (pointer.wasTouch) {

    this.activeTouches.set(pointer.id, {
      x: pointer.x,
      y: pointer.y
    });

    // 第一根手指按下
    if (this.activeTouches.size === 1) {

      this.touchPointerId = pointer.id;

      this.touchStartX = pointer.x;
      this.touchStartY = pointer.y;

      this.touchLastX = pointer.x;
      this.touchLastY = pointer.y;

      this.touchMoved = false;
      this.touchMultiGesture = false;
    }

    // 第二根手指按下：开始双指缩放
    if (this.activeTouches.size === 2) {

      this.touchMultiGesture = true;
      this.touchMoved = true;

      const points = Array.from(this.activeTouches.values());

      const p1 = points[0];
      const p2 = points[1];

      this.pinchStartDistance = Math.max(
        1,
        Phaser.Math.Distance.Between(
          p1.x, p1.y,
          p2.x, p2.y
        )
      );

      this.pinchStartScale = this.mapContainer.scaleX;

      // 双指中心点
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // 记录中心点对应的地图坐标
      this.pinchAnchorX =
        (midX - this.mapContainer.x) / this.mapContainer.scaleX;

      this.pinchAnchorY =
        (midY - this.mapContainer.y) / this.mapContainer.scaleY;
    }

    return;
  }


  // ------------------------------
  // 电脑鼠标：左键选择 / 拖动地图
  // ------------------------------
  if (pointer.button === 0) {

    const point = this.getMapPoint(pointer);

    const clickedUnit = [...this.units]
      .reverse()
      .find(unit => unit.containsPoint(point.x, point.y));

    if (clickedUnit) {

      // 再次点击当前单位：取消选中
      if (this.selectedUnit === clickedUnit) {

        clickedUnit.setSelected(false);
        this.selectedUnit = null;

      } else {

        if (this.selectedUnit) {
          this.selectedUnit.setSelected(false);
        }

        this.selectedUnit = clickedUnit;
        clickedUnit.setSelected(true);
      }

      this.dragging = false;

    } else {

      // 点击空白地图：取消选中，并允许拖动地图
      if (this.selectedUnit) {
        this.selectedUnit.setSelected(false);
        this.selectedUnit = null;
      }

      this.dragging = true;

      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
    }

    return;
  }


  // ------------------------------
  // 电脑鼠标：右键移动工人
  // ------------------------------
  if (pointer.button === 2) {

    if (this.selectedUnit) {

      const point = this.getMapPoint(pointer);

      this.issueMoveOrder(
  this.selectedUnit,
  point.x,
  point.y
);
    }

    return;
  }

});


// ==============================
// 鼠标 / 触屏移动
// ==============================
this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {

  // ------------------------------
  // 手机触屏
  // ------------------------------
  if (this.activeTouches.has(pointer.id)) {

    // 更新当前手指位置
    this.activeTouches.set(pointer.id, {
      x: pointer.x,
      y: pointer.y
    });

    // 两根手指：缩放 + 平移
    if (this.activeTouches.size >= 2) {

      const points = Array.from(this.activeTouches.values());

      const p1 = points[0];
      const p2 = points[1];

      const distance = Math.max(
        1,
        Phaser.Math.Distance.Between(
          p1.x, p1.y,
          p2.x, p2.y
        )
      );

      // 计算新的缩放比例
      const newScale = Phaser.Math.Clamp(
        this.pinchStartScale *
        (distance / this.pinchStartDistance),
        0.5,
        2
      );

      this.mapContainer.setScale(newScale);

      // 保持双指中心下方的地图位置不变
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      this.mapContainer.x =
        midX - this.pinchAnchorX * newScale;

      this.mapContainer.y =
        midY - this.pinchAnchorY * newScale;

      return;
    }

    // 双指手势结束后，不把剩余手指当成新的单指操作
    if (this.touchMultiGesture) {
      return;
    }

    // 单指：判断是否真正拖动地图
    const distance = Phaser.Math.Distance.Between(
      this.touchStartX,
      this.touchStartY,
      pointer.x,
      pointer.y
    );

    // 超过 8 像素才算拖动
    if (!this.touchMoved && distance > 8) {
      this.touchMoved = true;
    }

    if (this.touchMoved) {

      const dx = pointer.x - this.touchLastX;
      const dy = pointer.y - this.touchLastY;

      this.mapContainer.x += dx;
      this.mapContainer.y += dy;

      this.touchLastX = pointer.x;
      this.touchLastY = pointer.y;
    }

    return;
  }


  // ------------------------------
  // 电脑鼠标：左键拖动地图
  // ------------------------------
  if (!this.dragging) return;
  if (!pointer.leftButtonDown()) return;

  const dx = pointer.x - this.lastPointerX;
  const dy = pointer.y - this.lastPointerY;

  this.mapContainer.x += dx;
  this.mapContainer.y += dy;

  this.lastPointerX = pointer.x;
  this.lastPointerY = pointer.y;

});


// ==============================
// 鼠标 / 触屏释放
// ==============================
this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {

  // ------------------------------
  // 手机触屏
  // ------------------------------
  if (this.activeTouches.has(pointer.id)) {

    // 只有单指点击才执行选择或移动
    if (
      this.activeTouches.size === 1 &&
      !this.touchMoved &&
      !this.touchMultiGesture &&
      pointer.id === this.touchPointerId
    ) {

      const point = this.getMapPoint(pointer);

      const clickedUnit = [...this.units]
        .reverse()
        .find(unit => unit.containsPoint(point.x, point.y));

      if (clickedUnit) {

        // 再次点击已经选中的工人：取消选中
        if (this.selectedUnit === clickedUnit) {

          clickedUnit.setSelected(false);
          this.selectedUnit = null;

        } else {

          // 点击其他工人：切换选中
          if (this.selectedUnit) {
            this.selectedUnit.setSelected(false);
          }

          this.selectedUnit = clickedUnit;
          clickedUnit.setSelected(true);
        }

      } else if (this.selectedUnit) {

        // 点击空白地图：让工人移动
        this.issueMoveOrder(
  this.selectedUnit,
  point.x,
  point.y
);
      }
    }

    // 移除已经松开的手指
    this.activeTouches.delete(pointer.id);

    // 所有手指都松开后，重置触屏状态
    if (this.activeTouches.size === 0) {

      this.touchPointerId = -1;
      this.touchMoved = false;
      this.touchMultiGesture = false;
    }

    return;
  }


  // ------------------------------
  // 电脑鼠标释放
  // ------------------------------
  this.dragging = false;

});


// ==============================
// 电脑鼠标滚轮缩放
// ==============================
this.input.on(
  'wheel',
  (
    _pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ) => {

    const scale = deltaY > 0 ? 0.9 : 1.1;

    this.mapContainer.setScale(
      Phaser.Math.Clamp(
        this.mapContainer.scaleX * scale,
        0.5,
        2
      )
    );
  }
);



    // 地图标题
    this.add.text(16, 16, 'MINI RTS - ALPHA 0.1', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#202820',
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(10);
  }

  private createBase(
  x: number,
  y: number,
  color: number,
  label: string
) {
  this.createBuilding(
    x,
    y,
    4,
    4,
    color,
    label,
    'base'
  );
}
  private createBuilding(
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  label: string,
  type: string
) {
  const { tileSize } = GAME_CONFIG;

  const building = this.add.graphics();

  // 建筑底部阴影
  building.fillStyle(0x222222, 0.5);
  building.fillRoundedRect(
    x * tileSize,
    y * tileSize,
    width * tileSize,
    height * tileSize,
    8
  );

  // 建筑主体
  building.fillStyle(color, 1);
  building.fillRoundedRect(
    x * tileSize + 6,
    y * tileSize + 6,
    width * tileSize - 12,
    height * tileSize - 12,
    6
  );

  // 建筑中央标志
  building.fillStyle(0xffffff, 0.8);
  building.fillRect(
    x * tileSize + width * tileSize / 2 - 12,
    y * tileSize + height * tileSize / 2 - 12,
    24,
    24
  );

  this.mapContainer.add(building);
// 登记建筑碰撞范围
this.buildingObstacles.push(
  new Phaser.Geom.Rectangle(
    x * tileSize,
    y * tileSize,
    width * tileSize,
    height * tileSize
  )
);
  // 建筑名称
  const text = this.add.text(
    x * tileSize,
    y * tileSize - 22,
    label,
    {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#202020',
      padding: { x: 4, y: 3 },
    }
  );

  this.mapContainer.add(text);

  // 登记建筑占地
  this.buildingFootprints.push({
    x,
    y,
    width,
    height,
    type
  });
}

private isBuildingAreaFree(
  x: number,
  y: number,
  width: number,
  height: number
): boolean {

  // 检查是否超出地图范围
  const { mapWidth, mapHeight } = GAME_CONFIG;

  if (
    x < 0 ||
    y < 0 ||
    x + width > mapWidth ||
    y + height > mapHeight
  ) {
    return false;
  }

  // 检查是否与已有建筑重叠
  for (const building of this.buildingFootprints) {

    const overlap =
      x < building.x + building.width &&
      x + width > building.x &&
      y < building.y + building.height &&
      y + height > building.y;

    if (overlap) {
      return false;
    }
  }

  return true;
}
private isWalkable(x: number, y: number): boolean {

  const { mapWidth, mapHeight } = GAME_CONFIG;

  if (
    x < 0 ||
    y < 0 ||
    x >= mapWidth ||
    y >= mapHeight
  ) {
    return false;
  }

  return !this.buildingFootprints.some(building => {

    return (
      x >= building.x &&
      x < building.x + building.width &&
      y >= building.y &&
      y < building.y + building.height
    );

  });
}
  // A* 寻路：计算从起点到目标点的路线
  private findPath(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): Phaser.Math.Vector2[] {

    const { tileSize } = GAME_CONFIG;

    // 将像素坐标转换成网格坐标
    const startGridX = Math.floor(startX / tileSize);
    const startGridY = Math.floor(startY / tileSize);

    const targetGridX = Math.floor(targetX / tileSize);
    const targetGridY = Math.floor(targetY / tileSize);

    // 起点或终点不可通行时，不生成路径
    if (
      !this.isWalkable(startGridX, startGridY) ||
      !this.isWalkable(targetGridX, targetGridY)
    ) {
      return [];
    }

    type Node = {
      x: number;
      y: number;
      g: number;
      h: number;
      f: number;
    };

    const key = (x: number, y: number) => `${x},${y}`;

    // 八个方向：上下左右以及四个对角方向
    const directions = [
      { x: 0, y: -1, cost: 1 },
      { x: 0, y: 1, cost: 1 },
      { x: -1, y: 0, cost: 1 },
      { x: 1, y: 0, cost: 1 },
      { x: -1, y: -1, cost: Math.SQRT2 },
      { x: 1, y: -1, cost: Math.SQRT2 },
      { x: -1, y: 1, cost: Math.SQRT2 },
      { x: 1, y: 1, cost: Math.SQRT2 },
    ];

    // 八方向移动使用欧几里得距离作为启发式
    const heuristic = (x: number, y: number) => {
      return Math.hypot(
        targetGridX - x,
        targetGridY - y
      );
    };

    const startNode: Node = {
      x: startGridX,
      y: startGridY,
      g: 0,
      h: heuristic(startGridX, startGridY),
      f: heuristic(startGridX, startGridY),
    };

    const openList: Node[] = [startNode];

    const closedSet = new Set<string>();

    const cameFrom = new Map<string, string>();

    const gScore = new Map<string, number>();

    gScore.set(key(startGridX, startGridY), 0);

    // 最多搜索地图上的全部格子，防止无限循环
    const maxIterations = GAME_CONFIG.mapWidth *
      GAME_CONFIG.mapHeight;

    let iterations = 0;

    while (
      openList.length > 0 &&
      iterations < maxIterations
    ) {
      iterations++;

      // 找到 f 值最小的节点
      let bestIndex = 0;

      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[bestIndex].f) {
          bestIndex = i;
        }
      }

      const current = openList.splice(bestIndex, 1)[0];

      const currentKey = key(current.x, current.y);

      // 到达终点，开始还原路径
      if (
        current.x === targetGridX &&
        current.y === targetGridY
      ) {
        const path: Phaser.Math.Vector2[] = [];

        let traceKey = currentKey;

        while (traceKey !== key(startGridX, startGridY)) {
          const [x, y] = traceKey.split(',').map(Number);

          path.unshift(
            new Phaser.Math.Vector2(
              x * tileSize + tileSize / 2,
              y * tileSize + tileSize / 2
            )
          );

          const previousKey = cameFrom.get(traceKey);

          if (!previousKey) {
            return [];
          }

          traceKey = previousKey;
        }

        return path;
      }

      closedSet.add(currentKey);

      // 检查周围八个方向
      for (const direction of directions) {
        const nextX = current.x + direction.x;
        const nextY = current.y + direction.y;

        const nextKey = key(nextX, nextY);

        if (
          closedSet.has(nextKey) ||
          !this.isWalkable(nextX, nextY)
        ) {
          continue;
        }

        // 不允许斜着穿过建筑的角
        if (direction.x !== 0 && direction.y !== 0) {
          if (
            !this.isWalkable(current.x + direction.x, current.y) ||
            !this.isWalkable(current.x, current.y + direction.y)
          ) {
            continue;
          }
        }

        const tentativeG =
          current.g + direction.cost;

        const previousG = gScore.get(nextKey) ?? Infinity;

        if (tentativeG >= previousG) {
          continue;
        }

        cameFrom.set(nextKey, currentKey);

        gScore.set(nextKey, tentativeG);

        const h = heuristic(nextX, nextY);

        const existingIndex = openList.findIndex(
          node => node.x === nextX && node.y === nextY
        );

        const nextNode: Node = {
          x: nextX,
          y: nextY,
          g: tentativeG,
          h,
          f: tentativeG + h,
        };

        if (existingIndex >= 0) {
          openList[existingIndex] = nextNode;
        } else {
          openList.push(nextNode);
        }
      }
    }

    // 没有找到可行路线
    return [];
  }
    // 向选中的工人下达寻路移动命令
  private issueMoveOrder(
    unit: Unit,
    targetX: number,
    targetY: number
  ) {
    const path = this.findPath(
      unit.x,
      unit.y,
      targetX,
      targetY
    );

    // 找不到路线时，不改变当前移动状态
    if (path.length === 0) {
      return;
    }

    unit.setMovePath(path);
  }
private createRandomFactories(count: number) {

  const { mapWidth, mapHeight } = GAME_CONFIG;

  const factoryWidth = 3;
  const factoryHeight = 3;

  // 地图边缘至少保留两格
  const margin = 2;

  let created = 0;

  // 防止地图空间不足时无限循环
  let attempts = 0;
  const maxAttempts = 1000;

  while (
    created < count &&
    attempts < maxAttempts
  ) {

    attempts++;

    // 随机生成左上角方格坐标
    const x = Phaser.Math.Between(
      margin,
      mapWidth - margin - factoryWidth
    );

    const y = Phaser.Math.Between(
      margin,
      mapHeight - margin - factoryHeight
    );

    // 检查位置是否合法
    if (
      !this.isBuildingAreaFree(
        x,
        y,
        factoryWidth,
        factoryHeight
      )
    ) {
      continue;
    }

    // 创建工厂
    this.createBuilding(
      x,
      y,
      factoryWidth,
      factoryHeight,
      0x9a9a48,
      'FACTORY',
      'factory'
    );

    created++;
  }

  console.log(
    `成功生成 ${created}/${count} 个工厂`
  );
}
  private createUnit(
    gridX: number,
    gridY: number,
    team: 'red' | 'blue'
  ) {
    const { tileSize } = GAME_CONFIG;

    const unit = new Unit(
      this,
      gridX * tileSize + tileSize / 2,
      gridY * tileSize + tileSize / 2,
      team
    );

    this.mapContainer.add(unit);
    this.units.push(unit);
  }
private createWeaponPickup(gridX: number, gridY: number) {
  const { tileSize } = GAME_CONFIG;

  const pickup = new WeaponPickup(
    this,
    gridX * tileSize + tileSize / 2,
    gridY * tileSize + tileSize / 2
  );

  this.mapContainer.add(pickup);
  this.weaponPickups.push(pickup);
}
  private getMapPoint(pointer: Phaser.Input.Pointer) {
    return {
      x: (pointer.x - this.mapContainer.x) / this.mapContainer.scaleX,
      y: (pointer.y - this.mapContainer.y) / this.mapContainer.scaleY,
    };
  }

  update(_time: number, delta: number) {
  for (const unit of this.units) {
    unit.updateUnit(
  delta,
  this.buildingObstacles
);

    // 已经持枪的单位不再拾取
    if (unit.hasWeapon()) continue;

    for (const pickup of [...this.weaponPickups]) {
      const distance = Phaser.Math.Distance.Between(
        unit.x,
        unit.y,
        pickup.x,
        pickup.y
      );

      // 接近枪械后自动拾取
      if (distance <= 30) {
        unit.takeWeapon();

        this.mapContainer.remove(pickup, true);

        this.weaponPickups = this.weaponPickups.filter(
          item => item !== pickup
        );

        break;
      }
    }
  }
}

}
