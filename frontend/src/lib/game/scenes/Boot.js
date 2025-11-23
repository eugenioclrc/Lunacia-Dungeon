import Phaser from 'phaser';

export default class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        this.load.image('preloaderBackground', '/assets/images/progress_bar_background.png');
        this.load.image('preloaderBar', '/assets/images/progress_bar.png');
    }

    create() {
        this.scene.start('Preloader');
    }
}
