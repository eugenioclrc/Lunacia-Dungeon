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
import { changeDirection, updateGame } from './snake.ts';

/**
 * @typedef {Object} Room
 * @property {string} id - Unique room identifier
 * @property {Object} players - Map of player roles
 * @property {string|null} players.host - Host's Ethereum address (X player)
 * @property {string|null} players.guest - Guest's Ethereum address (O player)
 * @property {Map<string, Object>} connections - Map of player connections by EOA
 * @property {Object|null} gameState - Current game state
 * @property {boolean} isReady - Whether the room is ready to start
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

  /**
   * Creates a new room
   * @param {number} betAmount - Bet amount for the room (0, 0.01, 0.1, 1, 2)
   * @returns {string} Room ID
   */
  function createRoom(ws) {
    const id = ws.id;
    //const roomId = uuidv4();
    rooms.set(id, {
      ws: ws,
      id: id,
      connections: new Map(),
      gameState: null,
      isReady: false,
      createdAt: Date.now(),
    });
    return rooms.get(id);
  }

  /**
   * Process a direction change in the snake game
   * @param {string} roomId - Room ID
   * @param {string} direction - New direction ('UP', 'DOWN', 'LEFT', 'RIGHT')
   * @param {string} eoa - Player's Ethereum address
   * @returns {Object} Result with success flag and additional info
   */
  function processDirectionChange(roomId, direction, eoa) {
    // Format address to proper checksum format
    const formattedEoa = ethers.getAddress(eoa);
    
    if (!rooms.has(roomId)) {
      return { 
        success: false, 
        error: 'Room not found' 
      };
    }

    const room = rooms.get(roomId);
    
    // Check if player is in this room
    if (!room.connections.has(formattedEoa)) {
      return { 
        success: false, 
        error: 'Player not in this room' 
      };
    }

    // Check if the game has started
    if (!room.gameState) {
      return { 
        success: false, 
        error: 'Game has not started' 
      };
    }

    // Change direction
    const result = changeDirection(room.gameState, direction, formattedEoa);
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
      } else if (room.players.guest === formattedEoa) {
        room.players.guest = null;
      }
      
      // Clean up room if empty
      if (!room.players.host && !room.players.guest) {
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
    
   
    room.ws.send(message);
  }

  /**
   * Closes a room and notifies all players
   * @param {string} roomId - Room ID
   */
  function closeRoom(roomId) {
    if (!rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    
    // Remove all players from the room
    room.ws.close();
    
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
    processDirectionChange,
    updateGameState,
    leaveRoom,
    broadcastToRoom,
    closeRoom
  };
}