/**
 * ============================================================================
 * GAME INITIALIZATION
 * ============================================================================
 *
 * Functions for creating new game instances and initial snake states.
 * ============================================================================
 */

import * as ROT from 'rot-js';
import { ethers } from 'ethers';
import { ROWS, COLS, ACTORS } from './game-constants.js';

function createActorPlayer(x, y) {
  return {
    hp: 30,
    x: x,
    y: y,
    isPlayer: true,
    damage: 'd8+2',
  };
}

function createActorEnemy(x, y) {
  return {
    hp: 10,
    x: x,
    y: y,
    isPlayer: false,
    damage: 'd4+1',
  };
}
/**
 * Creates a new game state
 * @param {string} hostEoa - Host's Ethereum address (player 1)
 * @returns {GameState} Initial game state
 */
/**
 * Creates a new game state
 * @param {string} hostEoa - Host's Ethereum address (player 1)
 * @param {string} [guestEoa] - Guest's Ethereum address (player 2)
 * @returns {GameState} Initial game state
 */
export function createGame(hostEoa) {
  // Format addresses to proper checksum format
  // We assume caller handles checksum or we do it here if needed.
  // ethers.getAddress(hostEoa) if we want to be safe.

  const randomSeed = 12345;
  ROT.RNG.setSeed(randomSeed);

  const _map = new ROT.Map.Rogue(COLS, ROWS);
  _map.create();
  const actorList = [];
  const actorMap = {};

  const validpos = [];
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (!_map.map[x][y]) {
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
    } while (actorMap[x + '_' + y]);


    const actor = (e === 0)
      ? createActorPlayer(x, y)
      : createActorEnemy(x, y);

    // Assign ID or EOA to player actor
    if (actor.isPlayer) {
      actor.eoa = hostEoa;
      actor.id = 'player'; // Main player ID
    } else {
      actor.id = `enemy_${e}`;
    }

    actorMap[actor.x + '_' + actor.y] = actor;
    actorList.push(actor);
  }

  const player = actorList[0];

  return {
    randomSeed: randomSeed,
    randomState: ROT.RNG.getState(),
    map: _map,
    actorList: actorList,
    actorMap: actorMap,
    player: player,
    winner: null,
    isGameOver: false,
    gameTime: 0,
    playereoa: hostEoa,
  };
}


