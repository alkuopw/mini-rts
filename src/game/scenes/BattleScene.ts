
import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import Unit from '../entities/Unit';
import WeaponPickup from '../entities/WeaponPickup';
export default class BattleScene extends Phaser.Scene {
  private mapContainer!: Phaser.GameObjects.Container;
  private dragging = false;
  private dragButton: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
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
    
this.input.mouse?.disableContextMenu();

this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {

  // 左键：选择单位
  if (pointer.button === 0) {
    const point = this.getMapPoint(pointer);

    const clickedUnit = [...this.units]
      .reverse()
      .find(unit => unit.containsPoint(point.x, point.y));

    if (clickedUnit) {
      if (this.selectedUnit) {
        this.selectedUnit.setSelected(false);
      }

      this.selectedUnit = clickedUnit;
      clickedUnit.setSelected(true);

      this.dragging = false;
      this.dragButton = null;

    } else {
      // 点击空白地图：开始拖动，但不取消选中
      this.dragging = true;
      this.dragButton = 0;

      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
    }

    return;
  }

  // 右键：移动选中的单位
  if (pointer.button === 2) {

    if (this.selectedUnit) {
      const point = this.getMapPoint(pointer);

      this.selectedUnit.setMoveTarget(point.x, point.y);
    }

    // 右键同时允许拖动地图
    this.dragging = true;
    this.dragButton = 2;

    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;

    return;
  }

});


    this.input.on('pointerup', () => {

  this.dragging = false;
  this.dragButton = null;

});

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {

  if (!this.dragging) return;

  if (this.dragButton === 0 && !pointer.leftButtonDown()) return;
  if (this.dragButton === 2 && !pointer.rightButtonDown()) return;

  const dx = pointer.x - this.lastPointerX;
  const dy = pointer.y - this.lastPointerY;

  this.mapContainer.x += dx;
  this.mapContainer.y += dy;

  this.lastPointerX = pointer.x;
  this.lastPointerY = pointer.y;

});

    // 鼠标滚轮缩放
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
