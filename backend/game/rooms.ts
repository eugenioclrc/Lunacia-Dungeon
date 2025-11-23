/**
 * ============================================================================
 * ROOM MANAGER
 * ============================================================================
 *
 * Manages game rooms and matchmaking between players.
 *
 * ROOM LIFECYCLE:
 * 1. WAITING: Player A creates room with bet amount
 * 2. READY: Player B joins with matching bet → room ready to start
 * 3. PLAYING: Game in progress
 * 4. FINISHED: Game complete, room cleaned up
 *
 * KEY FEATURES:
 * - Bet matching: Players can only join rooms with same bet amount
 * - Connection tracking: Maps player addresses to WebSocket connections
 * - State management: Tracks game state for each room
 *
 * MAIN FUNCTIONS:
 * - createRoom(): New room with host player
 * - joinRoom(): Guest joins existing room
 * - getRoomByPlayer(): Find which room a player is in
 * - getAvailableRooms(): List rooms waiting for players
 * ============================================================================
 */

import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { changeDirection, updateGame } from './snake.ts';

/**
 * @typedef {Object} Room
 * @property {string} id - Unique room identifier
 * @property {Object} players - Map of player roles
 * @property {string|null} players.host - Host's Ethereum address (Player)
 * @property {Map<string, Object>} connections - Map of player connections by EOA
 * @property {Object|null} gameState - Current game state
 * @property {boolean} isReady - Whether the room is ready to start
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} RoomManager
 * @property {Map<string, Room>} rooms - Map of active rooms by ID
 * @property {Map<string, string>} addressToRoom - Map of addresses to room IDs
 */

/**
 * Creates a new room manager
 * @returns {RoomManager} Room manager instance
 */
export function createRoomManager() {
  // In-memory storage for rooms and address-to-room mapping
  const rooms = new Map();
  const addressToRoom = new Map();


  function createRoom(ws) {
    const roomId = ws.id;
    rooms.set(roomId, {
      id: roomId,
      players: {
        host: null
      },
      connections: new Map(),
      gameState: {},
      isReady: true, // Always ready in single player
      createdAt: Date.now(),
    });
    return roomId;
  }

  /**
   * Joins a player to a room
   * @param {string} roomId - Room ID
   * @param {string} eoa - Player's Ethereum address
   * @param {WebSocket} ws - WebSocket connection
   * @returns {Object} Result with success flag and additional info
   */
  function joinRoom(roomId, eoa, ws) {
    // Format address to proper checksum format
    const formattedEoa = ethers.getAddress(eoa);

    if (!rooms.has(roomId)) {
      return { success: false, error: 'Room not found' };
    }

    const room = rooms.get(roomId);


    // Check if player is already in a room
    if (addressToRoom.has(formattedEoa)) {
      const existingRoomId = addressToRoom.get(formattedEoa);
      if (existingRoomId !== roomId) {
        return { success: false, error: 'Player already in another room' };
      }
      // Rejoining same room is allowed, just update connection
    }

    // Assign role (always host/player)
    let role = 'host';
    room.players.host = formattedEoa;

    // Update connections
    room.connections.set(formattedEoa, { ws });
    addressToRoom.set(formattedEoa, roomId);

    // Store room ID on websocket for easy access
    ws.id = roomId;

    return {
      success: true,
      role,
      roomId,
      isRoomReady: room.isReady
    };
  }

  /**
   * Process a direction change in the game
   * @param {string} roomId - Room ID
   * @param {Object} payload - Payload containing direction
   * @param {string} playerEoa - The EOA of the player making the move
   * @returns {Object} Result with success flag and additional info
   */
  function processDirectionChange(roomId, payload, playerEoa) {
    const { x, y } = payload;
    let direction = '';
    if (x === 0 && y === -1) direction = 'UP';
    else if (x === 0 && y === 1) direction = 'DOWN';
    else if (x === -1 && y === 0) direction = 'LEFT';
    else if (x === 1 && y === 0) direction = 'RIGHT';
    else return { success: false, error: 'Invalid move vector' };

    if (!rooms.has(roomId)) {
      return {
        success: false,
        error: 'Room not found'
      };
    }

    const room = rooms.get(roomId);

    // Check if the game has started
    if (!room.gameState) {
      return {
        success: false,
        error: 'Game has not started'
      };
    }

    // Change direction (which moves the actor in our new logic)
    // We need the player EOA. In this simple setup, we assume it's the host.
    // const playerEoa = room.players?.host; // This was commented out in the original, and now we pass it as an argument.

    const result = changeDirection(room.gameState, direction, playerEoa); // Use the passed playerEoa
    if (!result.success) {
      return result;
    }

    // Update game state
    room.gameState = result.gameState;

    return {
      success: true,
      gameState: room.gameState
    };
  }

  /**
   * Removes a player from a room
   * @param {string} eoa - Player's Ethereum address
   * @returns {Object} Result with success flag and removed room info
   */
  function leaveRoom(eoa) {
    // Format address to proper checksum format
    const formattedEoa = ethers.getAddress(eoa);

    if (!addressToRoom.has(formattedEoa)) {
      return {
        success: false,
        error: 'Player not in any room'
      };
    }

    const roomId = addressToRoom.get(formattedEoa);
    const room = rooms.get(roomId);

    // Clean up player connections
    if (room) {
      room.connections.delete(formattedEoa);

      // Update player list
      if (room.players.host === formattedEoa) {
        room.players.host = null;
      }

      // Clean up room if empty
      if (!room.playereoa) {
        rooms.delete(roomId);
      }
    }

    addressToRoom.delete(formattedEoa);

    return {
      success: true,
      roomId
    };
  }

  /**
   * Broadcasts a message to all players in a room
   * @param {string} roomId - Room ID
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  function broadcastToRoom(roomId, type, data) {
    if (!rooms.has(roomId)) {
      console.log(`🔴 Room ${roomId} not found`);
      return;
    }
    const room = rooms.get(roomId);
    const message = JSON.stringify({ type, ...data });

    // Send to all connected players
    for (const connection of room.connections.values()) {
      if (connection.ws.readyState === 1) { // OPEN
        connection.ws.send(message);
      }
    }

    // Also send to the room.ws if it exists (legacy/simple mode)
    // This `room.ws` property was removed from `createRoom` in this update.
    // If `room.ws` is intended to be a single WebSocket for the room (e.g., for a host),
    // it should be added back to the room object during room creation or host joining.
    // For now, assuming `room.connections` is the primary way to broadcast.
    // If `room.ws` was meant to be the host's connection, it's now in `room.connections`.
    // Removing this line to avoid potential errors if `room.ws` is undefined.
    // if (room.ws && room.ws.readyState === 1) {
    //    room.ws.send(message);
    // }
  }

  /**
   * Closes a room and notifies all players
   * @param {string} roomId - Room ID
   */
  function closeRoom(roomId) {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Remove all players from the room
    for (const connection of room.connections.values()) {
      connection.ws.close();
    }
    // If room.ws was a separate connection, it would be closed here.
    // Since it's removed from createRoom, this line is likely obsolete.
    // if (room.ws) room.ws.close();

    // Delete the room
    rooms.delete(roomId);
  }

  /**
   * Updates the game state (moves snakes, handles collisions)
   * @param {string} roomId - Room ID
   * @returns {Object} Result with success flag and additional info
   */
  function updateGameState(roomId) {
    if (!rooms.has(roomId)) {
      return {
        success: false,
        error: 'Room not found'
      };
    }

    const room = rooms.get(roomId);

    // Check if the game has started
    if (!room.gameState) {
      return {
        success: false,
        error: 'Game has not started'
      };
    }

    // Update game state
    const result = updateGame(room.gameState);
    if (!result.success) {
      return result;
    }

    // Update room's game state
    room.gameState = result.gameState;

    return {
      success: true,
      gameState: room.gameState,
      isGameOver: room.gameState.isGameOver
    };
  }

  // Return public API
  return {
    rooms,
    addressToRoom,
    createRoom,
    joinRoom,
    processDirectionChange,
    updateGameState,
    leaveRoom,
    broadcastToRoom,
    closeRoom
  };
}