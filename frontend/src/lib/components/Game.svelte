<script>
// @ts-nocheck
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';

    let game;
    let gameContainer;

    onMount(async () => {
        if (browser) {
            
            const Phaser = await import('phaser');
            const { default: Boot } = await import('$lib/game/scenes/Boot');
            const { default: Preloader } = await import('$lib/game/scenes/Preloader');
            const { default: Arena } = await import('$lib/game/scenes/Arena');

            const config = {
                type: Phaser.AUTO,
                width: 800,
                height: 768,
                parent: gameContainer,
                pixelArt: true,
                scene: [Boot, Preloader, Arena],
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { x: 0, y: 0 }
                    }
                }
            };

            game = new Phaser.Game(config);
        }
    });

    onDestroy(() => {
        if (game) {
            game.destroy(true);
        }
    });
</script>

<div bind:this={gameContainer} id="game-container"></div>

<style>
    #game-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 800px;
        height: 768px;
        margin: 0 auto;
    }
</style>
