import React from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonal } from "lucide-react";

export type ChatMessage = { id: string; user: string; text: string; time: string };

const ChatPanel: React.FC<{
  messages: ChatMessage[];
  canPost?: boolean;
  onRequireLogin?: () => void;
  newMessage?: string;
  onMessageChange?: (message: string) => void;
  onSendMessage?: () => void;
}> = ({ messages, canPost, onRequireLogin, newMessage = '', onMessageChange, onSendMessage }) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage?.();
    }
  };
  return (
    <div className="h-full flex flex-col rounded-xl border border-border bg-card/60 backdrop-blur-md">
      <div className="px-3 py-2 border-b border-border/60 text-sm font-medium">
        Chat {messages.length > 0 && `(${messages.length})`}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[300px] max-h-[500px]">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm mt-8">
            No messages yet. Be the first to say something!
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="text-muted-foreground mr-1 font-medium">{m.user}:</span>
              <span className="break-words">{m.text}</span>
              <div className="text-xs text-muted-foreground mt-0.5">{m.time}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-2 border-t border-border/60">
        {canPost ? (
          <div className="flex gap-2">
            <input 
              className="flex-1 rounded-md bg-background px-3 py-2 text-sm border border-border" 
              placeholder="Say something..." 
              value={newMessage}
              onChange={(e) => onMessageChange?.(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button 
              size="icon" 
              variant="hero" 
              aria-label="Send"
              onClick={onSendMessage}
              disabled={!newMessage.trim()}
            >
              <SendHorizonal />
            </Button>
          </div>
        ) : (
          <Button className="w-full" variant="gradientOutline" onClick={onRequireLogin}>
            Login to chat
          </Button>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
