import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SendHorizonal } from "lucide-react";
import { blurBadWords } from "@/lib/badWords";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useUserVerification } from "@/hooks/useUserVerification";
import kasiaLogo from "@/assets/kasia-logo.png";
import "./chat-panel.css";

// Component to show verified badge for a user
const VerifiedUserBadge: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: verification } = useUserVerification(userId);
  return <VerifiedBadge size="sm" isVerified={verification?.isVerified} />;
};

export type ChatMessage = { 
  id: string; 
  user: { id: string; name: string; avatar?: string }; 
  text: string; 
  time: string; 
};

const ChatPanel: React.FC<{
  messages: ChatMessage[];
  canPost?: boolean;
  onRequireLogin?: () => void;
  newMessage?: string;
  onMessageChange?: (message: string) => void;
  onSendMessage?: () => void;
}> = ({ messages, canPost, onRequireLogin, newMessage = '', onMessageChange, onSendMessage }) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = React.useState(false);
  const previousMessagesLength = React.useRef(messages.length);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Check if user is near bottom
  const isNearBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Handle scroll events to detect manual scrolling
  const handleScroll = () => {
    if (!isNearBottom()) {
      setIsUserScrolling(true);
    } else {
      setIsUserScrolling(false);
    }
  };

  // Auto-scroll only when appropriate
  React.useEffect(() => {
    // On initial load, scroll to bottom instantly
    if (previousMessagesLength.current === 0 && messages.length > 0) {
      scrollToBottom("auto");
      previousMessagesLength.current = messages.length;
      return;
    }

    // For new messages, only auto-scroll if user is near bottom
    if (messages.length > previousMessagesLength.current && !isUserScrolling) {
      scrollToBottom();
    }
    
    previousMessagesLength.current = messages.length;
  }, [messages, isUserScrolling]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage?.();
    }
  };
  
  return (
    <div className="h-full flex flex-col rounded-xl relative bg-black/70 backdrop-blur-xl overflow-hidden">
      {/* Smooth gradient outline with glow */}
      <div className="absolute inset-0 rounded-xl opacity-50 pointer-events-none" style={{
        background: 'linear-gradient(135deg, hsl(329, 75%, 80%) 0%, hsl(280, 75%, 75%) 20%, hsl(252, 85%, 75%) 40%, hsl(230, 80%, 70%) 60%, hsl(210, 85%, 65%) 80%, hsl(190, 85%, 65%) 100%)',
        padding: '3px',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude'
      }} />
      
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-xl blur-xl opacity-35 pointer-events-none" style={{
        background: 'linear-gradient(135deg, hsl(329, 75%, 80%) 0%, hsl(280, 75%, 75%) 20%, hsl(252, 85%, 75%) 40%, hsl(230, 80%, 70%) 60%, hsl(210, 85%, 65%) 80%, hsl(190, 85%, 65%) 100%)',
      }} />

      <div className="relative z-10 h-full flex flex-col">
        <div className="px-3 py-2 border-b border-white/10 text-sm font-medium text-white">
          Chat {messages.length > 0 && `(${messages.length})`}
        </div>
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[300px] max-h-[400px] lg:max-h-[500px] chat-scrollbar"
        >
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm mt-8">
            No messages yet. Be the first to say something!
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm flex gap-2">
              <Avatar className="h-6 w-6 mt-0.5 flex-shrink-0">
                <AvatarImage src={m.user.avatar} alt={m.user.name} />
                <AvatarFallback className="text-xs">
                  {m.user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-white font-medium truncate">{m.user.name}</span>
                  <VerifiedUserBadge userId={m.user.id} />
                  <span className="text-xs text-white/50 dark:text-white/50">{m.time}</span>
                </div>
                <div 
                  className="text-white break-words mt-0.5"
                  dangerouslySetInnerHTML={{ __html: blurBadWords(m.text) }}
                />
              </div>
            </div>
          ))
        )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-2 border-t border-white/10">
          {canPost !== undefined && canPost !== null ? (
            <>
              <div className="flex gap-2">
                <input 
                  className="flex-1 rounded-md bg-black/50 backdrop-blur-sm px-3 py-2 text-sm border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50" 
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
              <div className="mt-2 text-center text-xs text-white/70 flex items-center justify-center gap-1.5">
                <span>powered by</span>
                <a 
                  href="https://kasia.fyi/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-semibold bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] hover:opacity-80 transition-opacity flex items-center gap-1"
                >
                  KASIA
                  <img src={kasiaLogo} alt="KASIA" className="h-4 w-4 inline-block" />
                </a>
              </div>
            </>
          ) : (
            <Button className="w-full" variant="gradientOutline" onClick={onRequireLogin}>
              Login to chat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
