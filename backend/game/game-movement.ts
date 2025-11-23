/**
 * ============================================================================
 * MOVEMENT & COLLISION DETECTION
 * ============================================================================
 *
 * Core game logic for roguelike movement, collision detection, and game updates.
 * ============================================================================
 */

import { ethers } from 'ethers';
import { GRID_WIDTH, GRID_HEIGHT, DIRECTIONS } from './game-constants.js';

/**
 * Moves an actor in a given direction
 * @param {GameState} gameState - Current game state
 * @param {string} actorId - ID of the actor to move (or 'player' for the main player)
 * @param {string} direction - Direction to move
 * @returns {Object} Result with success flag and updated game state
 */
export function moveActor(gameState, actorId, direction) {
  let actor;

  // Find the actor
  if (actorId === 'player') {
    actor = gameState.player;
  } else {
    // Find actor in list
    actor = gameState.actorList.find(a => a.id === actorId);
  }

  if (!actor) {
    return { success: false, error: 'Actor not found' };
  }

  // Calculate new position
  let newX = actor.x;
  let newY = actor.y;

  switch (direction) {
    case DIRECTIONS.UP:
      newY--;
      break;
    case DIRECTIONS.DOWN:
      newY++;
      break;
    case DIRECTIONS.LEFT:
      newX--;
      break;
    case DIRECTIONS.RIGHT:
      newX++;
      break;
    default:
      return { success: false, error: 'Invalid direction' };
  }

  // Check bounds
  if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
    return { success: false, error: 'Out of bounds' };
  }

  // Check for walls (using the map from game state)
  // Assuming map is a 2D array where 0 is floor and 1 is wall, or similar ROT.js structure
  // If map is ROT.js map, we might need to check how it's stored.
  // Based on game-init.ts, _map.map[x][y] stores the value.
  // Let's assume 0 is empty/floor.
  if (gameState.map.map[newX][newY] !== 0) {
    return { success: false, error: 'Blocked by wall' };
  }

  if (gameState.lastMove && +new Date() - gameState.lastMove < 1000) {
    return { success: false, error: 'TOO_FAST' };
  }

  // Check for other actors
  const targetKey = newX + '_' + newY;
  const targetActor = gameState.actorMap[targetKey];

  if (targetActor) {
    // Combat logic could go here
    // For now, just block movement
    return { success: false, error: 'Blocked by actor' };
  }

  // Move the actor
  // Update actorMap
  const oldKey = actor.x + '_' + actor.y;
  delete gameState.actorMap[oldKey];

  actor.x = newX;
  actor.y = newY;

  gameState.actorMap[targetKey] = actor;
  gameState.lastMove = +new Date();

  return {
    success: true,
    gameState: gameState
  };
}

/**
 * Changes player direction (which triggers a move in turn-based)
 * @param {GameState} gameState - Current game state
 * @param {string} direction - New direction ('UP', 'DOWN', 'LEFT', 'RIGHT')
 * @param {string} playerEoa - Player's Ethereum address
 * @returns {Object} Result with updated game state or error
 */
export function changeDirection(gameState, direction, playerEoa) {
  // Format player address to proper checksum format
  const formattedPlayerEoa = ethers.getAddress(playerEoa);

  // Check if the game is already over
  if (gameState.isGameOver) {
    return { success: false, error: 'Game is already over' };
  }

  // Verify it's the player's turn or they are allowed to move
  // In this simple version, we assume real-time or free movement for the host
  // The guest might control another character or it might be single player for now
  // Based on game-init.ts, there is only one 'player' actor created.

  // Check if the requester is the host
  if (gameState.players.host !== formattedPlayerEoa) {
    return { success: false, error: 'Only host can move' };
  }

  return moveActor(gameState, 'player', direction);
}

/**
 * Update game state (tick)
 * @param {GameState} gameState - Current game state
 * @returns {Object} Result with updated game state
 */
export function updateGame(gameState) {
  if (gameState.isGameOver) {
    return { success: true, gameState };
  }

  // In a turn-based roguelike, "updateGame" might handle enemy turns
  // For now, we can just increment game time

  const updatedGameState = {
    ...gameState,
    gameTime: gameState.gameTime + 1
  };

  return {
    success: true,
    gameState: updatedGameState
  };
}
