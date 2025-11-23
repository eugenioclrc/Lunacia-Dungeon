/**
 * Room-related WebSocket message handlers
 */

import { validateJoinRoomPayload } from '../../utils/validators.ts';
import { formatGameState } from '../../game/snake.ts';
import { generateAppSessionMessage } from '../../nitrolite/appSessions.ts';
import logger from '../../utils/logger.ts';

/**
 * Handles a request to join a room
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {Object} context - Application context containing roomManager and connections
 */
export async function handleJoinRoom(ws, payload, { roomManager, connections, sendError }) {
  // Validate payload
  const validation = validateJoinRoomPayload(payload);
  if (!validation.success) {
    return sendError(ws, 'INVALID_PAYLOAD', validation.error);
  }

  const { roomId, eoa } = payload;
  console.log(`Processing ${validation.isCreating ? 'CREATE' : 'JOIN'} request for EOA: ${eoa}, roomId: ${roomId || 'NEW'}`);

  // Check if address is already connected
  if (connections.has(eoa)) {
    return sendError(ws, 'ALREADY_CONNECTED', 'Address already connected');
  }

  let result;
  if (validation.isCreating) {
    // Creating a new room
    const newRoomId = roomManager.createRoom(ws);
    console.log(`Created new room with ID: ${newRoomId}`);

    // Join the newly created room as host
    result = roomManager.joinRoom(newRoomId, eoa, ws);

    if (result.success) {
      console.log(`New room created: ${newRoomId} for player (host): ${eoa}`);

      // Send room ID to client immediately so they can share it
      ws.send(JSON.stringify({
        type: 'room:created',
        roomId: newRoomId,
        role: 'host'
      }));
    }
  } else {
    // Joining an existing room
    result = roomManager.joinRoom(roomId, eoa, ws);

    if (result.success) {
      console.log(`Player ${eoa} joined room: ${roomId} as ${result.role}`);
    }
  }

  if (!result.success) {
    return sendError(ws, 'JOIN_FAILED', result.error);
  }

  // Store connection
  connections.set(eoa, { ws, roomId: result.roomId });

  // Get room
  const room = roomManager.rooms.get(result.roomId);

  // Send room state to all players
  if (room.gameState) {
    roomManager.broadcastToRoom(
      result.roomId,
      'room:state',
      formatGameState(room.gameState, result.roomId)
    );
  }

  // Notify all players that room is ready if applicable
  if (result.isRoomReady) {
    roomManager.broadcastToRoom(result.roomId, 'room:ready', { roomId: result.roomId });

    logger.nitro(`Room ${result.roomId} is ready - starting signature collection flow`);
    logger.data(`Room players:`, { host: room.players.host });

    // Generate app session message for signature collection when room becomes ready
    try {
      const appSessionMessage = await generateAppSessionMessage(
        result.roomId,
        room.players.host
      );

      logger.nitro(`Generated app session message for room ${result.roomId}`);

      // Send the message to participant (host) for signature
      // In single player, host is the only one signing initially
      const hostConnection = room.connections.get(room.players.host);
      if (hostConnection && hostConnection.ws.readyState === 1) {
        hostConnection.ws.send(JSON.stringify({
          type: 'appSession:signatureRequest',
          roomId: result.roomId,
          appSessionData: appSessionMessage.appSessionData,
          appDefinition: appSessionMessage.appDefinition,
          participants: appSessionMessage.participants,
          requestToSign: appSessionMessage.requestToSign
        }));
      }

    } catch (error) {
      logger.error(`Failed to generate app session message for room ${result.roomId}:`, error);
    }
  }
}

/**
 * Handles a request to get available rooms
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} context - Application context containing roomManager
 */
export async function handleGetAvailableRooms(ws, { roomManager }) {
  // Filter rooms that are not full
  const availableRooms = [];

  // Get current timestamp
  const now = Date.now();

  // Iterate through all rooms and find available ones
  for (const [roomId, room] of roomManager.rooms.entries()) {
    // Room is available if it has a host but no guest, and game is not started
    if (room.players.host && !room.gameState) {
      availableRooms.push({
        roomId,
        hostAddress: room.players.host,
        createdAt: room.createdAt || now
      });
    }
  }

  // Send available rooms to client
  ws.send(JSON.stringify({
    type: 'room:available',
    rooms: availableRooms
  }));
}