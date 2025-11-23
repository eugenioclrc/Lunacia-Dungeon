/**
 * ============================================================================
 * GAME STATE FORMATTING
 * ============================================================================
 *
 * Functions for formatting game state for client transmission.
 * ============================================================================
 */

/**
 * Formats game state for client consumption
 * @param {GameState} gameState - Current game state
 * @param {string} roomId - Room ID
 * @param {number} betAmount - Bet amount (default 0)
 * @returns {Object} Formatted game state for client
 */
export function formatGameState(gameState, roomId) {
  // We need to serialize the map if it's a ROT.js map object
  // For now, let's assume we just send the actor list and map data
  // If map is static, maybe we don't need to send it every time?
  // But for simplicity, let's send what's needed.

  return {
    roomId,
    players: gameState.players,
    gameTime: gameState.gameTime,
    actors: gameState.actorList,
    // map: gameState.map // Sending the whole map might be heavy if it's large
    // For a simple roguelike, maybe just send actors and let client render map if it's static
    // Or send map only on initial state.
    // Let's include it for now, assuming it's serializable.
    // If gameState.map is a ROT.Map, it might not be directly serializable to JSON.
    // We might need to extract the grid.
    // Based on game-init, _map is a ROT.Map.Rogue.
    // We should probably convert it to a 2D array or similar for the client.
    // But wait, game-init.ts creates _map but doesn't seem to store the grid in a simple way?
    // Actually _map.map is likely the grid.
    map: gameState.map.map
  };
}

/**
 * Formats game over message
 * @param {GameState} gameState - Current game state
 * @returns {Object} Game over message
 */
export function formatGameOverMessage(gameState) {
  return {
    winner: gameState.winner,
    gameTime: gameState.gameTime
  };
}
