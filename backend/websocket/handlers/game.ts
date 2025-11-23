/**
 * ============================================================================
 * GAME MESSAGE HANDLERS
 * ============================================================================
 *
 * Handles all game-related WebSocket messages from clients.
 *
 * MESSAGE FLOW:
 * 1. START GAME:
 *    Host → startGame → Generate app session → Collect signatures → Start
 *
 * 2. GAMEPLAY:
 *    Player → changeDirection → Queue direction → Applied on next tick
 *
 * 3. SIGNATURES:
 *    Guest → appSession:signature → Store signature → Request host signature
 *    Host → appSession:startGame → Submit to Nitrolite → Game begins
 *
 * KEY HANDLERS:
 * - handleStartGame(): Initiates signature collection flow
 * - handleDirectionChange(): Updates player's snake direction
 * - handleAppSessionSignature(): Collects player signatures
 * ============================================================================
 */

import { validateDirectionPayload } from '../../utils/validators.ts';
import {
  formatGameState,
  formatGameOverMessage,
  createGame
} from '../../game/snake.ts';
import {
  closeAppSession,
  hasAppSession,
  addMoveToSession
} from '../../nitrolite/appSessions.ts';
import logger from '../../utils/logger.ts';

/**
 * Handles a start game request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {Object} context - Application context containing roomManager and connections
 */

let ID = 1;
export async function handleStartGame(ws, payload, { roomManager, connections, sendError }) {
  console.log(`🎯 handleStartGame called for payload:`, payload);
  if(!ws.id) {
    ws.id = ID++;
  }
  
  console.log(`🎯 Processing start game for ${ws.id}`);

  // Get the room
  let room = roomManager.rooms.get(ws.id);
  if (!room) {
    room = roomManager.createRoom(ws);
  }
    

  // Initialize game state if not already done
  if (!room.gameState) {
    console.log(`🎮 Creating game state for room ${ws.id}`);
    room.gameState = createGame();
    console.log(`✅ Game state created:`, ws.id);
  } else {
    console.log(`♻️ Game state already exists for room ${ws.id}`);
  }
  const roomId = ws.id;

  // App session is created via signature collection flow (see room.js and server.js)

  // Broadcast game started
  roomManager.broadcastToRoom(
    roomId,
    'game:started',
    { gameState: room.gameState }
  );

  // Start the automatic movement game loop
  console.log(`🚀 Starting automatic movement game loop for room ${roomId}`);

  // Send the initial game state
  roomManager.broadcastToRoom(
    roomId, 
    'room:state', 
    formatGameState(room.gameState, roomId, room.betAmount)
  );
}

/**
 * Game loop intervals for each room
 */
const gameLoops = new Map();

/**
 * Handles app session closure when game ends
 * @param {string} roomId - Room ID
 * @param {Object} gameState - Final game state
 * @param {Object} roomManager - Room manager instance
 */
async function handleGameOverAppSession(roomId, gameState, roomManager) {
  try {
    logger.game(`🏁 Game over for room ${roomId} - Starting app session closure`);
    const room = roomManager.rooms.get(roomId);

    if (!room) {
      logger.warn(`No room found for ${roomId} during game over`);
      return;
    }

    // Determine winner EOA
    let winnerEOA = null;
    if (gameState.winner === 'player1') {
      winnerEOA = room.players.host;
      logger.game(`Winner: Player 1 (${winnerEOA})`);
    } else if (gameState.winner === 'player2') {
      winnerEOA = room.players.guest;
      logger.game(`Winner: Player 2 (${winnerEOA})`);
    } else {
      logger.game(`Game ended in a tie`);
    }

    // Prepare game data for session_data
    const gameData = {
      endCondition: gameState.winner ? 'collision' : 'tie',
      finalScores: {
        player1: gameState.snakes.player1?.score || 0,
        player2: gameState.snakes.player2?.score || 0
      },
      gameTime: gameState.gameTime
    };

    logger.data('Final game data:', gameData);

    // First check if the room has an appId directly
    if (room && room.appId) {
      logger.nitro(`Closing app session with ID ${room.appId} for room ${roomId}`);

      await closeAppSession(roomId, winnerEOA, gameData);
      logger.success(`✓ App session closed successfully for room ${roomId}`);
    }
    // Otherwise check the app sessions storage
    else if (hasAppSession(roomId)) {
      logger.nitro(`Closing app session from storage for room ${roomId}`);

      await closeAppSession(roomId, winnerEOA, gameData);
      logger.success(`✓ App session closed successfully for room ${roomId}`);
    }
    else {
      logger.warn(`No app session found for room ${roomId} - skipping closure`);
      logger.data('Room state:', {
        hasAppId: !!room.appId,
        hasAppSession: hasAppSession(roomId),
        betAmount: room.betAmount
      });
    }
  } catch (error) {
    logger.error(`Failed to close app session for room ${roomId}:`, error);
    logger.error('Error stack:', error.stack);
    // Continue with room cleanup even if app session closure fails
  }
}


/**
 * Starts a minimal game over detection loop for real-time movement games
 * @param {string} roomId - Room ID
 * @param {Object} roomManager - Room manager instance
 */
export function startGameOverDetectionLoop(roomId, roomManager) {
  console.log(`🔄 startGameOverDetectionLoop called for room ${roomId}`);
  
  // Clear any existing loop
  if (gameLoops.has(roomId)) {
    console.log(`🧹 Clearing existing game loop for room ${roomId}`);
    clearInterval(gameLoops.get(roomId));
  }

  const interval = setInterval(() => {
    // Check if the room still exists
    const room = roomManager.rooms.get(roomId);
    if (!room || !room.gameState) {
      clearInterval(interval);
      gameLoops.delete(roomId);
      return;
    }

    // Only check for game over condition, don't move snakes
    if (room.gameState.isGameOver) {
      clearInterval(interval);
      gameLoops.delete(roomId);
      
      roomManager.broadcastToRoom(
        roomId,
        'game:over',
        formatGameOverMessage(room.gameState)
      );

      // Close the app session if one was created
      handleGameOverAppSession(roomId, room.gameState, roomManager);

      // Clean up room after delay
      setTimeout(() => {
        roomManager.closeRoom(roomId);
      }, 5000);
    }
  }, 1000); // Check every 1 second

  gameLoops.set(roomId, interval);
  console.log(`✅ Game over detection loop started for room ${roomId}, interval ID:`, interval);
}

/**
 * Handles a direction change request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {Object} context - Application context containing roomManager and connections
 */
export async function handleMove(ws, payload, { roomManager, connections, sendError }) {
  // Validate payload
  console.log(`🎯 handleMove called for payload:`, payload);
  //if (!validation.success) {
 //  return sendError(ws, 'INVALID_PAYLOAD', validation.error);
 // }

  const { x,y } = payload;
  if(!x || !y) {
    return sendError(ws, 'INVALID_PAYLOAD', 'x and y are required');
  }
  if(Math.abs(x) + Math.abs(y) > 1) {
    return sendError(ws, 'INVALID_PAYLOAD', 'x and y must be 0 or 1');
  }
  

  // Process the direction change
  const result = roomManager.processDirectionChange(ws.id, {x,y});
  if (!result.success) {
    return sendError(ws, 'DIRECTION_CHANGE_FAILED', result.error);
  }

  // Track the move in the app session
  try {
    // TODO addMoveToSession(roomId, playerEoa, direction);
  } catch (error) {
    logger.warn(`Failed to track move for room ${roomId}:`, error);
    // Don't fail the direction change if move tracking fails
  }

  // Direction change processed - the automatic game loop will handle movement updates
}