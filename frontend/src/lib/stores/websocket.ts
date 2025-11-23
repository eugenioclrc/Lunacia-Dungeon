import { writable, derived } from 'svelte/store';
import type { WebSocketMessages, JoinRoomPayload, DirectionPayload } from '../../types';

interface WebSocketState {
	isConnected: boolean;
	error: string | null;
	lastMessage: WebSocketMessages | null;
}

const createWebSocketStore = () => {
	const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
	
	const { subscribe, set, update } = writable<WebSocketState>({
		isConnected: false,
		error: null,
		lastMessage: null
	});

	let ws: WebSocket | null = null;

	const connect = () => {
		if (ws?.readyState === WebSocket.OPEN) {
			return;
		}

		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			update(state => ({ ...state, isConnected: true, error: null }));
		};

		ws.onclose = () => {
			update(state => ({ ...state, isConnected: false }));
		};

		ws.onerror = () => {
			update(state => ({ ...state, error: 'Failed to connect to game server', isConnected: false }));
		};

		ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as WebSocketMessages;
				update(state => ({ ...state, lastMessage: message }));
			} catch (err) {
				console.error('Error parsing WebSocket message', err);
			}
		};
	};

	const disconnect = () => {
		if (ws) {
			ws.close();
			ws = null;
		}
		update(state => ({ ...state, isConnected: false }));
	};

	const sendMessage = (message: object) => {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		} else {
			update(state => ({ ...state, error: 'Not connected to server' }));
		}
	};

	const joinRoom = (payload: JoinRoomPayload) => {
		sendMessage({
			type: 'joinRoom',
			payload
		});
	};

	const changeDirection = (payload: DirectionPayload) => {
		sendMessage({
			type: 'changeDirection',
			payload
		});
	};

	const startGame = (roomId: string) => {
		sendMessage({
			type: 'startGame',
			payload: { roomId }
		});
	};

	const getAvailableRooms = () => {
		sendMessage({
			type: 'getAvailableRooms'
		});
	};

	return {
		subscribe,
		connect,
		disconnect,
		joinRoom,
		changeDirection,
		startGame,
		getAvailableRooms
	};
};

export const websocket = createWebSocketStore();

export const isConnected = derived(websocket, $ws => $ws.isConnected);
export const lastMessage = derived(websocket, $ws => $ws.lastMessage);
export const wsError = derived(websocket, $ws => $ws.error);

