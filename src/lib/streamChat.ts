type ChatMsg =
  | { type: "hello"; streamId: string; serverTs: number }
  | { type: "pong"; t: number }
  | { type: "chat"; text: string; user: { id: string; name: string; avatar?: string }; streamId: string; serverTs: number }
  | { type: "status"; isActive: boolean; streamId: string; serverTs: number };

export class StreamChat {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = new Set<(m: ChatMsg) => void>();
  private retry = 0;
  private closedByUser = false;

  constructor(streamId: string, token?: string) {
    const params = new URLSearchParams({ streamId });
    if (token) params.set("token", token);
    this.url = `wss://vivoor-e15c882142f5.herokuapp.com/ws?${params.toString()}`;
  }

  connect() {
    this.closedByUser = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected to stream:', this.url);
      this.retry = 0;
      // optional app-level keepalive
      this.send({ type: "ping" as const });
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as ChatMsg;
        this.listeners.forEach((fn) => fn(msg));
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.closedByUser) {
        const delay = Math.min(1000 * Math.pow(2, this.retry++), 15000);
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = () => {
      // will trigger onclose; no-op here
    };
  }

  on(fn: (m: ChatMsg) => void) { 
    this.listeners.add(fn); 
    return () => this.listeners.delete(fn); 
  }

  send(obj: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  sendChat(text: string, user: { id: string; name: string; avatar?: string }) {
    this.send({ type: "chat", text, user });
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
  }
}