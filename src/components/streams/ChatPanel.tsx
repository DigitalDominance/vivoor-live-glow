import React from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonal } from "lucide-react";

export type ChatMessage = { id: string; user: string; text: string; time: string };

const ChatPanel: React.FC<{
  messages: ChatMessage[];
  canPost?: boolean;
  onRequireLogin?: () => void;
}> = ({ messages, canPost, onRequireLogin }) => {
  return (
    <div className="h-full flex flex-col rounded-xl border border-border bg-card/60 backdrop-blur-md">
      <div className="px-3 py-2 border-b border-border/60 text-sm font-medium">Chat</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="text-muted-foreground mr-1">{m.user}:</span>
            <span>{m.text}</span>
            <span className="float-right text-xs text-muted-foreground">{m.time}</span>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-border/60">
        {canPost ? (
          <div className="flex gap-2">
            <input className="flex-1 rounded-md bg-background px-3 py-2 text-sm border border-border" placeholder="Say something..." />
            <Button size="icon" variant="hero" aria-label="Send"><SendHorizonal /></Button>
          </div>
        ) : (
          <Button className="w-full" variant="gradientOutline" onClick={onRequireLogin}>Login to chat</Button>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
