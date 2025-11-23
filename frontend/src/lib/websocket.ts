// filepath: src/lib/websocket.ts
export type WsStatus = 'Connecting' | 'Connected' | 'Disconnected';

type StatusListener = (status: WsStatus) => void;
type MessageListener = (data: any) => void;

export class WebSocketService {
    private socket: WebSocket | null = null;
    private status: WsStatus = 'Disconnected';
    private statusListeners: Set<StatusListener> = new Set();
    private messageListeners: Set<MessageListener> = new Set();
    private messageQueue: string[] = [];
    private requestId = 1;

    public connect(wsUrl: string) {
        if (this.socket && this.socket.readyState < 2) return;
        if (!wsUrl) {
            console.error('VITE_NITROLITE_WS_URL is not set');
            this.updateStatus('Disconnected');
            return;
        }
        this.updateStatus('Connecting');
        this.socket = new WebSocket(wsUrl);
        this.socket.onopen = () => {
            console.log('WebSocket Connected');
            this.updateStatus('Connected');
            this.flushMessageQueue();
        };
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.messageListeners.forEach((listener) => listener(data));
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
        this.socket.onclose = () => this.updateStatus('Disconnected');
        this.socket.onerror = () => this.updateStatus('Disconnected');
    }

    public send(payload: string) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(payload);
            console.log('Payload sent:', payload.slice(0, 100));
        } else {
            this.messageQueue.push(payload);
            console.log('Payload queued (connection not ready). Queue size:', this.messageQueue.length);
        }
    }

    private flushMessageQueue() {
        if (this.socket?.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const queueSize = this.messageQueue.length;
        if (queueSize > 0) {
            console.log(`Flushing ${queueSize} queued message(s)`);
            this.messageQueue.forEach((msg) => {
                this.socket?.send(msg);
                console.log('Queued message sent:', msg);
            });
            this.messageQueue = [];
        }
    }

    /*
    public send(method: string, params: any) {
        const payload = JSON.stringify({ jsonrpc: '2.0', id: this.requestId++, method, params });
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(payload);
        else this.messageQueue.push(payload);
    }
        */

    private updateStatus(newStatus: WsStatus) {
        this.status = newStatus;
        this.statusListeners.forEach((listener) => listener(this.status));
    }

    public addStatusListener(listener: StatusListener) {
        this.statusListeners.add(listener);
        listener(this.status);
    }

    public removeStatusListener(listener: StatusListener) {
        this.statusListeners.delete(listener);
    }

    public addMessageListener(listener: MessageListener) {
        this.messageListeners.add(listener);
    }

    public removeMessageListener(listener: MessageListener) {
        this.messageListeners.delete(listener);
    }
}
