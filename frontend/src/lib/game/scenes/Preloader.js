// @ts-nocheck
import Phaser from 'phaser';

export default class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.background = this.add.sprite(width / 2, height / 2, 'preloaderBackground');
        this.background.setOrigin(0.5);

        this.preloadBar = this.add.sprite(width / 2, height / 2, 'preloaderBar');
        this.preloadBar.setOrigin(0.5);

        this.load.on('progress', (value) => {
            this.preloadBar.setScale(value, 1);
        });

        this.load.image('forest-tiles', '/assets/images/foresttiles_0.png');
        // Loading as spritesheet as well if needed, but using different key to avoid conflict if any
        this.load.spritesheet('forest-tiles-sheet', '/assets/images/foresttiles_0.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('hero', '/assets/images/hero.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('orc', '/assets/images/orc.png', { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        this.scene.start('Arena');
    }
}
