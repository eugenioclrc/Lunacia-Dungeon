// Game types
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type BetAmount = 0 | 0.01 | 0.1 | 1 | 2;

export interface Position {
	x: number;
	y: number;
}

export interface Snake {
	body: Position[];
	direction: Direction;
	alive: boolean;
	score: number;
}

export interface Players {
	player1: string;
	player2: string;
}

export interface GameState {
	roomId: string;
	snakes: {
		player1: Snake;
		player2: Snake;
	};
	food: Position[];
	players: Players;
	gameTime: number;
	betAmount: BetAmount;
}

export interface GameOver {
	winner: string | null;
	finalScores: {
		player1: number;
		player2: number;
	};
	gameTime: number;
}

export interface JoinRoomPayload {
	eoa: string;
}

export interface DirectionPayload {
	roomId: string;
	direction: Direction;
}

export type WebSocketMessageType =
	| 'joinRoom'
	| 'startGame'
	| 'changeDirection'
	| 'getAvailableRooms'
	| 'room:state'
	| 'room:ready'
	| 'room:created'
	| 'room:available'
	| 'game:started'
	| 'game:over'
	| 'game:update'
	| 'onlineUsers'
	| 'error';

export interface WebSocketMessage {
	type: WebSocketMessageType;
}

export interface RoomStateMessage extends WebSocketMessage, GameState {
	type: 'room:state';
}

export interface RoomReadyMessage extends WebSocketMessage {
	type: 'room:ready';
	roomId: string;
}

export interface RoomCreatedMessage extends WebSocketMessage {
	type: 'room:created';
	roomId: string;
	role: 'host' | 'guest';
}

export interface GameStartedMessage extends WebSocketMessage {
	type: 'game:started';
	roomId: string;
}

export interface GameUpdateMessage extends WebSocketMessage, GameState {
	type: 'game:update';
}

export interface GameOverMessage extends WebSocketMessage, GameOver {
	type: 'game:over';
}

export interface ErrorMessage extends WebSocketMessage {
	type: 'error';
	code: string;
	msg: string;
}

export interface AvailableRoom {
	roomId: string;
	hostAddress: string;
	createdAt: number;
	betAmount: BetAmount;
}

export interface AvailableRoomsMessage extends WebSocketMessage {
	type: 'room:available';
	rooms: AvailableRoom[];
}

export interface OnlineUsersMessage extends WebSocketMessage {
	type: 'onlineUsers';
	count: number;
}

export type WebSocketMessages =
	| RoomStateMessage
	| RoomReadyMessage
	| RoomCreatedMessage
	| GameStartedMessage
	| GameUpdateMessage
	| GameOverMessage
	| AvailableRoomsMessage
	| OnlineUsersMessage
	| ErrorMessage;

