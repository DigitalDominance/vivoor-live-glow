import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SendHorizonal, HelpCircle, X } from "lucide-react";
import { blurBadWords } from "@/lib/badWords";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useUserVerification } from "@/hooks/useUserVerification";
import kasiaLogo from "@/assets/kasia-logo.png";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { fetchFeeEstimate, calculateMessageFee } from "@/lib/kaspaApi";
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
  const [currentFee, setCurrentFee] = React.useState<string>("...");

  // Fetch fee estimate on mount
  React.useEffect(() => {
    const getFee = async () => {
      try {
        const estimate = await fetchFeeEstimate();
        const feerate = estimate.normalBuckets[0]?.feerate || 1;
        // Use higher mass estimate for payload transactions (~3000 grams)
        const fee = calculateMessageFee(feerate, 3000);
        // Remove trailing zeros
        setCurrentFee(parseFloat(fee.toFixed(8)).toString());
      } catch (error) {
        console.error("Failed to fetch fee estimate:", error);
        setCurrentFee("~0.0003");
      }
    };
    getFee();
    // Refresh fee every 30 seconds
    const interval = setInterval(getFee, 30000);
    return () => clearInterval(interval);
  }, []);

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
              <div className="mt-3 text-center text-xs text-white/70">
                <span>Estimated Network Fee: </span>
                <span className="font-semibold bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                  {currentFee} KAS
                </span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="mt-4 text-center text-xs text-white/70 hover:text-white/90 transition-colors flex items-center justify-center gap-1 mx-auto">
                    <HelpCircle className="h-3 w-3" />
                    <span>How it works?</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-black/70 backdrop-blur-xl border-0 overflow-hidden max-w-md">
                  {/* Gradient outline */}
                  <div className="absolute inset-0 rounded-lg opacity-50 pointer-events-none" style={{
                    background: 'linear-gradient(135deg, hsl(329, 75%, 80%) 0%, hsl(280, 75%, 75%) 20%, hsl(252, 85%, 75%) 40%, hsl(230, 80%, 70%) 60%, hsl(210, 85%, 65%) 80%, hsl(190, 85%, 65%) 100%)',
                    padding: '2px',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude'
                  }} />
                  {/* Glow effect */}
                  <div className="absolute inset-0 rounded-lg blur-xl opacity-25 pointer-events-none" style={{
                    background: 'linear-gradient(135deg, hsl(329, 75%, 80%) 0%, hsl(280, 75%, 75%) 20%, hsl(252, 85%, 75%) 40%, hsl(230, 80%, 70%) 60%, hsl(210, 85%, 65%) 80%, hsl(190, 85%, 65%) 100%)',
                  }} />
                  <AlertDialogCancel className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground bg-transparent border-0 h-auto w-auto p-0">
                    <X className="h-5 w-5 text-white" />
                    <span className="sr-only">Close</span>
                  </AlertDialogCancel>
                  <div className="relative z-10">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white text-lg pr-8">How Kaspa On-Chain Chat Works</AlertDialogTitle>
                      <AlertDialogDescription className="text-white/80 text-sm space-y-3 pt-2">
                        <p>
                          This chat uses Kaspa's blockchain for truly decentralized, immutable messaging.
                        </p>
                        <p>
                          <strong className="text-white">Zero Cost:</strong> The 1.2 KAS you send goes directly to your own wallet. The only cost is the tiny network fee (typically ~0.000015 KAS).
                        </p>
                        <p>
                          <strong className="text-white">On-Chain & Immutable:</strong> Messages are embedded within transaction payloads, making them permanently stored on the blockchain.
                        </p>
                        <p>
                          <strong className="text-white">No WebSockets Required:</strong> The system reads transaction payloads from the blockchain and displays them as chat messages in real-time.
                        </p>
                        <p className="text-xs text-white/60 pt-2">
                          Powered by KASIA's decentralized messaging protocol.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
              <div className="mt-6 text-center text-xs text-white/70 flex items-center justify-center gap-1.5">
                <span>POWERED BY</span>
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
