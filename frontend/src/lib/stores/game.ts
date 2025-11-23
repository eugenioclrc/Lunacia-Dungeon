import { writable, derived } from 'svelte/store';
import { lastMessage } from './websocket';
import type { GameState, GameOver } from '../../types';

interface GameStoreState {
	gameState: GameState | null;
	gameOver: GameOver | null;
	roomId: string | null;
	errorMessage: string | null;
	isRoomReady: boolean;
	isGameStarted: boolean;
	isHost: boolean;
	playerId: 'player1' | 'player2' | null;
}

const createGameStore = () => {
	const { subscribe, set, update } = writable<GameStoreState>({
		gameState: null,
		gameOver: null,
		roomId: null,
		errorMessage: null,
		isRoomReady: false,
		isGameStarted: false,
		isHost: false,
		playerId: null
	});

	// Subscribe to WebSocket messages and update game state
	lastMessage.subscribe((message) => {
		if (!message) return;

		switch (message.type) {
			case 'room:state':
				update(state => ({
					...state,
					gameState: message as GameState,
					roomId: message.roomId
				}));
				break;

			case 'room:ready':
				update(state => ({
					...state,
					isRoomReady: true,
					roomId: message.roomId
				}));
				break;

			case 'room:created':
				update(state => ({
					...state,
					isHost: message.role === 'host',
					playerId: message.role === 'host' ? 'player1' : 'player2',
					roomId: message.roomId
				}));
				break;

			case 'game:started':
				update(state => ({
					...state,
					isGameStarted: true
				}));
				break;

			case 'game:update':
				update(state => ({
					...state,
					gameState: message as GameState
				}));
				break;

			case 'game:over':
				update(state => ({
					...state,
					gameOver: message as GameOver,
					isGameStarted: false
				}));
				break;

			case 'error':
				update(state => ({
					...state,
					errorMessage: message.msg
				}));
				break;
		}
	});

	const resetGame = () => {
		set({
			gameState: null,
			gameOver: null,
			roomId: null,
			errorMessage: null,
			isRoomReady: false,
			isGameStarted: false,
			isHost: false,
			playerId: null
		});
	};

	return {
		subscribe,
		resetGame
	};
};

export const gameStore = createGameStore();

export const gameState = derived(gameStore, $game => $game.gameState);
export const gameOver = derived(gameStore, $game => $game.gameOver);
export const roomId = derived(gameStore, $game => $game.roomId);
export const isRoomReady = derived(gameStore, $game => $game.isRoomReady);
export const isGameStarted = derived(gameStore, $game => $game.isGameStarted);
export const isHost = derived(gameStore, $game => $game.isHost);
export const playerId = derived(gameStore, $game => $game.playerId);

