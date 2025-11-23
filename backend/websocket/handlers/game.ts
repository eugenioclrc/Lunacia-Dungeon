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
 *    Player → move → Update position → Broadcast state
 *
 * 3. SIGNATURES:
 *    Guest → appSession:signature → Store signature → Request host signature
 *    Host → appSession:startGame → Submit to Nitrolite → Game begins
 *
 * KEY HANDLERS:
 * - handleStartGame(): Initiates signature collection flow
 * - handleMove(): Updates player's position
 * - handleAppSessionSignature(): Collects player signatures
 * ============================================================================
 */

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
  if (!ws.id) {
    ws.id = ID++;
  }

  console.log(`🎯 Processing start game for ${ws.id}`);

  // Find the player EOA
  let playerEoa = null;
  for (const [eoa, connection] of connections.entries()) {
    if (connection.ws === ws) {
      playerEoa = eoa;
      break;
    }
  }

  // Get the room
  let room = roomManager.rooms.get(ws.id);
  if (!room) {
    room = roomManager.createRoom(ws);
  }

  // Set host if not set
  if (playerEoa) {
    room.playereoa = playerEoa;
  }

  // Initialize game state if not already done
  if (!room.gameState) {
    console.log(`🎮 Creating game state for room ${ws.id}`);
    // Pass host and guest (if any)
    room.gameState = createGame(room.playereoa);
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
    { gameState: formatGameState(room.gameState, roomId, room.betAmount) }
  );

  // Start the automatic movement game loop
  // For Roguelike, we might not need an automatic loop if it's turn based, 
  // but if we want real-time elements or just to check game over, we can keep it.
  // Or we can just rely on moves triggering updates.
  // Let's keep a loop for game over detection.
  startGameOverDetectionLoop(roomId, roomManager);

  console.log(`🚀 Game started for room ${roomId}`);

  // Send the initial game state
  roomManager.broadcastToRoom(
    roomId,
    'room:state',
    formatGameState(room.gameState, roomId)
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
    } else {
      logger.game(`Game ended in a tie`);
    }

    // Prepare game data for session_data
    const gameData = {
      endCondition: gameState.winner ? 'collision' : 'tie',
      finalScores: {
        // Roguelike might not have scores in the same way, but we can adapt
        player: 0, // Placeholder
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

  // ... (validation logic is assumed to be before this or inside processDirectionChange, 
  // but here we just handle the handler logic)

  // Note: payload validation happens inside processDirectionChange partially, 
  // but we should probably validate payload structure here.
  // The original code extracted x,y from payload.

  const { roomId: payloadRoomId } = payload; // payload has x, y, roomId
  const roomId = payloadRoomId || ws.id;

  if (!roomId) {
    return sendError(ws, 'INVALID_PAYLOAD', 'Room ID is required');
  }
  let playerEoa = null;
  /*
    // Find the player EOA
    for (const [eoa, connection] of connections.entries()) {
      if (connection.ws === ws) {
        playerEoa = eoa;
        break;
      }
    }
  
    if (!playerEoa) {
      return sendError(ws, 'NOT_AUTHENTICATED', 'Player not authenticated');
    }
      */

  // Process the move
  const result = roomManager.processDirectionChange(roomId, payload, playerEoa);

  if (!result.success) {
    // ignore too fast errors
    if (result.error === 'TOO_FAST') {
      return;
    }
    // Only send error if it's a critical failure, otherwise just ignore invalid moves
    // to avoid spamming the client
    if (result.error === 'Room not found' || result.error === 'Game has not started') {
      return sendError(ws, 'MOVE_FAILED', result.error);
    }
    return;
  }

  // Broadcast new state
  roomManager.broadcastToRoom(
    roomId,
    'room:state',
    formatGameState(result.gameState, roomId, 0) // betAmount is in room, but we don't have room obj handy here easily without get. 
    // Actually we can get room from manager.
  );

  // We should probably get the room to get betAmount for formatting, although formatGameState might not use it for move updates.
  // formatGameState uses it for initial state or full state.
  const room = roomManager.rooms.get(roomId);
  if (room) {
    roomManager.broadcastToRoom(
      roomId,
      'room:state',
      formatGameState(result.gameState, roomId, room.betAmount)
    );
  }

  // Track the move in the app session
  try {
    // TODO addMoveToSession(roomId, playerEoa, direction);
  } catch (error) {
    // logger.warn(`Failed to track move for room ${roomId}:`, error);
    // Don't fail the direction change if move tracking fails
  }

  // Direction change processed - the automatic game loop will handle movement updates
}