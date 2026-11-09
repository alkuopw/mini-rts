
import Phaser from 'phaser';
import BattleScene from './game/scenes/BattleScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: 960,
  height: 640,

  parent: 'app',

  backgroundColor: '#202820',

  scene: [BattleScene],

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  render: {
    antialias: true,
    pixelArt: true,
  },
};

new Phaser.Game(config);
