import { WebSocketService } from "./websocket";
let gameSocket = new WebSocketService();

export function getGameSocket() {
    gameSocket.connect('ws://localhost:8080');
    return gameSocket;
}
