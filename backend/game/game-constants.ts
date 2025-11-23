/**
 * ============================================================================
 * GAME CONSTANTS
 * ============================================================================
 *
 * Game configuration and constants for Roguelike game.
 * ============================================================================
 */

// Grid dimensions
export const GRID_WIDTH = 50;
export const GRID_HEIGHT = 50;

export const ROWS = GRID_HEIGHT;
export const COLS = GRID_WIDTH;
export const ACTORS = 25;

// Directions
export const DIRECTIONS = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT'
};

/**
 * @typedef {Object} Position
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

/**
 * @typedef {Object} Actor
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} hp - Hit points
 * @property {boolean} isPlayer - Whether the actor is a player
 * @property {string} damage - Damage dice (e.g., 'd8+2')
 * @property {string} [id] - Optional ID for the actor
 * @property {string} [eoa] - Optional EOA for player actors
 */

/**
 * @typedef {Object} GameState
 * @property {Object} map - The game map (ROT.js map or similar structure)
 * @property {Array<Actor>} actorList - List of all actors
 * @property {Object.<string, Actor>} actorMap - Map of actors by position "x_y"
 * @property {Actor} player - The main player actor (host)
 * @property {string|null} winner - The winner ('player1', 'player2', or null)
 * @property {boolean} isGameOver - Whether the game is over
 * @property {Object} players - Object with player information
 * @property {string} players.host - EOA address of host (player 1)
 * @property {string} players.guest - EOA address of guest (player 2)
 * @property {number} gameTime - Game time in ticks/turns
 * @property {number} randomSeed - Seed used for RNG
 */
