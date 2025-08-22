import { useEffect, useRef, useState } from "react";
import { StreamChat } from "@/lib/streamChat";

export function useStreamChat(streamId: string, token?: string) {
  const clientRef = useRef<StreamChat | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!streamId) return;

    const client = new StreamChat(streamId, token);
    clientRef.current = client;
    client.connect();

    const off = client.on((msg) => {
      if (msg.type === "hello") {
        setIsConnected(true);
      } else if (msg.type === "chat") {
        setMessages((prev) => [...prev, msg].slice(-200)); // keep last 200
      }
    });

    return () => { 
      off(); 
      client.close(); 
      setIsConnected(false);
    };
  }, [streamId, token]);

  const sendChat = (text: string, user: { id: string; name: string; avatar?: string }) =>
    clientRef.current?.sendChat(text, user);

  return { messages, sendChat, isConnected };
}