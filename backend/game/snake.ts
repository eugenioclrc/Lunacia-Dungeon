/**
 * ============================================================================
 * GAME COORDINATOR
 * ============================================================================
 *
 * Central export point for all game functionality.
 * This file re-exports functions from specialized modules.
 *
 * GAME RULES:
 * - Grid: 50x50 cells
 * - Roguelike movement (turn-based or real-time grid)
 * - Players control an actor
 *
 * MODULES:
 * - game-constants.js - Configuration and types
 * - game-init.js      - Game initialization
 * - game-movement.js  - Movement and collision detection
 * - game-format.js    - State formatting for clients
 * ============================================================================
 */

// Re-export constants
export {
  GRID_WIDTH,
  GRID_HEIGHT,
  DIRECTIONS
} from './game-constants.ts';

// Re-export initialization
export {
  createGame
} from './game-init.ts';

// Re-export movement and collision
export {
  moveActor,
  changeDirection,
  updateGame
} from './game-movement.ts';

// Re-export formatting
export {
  formatGameState,
  formatGameOverMessage
} from './game-format.ts';
