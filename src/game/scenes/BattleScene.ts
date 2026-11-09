
import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import Unit from '../entities/Unit';
import WeaponPickup from '../entities/WeaponPickup';
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

      this.selectedUnit.setMoveTarget(
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
        this.selectedUnit.setMoveTarget(
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
    const { tileSize } = GAME_CONFIG;

    const base = this.add.graphics();

    base.fillStyle(0x222222, 0.5);
    base.fillRoundedRect(
      x * tileSize,
      y * tileSize,
      tileSize * 4,
      tileSize * 4,
      8
    );

    base.fillStyle(color, 1);
    base.fillRoundedRect(
      x * tileSize + 6,
      y * tileSize + 6,
      tileSize * 4 - 12,
      tileSize * 4 - 12,
      6
    );

    base.fillStyle(0xffffff, 0.8);
    base.fillRect(
      x * tileSize + 40,
      y * tileSize + 40,
      48,
      48
    );

    this.mapContainer.add(base);

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
    unit.updateUnit(delta);

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
