// @ts-nocheck
import Phaser from 'phaser';
import * as ROT from 'rot-js';
import { getGameSocket } from '$lib/gamesocket';
import { getStoredSessionKey } from '$lib/sessionutils';
import { createECDSAMessageSigner } from '@erc7824/nitrolite';


const ROWS = 50;
const COLS = 50;
const ACTORS = 25;

function socketMove(dir) {
    let socket = getGameSocket();


    const existingSessionKey = getStoredSessionKey();

    // ✅ CRITICAL: Sign the EXACT requestToSign array that server sent
    // DO NOT use createAppSessionMessage() - that creates a NEW message with NEW timestamp
    // The server already created the message, we just need to sign it
    const signer = createECDSAMessageSigner(existingSessionKey.privateKey);
    console.log("Client signing requestToSign array:", {type: 'move', payload: dir});

    // Sign the requestToSign array directly
    signer({type: 'move', payload: dir}).then((signature) => {
        console.log("Client signature created:", signature);
        socket.send(JSON.stringify({type: 'move', payload: dir, signature: signature}));
    });
}

export default class Arena extends Phaser.Scene {
    constructor() {
        let socket = getGameSocket();
        
        socket.addMessageListener((message) => {
            console.log('message', message);
        });

        const existingSessionKey = getStoredSessionKey();

        // ✅ CRITICAL: Sign the EXACT requestToSign array that server sent
        // DO NOT use createAppSessionMessage() - that creates a NEW message with NEW timestamp
        // The server already created the message, we just need to sign it
        const signer = createECDSAMessageSigner(existingSessionKey.privateKey);
        console.log("Client signing requestToSign array:", {type: 'startGame'});

        // Sign the requestToSign array directly
        signer({type: 'startGame'}).then((signature) => {
            console.log("Client signature created:", signature);
            socket.send(JSON.stringify({type: 'startGame', signature: signature}));
        });

        ROT.RNG.setSeed(12345);

        super('Arena');
        this.mapData = null;
        this.actorList = [];
        this.actorMap = {};
        this.player = null;
        this.playerHUD = null;
        this.clickeable = true;

        // Map helper object
        this.Map = {
            tiles: null,
            rotmap: null,
            phaserMap: null,
            lightDict: {},
            scene: null, // Reference to scene

            initMap: function (rotmap, phaserMap, scene) {
                this.rotmap = rotmap;
                this.phaserMap = phaserMap;
                this.scene = scene;
                this.tiles = JSON.parse(JSON.stringify(rotmap.map));
            },

            canGo: function (actor, dir) {
                return actor.x + dir.x >= 0 &&
                    actor.x + dir.x < COLS &&
                    actor.y + dir.y >= 0 &&
                    actor.y + dir.y < ROWS &&
                    this.tiles[actor.x + dir.x][actor.y + dir.y] === 0;
            },

            light: function () {
                const lightPasses = (x, y) => {
                    return typeof this.tiles[x] === 'undefined' ||
                        typeof this.tiles[x][y] === 'undefined' ||
                        this.tiles[x][y] === 0;
                };

                this.resetLight();

                this.fov = new ROT.FOV.PreciseShadowcasting(lightPasses);
                this.computeLight();
            },

            resetLight: function () {
                for (let x = 0; x < COLS; x++) {
                    for (let y = 0; y < ROWS; y++) {
                        let tile = this.phaserMap.getTileAt(x, y, true, 'ground');
                        if (tile) tile.alpha = 0;

                        tile = this.phaserMap.getTileAt(x, y, true, 'decoration');
                        if (tile) tile.alpha = 0;
                    }
                }
            },

            computeLight: function () {
                this.resetLight();

                this.scene.actorList.forEach(a => {
                    a.sprite.alpha = 0;
                });

                if (this.scene.actorList[0]) {
                    this.scene.actorList[0].sprite.alpha = 1;

                    this.fov.compute(this.scene.actorList[0].x, this.scene.actorList[0].y, 10, (x, y, r, visibility) => {
                        let tile = this.phaserMap.getTileAt(x, y, true, 'ground');
                        if (tile) tile.alpha = visibility;

                        tile = this.phaserMap.getTileAt(x, y, true, 'decoration');
                        if (tile) tile.alpha = visibility;

                        const key = x + '_' + y;
                        if (this.scene.actorMap.hasOwnProperty(key)) {
                            this.scene.actorMap[key].sprite.alpha = visibility;
                        }
                    });
                }
            }
        };

        this.HUD = {
            scene: null,
            msg: function (text, sprite, speed, color) {
                const y = sprite.y - 15;
                const x = sprite.x + sprite.width / 3;

                color = (color) ? color : '#ff0044';

                const style = { font: 'bold 19px Courier New, Courier', fill: color, align: 'center' };
                const textObj = this.scene.add.text(x, y, text, style);

                this.scene.tweens.add({
                    targets: textObj,
                    alpha: { from: 1, to: 0 },
                    duration: speed,
                    ease: 'Linear',
                    onComplete: () => {
                        textObj.destroy();
                    }
                });
            }
        };
    }

    create() {
        this.cameras.main.setBackgroundColor('#2e203c');
        this.cursors = this.input.keyboard.createCursorKeys();

        this.HUD.scene = this;

        const mapData = this.generateMap('ROTmap', COLS, ROWS, 32, 32);

        // Add to cache
        this.cache.tilemap.add('ROTmap', { format: Phaser.Tilemaps.Formats.TILED_JSON, data: mapData });

        const map = this.make.tilemap({ key: 'ROTmap' });
        const tileset = map.addTilesetImage('forest-tiles', 'forest-tiles');

        const layer1 = map.createLayer('ground', tileset, 0, 0);
        // layer1.resizeWorld(); // Not needed in Phaser 3, camera bounds set automatically or manually

        const layer2 = map.createLayer('decoration', tileset, 0, 0);

        this.physics.world.bounds.width = map.widthInPixels;
        this.physics.world.bounds.height = map.heightInPixels;
        this.cameras.main.setBounds(0, 0, map.widthInPixels * 32, map.heightInPixels * 32);

        // Input handling
        this.input.keyboard.on('keyup', (event) => this.onKeyUp(event));
        this.input.on('pointerdown', (pointer) => this.mouseCallback(pointer));

        this.Map.initMap(this.mapData, map, this);
        this.initActors();
        this.Map.light();

        const style = { font: '16px monospace', fill: '#fff' };
        this.playerHUD = this.add.text(0, 0, 'Player life: ' + this.actorList[0].hp, style);
        this.playerHUD.setScrollFactor(0); // Fixed to camera
        this.playerHUD.setPosition(500, 50);
    }

    generateMap(keyName, width, height, tilewidth, tileheight) {
        const _map = new ROT.Map.Rogue(width, height);
        this.mapData = _map; // Store ROT map reference

        const jsonmap = {
            layers: [{
                data: new Array(width * height),
                height: height,
                name: 'ground',
                opacity: 1,
                type: 'tilelayer',
                visible: true,
                width: width,
                x: 0,
                y: 0
            }, {
                data: [],
                height: height,
                name: 'decoration',
                opacity: 1,
                type: 'tilelayer',
                visible: true,
                width: width,
                x: 0,
                y: 0
            }],
            orientation: 'orthogonal',
            properties: {},
            tileheight: tileheight,
            tilesets: [{
                firstgid: 1,
                image: 'assets/images/foresttiles_0.png',
                imagewidth: 160,
                imageheight: 224,
                margin: 0,
                name: 'forest-tiles',
                properties: {},
                spacing: 0,
                tileheight: tileheight,
                tilewidth: tilewidth
            }],
            tilewidth: tilewidth,
            version: 1,
            height: tileheight,
            width: tilewidth
        };

        const ARENA = 35;
        let tilepos;

        _map.create((x, y, v) => {
            jsonmap.layers[0].data[y * width + x] = (v === 1) ? 0 : ARENA;
        });

        const _exist = (x, y) => {
            return (
                typeof _map.map[x] !== 'undefined'
                && typeof _map.map[x][y] !== 'undefined'
                && _map.map[x][y] === 0
            ) ? '1' : '0';
        };

        const cbSetBackground = (tile) => {
            return () => {
                jsonmap.layers[0].data[tilepos] = ARENA;
                jsonmap.layers[1].data[tilepos] = tile;
            };
        };

        const patternArray = [];
        const addPattern = (pattern, cb) => {
            patternArray.push({
                regex: new RegExp(pattern.replace(/\*/g, '[0-1]')),
                cb: cb
            });
        };

        // Patterns (copied from original)
        addPattern('0000*0*1*', (tilepos, x, y) => { cbSetBackground(14)(); if (y > 0) jsonmap.layers[1].data[(y - 1) * width + x] = 9; });
        addPattern('0000*01*1', (tilepos, x, y) => { cbSetBackground(14)(); if (y > 0) jsonmap.layers[1].data[(y - 1) * width + x] = 9; });
        addPattern('0000*0001', (tilepos, x, y) => { cbSetBackground(6)(); if (y > 0) jsonmap.layers[1].data[(y - 1) * width + x] = 1; });
        addPattern('00*0*1*11', (tilepos, x, y) => { cbSetBackground(15)(); if (y > 0) jsonmap.layers[1].data[(y - 1) * width + x] = 10; });
        addPattern('00*0*1101', (tilepos, x, y) => { cbSetBackground(15)(); if (y > 0) jsonmap.layers[1].data[(y - 1) * width + x] = 10; });
        addPattern('0000*0100', (tilepos, x, y) => { cbSetBackground(7)(); if (y > 0) jsonmap.layers[1].data[(y - 1) * width + x] = 2; });
        addPattern('00*0*100*', cbSetBackground(10));
        addPattern('*1*0*0000', cbSetBackground(4));
        addPattern('**10*0000', cbSetBackground(11));
        addPattern('1110**001', cbSetBackground(5));
        addPattern('*001*0*00', cbSetBackground(8));
        addPattern('*00**011*', cbSetBackground(13));
        addPattern('*1*1*0*00', cbSetBackground(3));
        addPattern('1****0*00', cbSetBackground(12));
        addPattern('**10**00*', cbSetBackground(5));
        addPattern('0010*0111', cbSetBackground(15));
        addPattern('*001*01*1', cbSetBackground(13));

        addPattern('*1****1*', () => {
            jsonmap.layers[0].data[tilepos] = ARENA;
            const f = [18, 23, 18];
            jsonmap.layers[1].data[tilepos] = f[Math.floor((ROT.RNG.getUniform() * 3))];
        });
        addPattern('***1*1***', () => {
            jsonmap.layers[0].data[tilepos] = ARENA;
            const f = [18, 23, 18];
            jsonmap.layers[1].data[tilepos] = f[Math.floor((ROT.RNG.getUniform() * 3))];
        });

        for (let y = 0; y < _map._height; y++) {
            for (let x = 0; x < _map._width; x++) {
                jsonmap.layers[1].data.push(0);
                if (_map.map[x][y] === 0) continue;

                tilepos = y * width + x;

                const direction =
                    _exist(x - 1, y - 1) + _exist(x, y - 1) + _exist(x + 1, y - 1) +
                    _exist(x - 1, y) + '1' + _exist(x + 1, y) +
                    _exist(x - 1, y + 1) + _exist(x, y + 1) + _exist(x + 1, y + 1);

                for (let i = 0; i < patternArray.length; i++) {
                    if (patternArray[i].regex.test(direction)) {
                        patternArray[i].cb(tilepos, x, y);
                        break;
                    }
                }
            }
        }

        return jsonmap;
    }

    mouseCallback(pointer) {
        if (this.clickeable && pointer.isDown) {
            this.clickeable = false;
            this.time.delayedCall(400, () => { this.clickeable = true; });

            const x = pointer.worldX;
            const y = pointer.worldY;
            const dx = Math.abs(this.player.sprite.x - x);
            const dy = Math.abs(this.player.sprite.y - y);

            if (dx > dy) {
                if (x > this.player.sprite.x) this.onKeyUp({ keyCode: Phaser.Input.Keyboard.KeyCodes.RIGHT });
                else this.onKeyUp({ keyCode: Phaser.Input.Keyboard.KeyCodes.LEFT });
            } else {
                if (y > this.player.sprite.y) this.onKeyUp({ keyCode: Phaser.Input.Keyboard.KeyCodes.DOWN });
                else this.onKeyUp({ keyCode: Phaser.Input.Keyboard.KeyCodes.UP });
            }
        }
    }

    onKeyUp(event) {
        if (!this.actorList[0].isPlayer) return;

        let acted = false;
        const codes = Phaser.Input.Keyboard.KeyCodes;

        if (event.keyCode === codes.LEFT) acted = this.moveTo(this.player, { x: -1, y: 0 });
        else if (event.keyCode === codes.RIGHT) acted = this.moveTo(this.player, { x: 1, y: 0 });
        else if (event.keyCode === codes.UP) acted = this.moveTo(this.player, { x: 0, y: -1 });
        else if (event.keyCode === codes.DOWN) acted = this.moveTo(this.player, { x: 0, y: 1 });
        
      

        if (acted) {
            this.Map.computeLight();
            for (let i = 1; i < this.actorList.length; i++) {
                this.aiAct(this.actorList[i]);
            }
        }
    }

    moveTo(actor, dir) {
        if (!this.Map.canGo(actor, dir)) return false;

        socketMove(dir);

        if (dir.x === 1) actor.sprite.setFrame(2);
        else if (dir.x === -1) actor.sprite.setFrame(3);
        else if (dir.y === -1) actor.sprite.setFrame(1);
        else if (dir.y === 1) actor.sprite.setFrame(0);

        const newKey = (actor.x + dir.x) + '_' + (actor.y + dir.y);

        if (this.actorMap.hasOwnProperty(newKey) && this.actorMap[newKey]) {
            const victim = this.actorMap[newKey];
            if (!actor.isPlayer && !victim.isPlayer) return;

            const damage = this.diceRoll('d8+2').total;
            victim.hp -= damage;

            const axis = (actor.x === victim.x) ? 'y' : 'x';
            let moveDir = victim[axis] - actor[axis];
            moveDir = moveDir / Math.abs(moveDir);

            const pos1 = {}, pos2 = {};
            pos1[axis] = actor.sprite[axis] + (moveDir * 15);
            pos2[axis] = actor.sprite[axis] + (moveDir * 15 * -1);

            this.cameras.main.stopFollow();

            this.tweens.add({
                targets: actor.sprite,
                ...pos1,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    this.cameras.main.startFollow(actor.sprite);
                }
            });

            const color = victim.isPlayer ? null : '#fff';
            this.HUD.msg(damage.toString(), victim.sprite, 450, color);

            if (victim.isPlayer) {
                this.playerHUD.setText('Player life: ' + victim.hp);
            }

            if (victim.hp <= 0) {
                victim.sprite.destroy();
                delete this.actorMap[newKey];
                this.actorList.splice(this.actorList.indexOf(victim), 1);
                if (victim !== this.player) {
                    if (this.actorList.length === 1) {
                        const victory = this.add.text(
                            this.cameras.main.centerX,
                            this.cameras.main.centerY,
                            'Victory!\nCtrl+r to restart', {
                            fill: '#2e2',
                            align: 'center'
                        }
                        );
                        victory.setOrigin(0.5);
                        victory.setScrollFactor(0);
                    }
                }
            }
        } else {
            delete this.actorMap[actor.x + '_' + actor.y];
            actor.setXY(actor.x + dir.x, actor.y + dir.y);
            this.actorMap[actor.x + '_' + actor.y] = actor;
        }
        return true;
    }

    initActors() {
        this.actorList = [];
        this.actorMap = {};

        const validpos = [];
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (!this.Map.tiles[x][y]) {
                    validpos.push({ x: x, y: y });
                }
            }
        }

        for (let e = 0; e < ACTORS; e++) {
            let x, y;
            do {
                const r = validpos[Math.floor(ROT.RNG.getUniform() * validpos.length)];
                x = r.x;
                y = r.y;
            } while (this.actorMap[x + '_' + y]);

            const actor = (e === 0)
                ? new Player(this, x, y)
                : new Enemy(this, x, y);

            this.actorMap[actor.x + '_' + actor.y] = actor;
            this.actorList.push(actor);
        }

        this.player = this.actorList[0];
        this.cameras.main.startFollow(this.player.sprite);
    }

    aiAct(actor) {
        let directions = [
            { x: -1, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: -1 },
            { x: 0, y: 1 }
        ];

        const dx = this.player.x - actor.x;
        const dy = this.player.y - actor.y;

        const moveToRandomPos = () => {
            const rndDirections = this.shuffleArray(directions);
            for (let i = 0; i < rndDirections.length; i++) {
                if (this.moveTo(actor, rndDirections[i])) break;
            }
        };

        if (Math.abs(dx) + Math.abs(dy) > 6) {
            moveToRandomPos();
        } else {
            directions = directions.map(e => {
                return {
                    x: e.x,
                    y: e.y,
                    dist: Math.pow(dx + e.x, 2) + Math.pow(dy + e.y, 2)
                };
            }).sort((a, b) => b.dist - a.dist);

            for (let d = 0; d < directions.length; d++) {
                if (this.moveTo(actor, directions[d])) break;
            }
        }

        if (this.player.hp < 1) {
            const gameOver = this.add.text(0, 0, 'Game Over\nCtrl+r to restart', { fill: '#e22', align: 'center' });
            gameOver.setScrollFactor(0);
            gameOver.setPosition(this.cameras.main.centerX, this.cameras.main.centerY);
            gameOver.setOrigin(0.5);
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(ROT.RNG.getUniform() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    diceRoll(data) {
        data = ' ' + data;
        const dataSplit = data.split(/-|\+|d/g);
        let dices = parseInt(dataSplit[0], 10);
        if (!dices) dices = 1;
        const sides = parseInt(dataSplit[1], 10);

        let number = 0;
        for (let i = 0; i < dices; i++) {
            number += 1 + Math.floor(ROT.RNG.getUniform() * sides);
        }

        let bonus = 0;
        if (dataSplit[2]) {
            bonus = parseInt(dataSplit[2], 10);
            if (data.indexOf('-') > -1) bonus = bonus * -1;
        }

        return { total: number + bonus };
    }
}

class Actor {
    constructor(scene, x, y, keySprite) {
        this.hp = 3;
        this.x = x;
        this.y = y;
        this.isPlayer = null;
        this.damage = 'd8+2';
        this.scene = scene;

        if (scene) {
            this.sprite = scene.add.sprite(x * 32, y * 32, keySprite);
            this.sprite.setOrigin(0);
        }
    }

    setXY(x, y) {
        this.x = x;
        this.y = y;

        this.scene.tweens.add({
            targets: this.sprite,
            x: x * 32,
            y: y * 32,
            duration: 150,
            ease: 'Linear'
        });
    }
}

class Player extends Actor {
    constructor(scene, x, y) {
        super(scene, x, y, 'hero');
        this.hp = 30;
        this.isPlayer = true;
        this.damage = 'd6+2';
    }
}

class Enemy extends Actor {
    constructor(scene, x, y) {
        super(scene, x, y, 'orc');
        this.hp = 10;
        this.isPlayer = false;
        this.damage = 'd4+2';
    }
}
