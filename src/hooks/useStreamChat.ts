import { useEffect, useRef, useState } from "react";
import { StreamChat } from "@/lib/streamChat";

const CHAT_STORAGE_KEY = 'stream_chat_';
const MAX_STORED_MESSAGES = 200;

export function useStreamChat(streamId: string, token?: string) {
  const clientRef = useRef<StreamChat | null>(null);
  
  // Load messages from localStorage on init
  const [messages, setMessages] = useState<any[]>(() => {
    if (!streamId) return [];
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY + streamId);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
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
        setMessages((prev) => {
          const updated = [...prev, msg].slice(-MAX_STORED_MESSAGES);
          // Store in localStorage
          try {
            localStorage.setItem(CHAT_STORAGE_KEY + streamId, JSON.stringify(updated));
          } catch (e) {
            console.warn('Failed to save chat to localStorage:', e);
          }
          return updated;
        });
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