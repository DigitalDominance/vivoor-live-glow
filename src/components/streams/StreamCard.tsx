import { Heart, Play, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Stream } from "@/mock/data";
import { motion } from "framer-motion";
import React from "react";

export type StreamCardProps = {
  stream: Stream;
  isLoggedIn?: boolean;
  onOpenProfile?: (userId: string) => void;
  onRequireLogin?: () => void;
};

export const StreamCard: React.FC<StreamCardProps> = ({ stream, isLoggedIn, onOpenProfile, onRequireLogin }) => {
  const navigate = useNavigate();
  const [liked, setLiked] = React.useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) return onRequireLogin?.();
    setLiked((v) => !v);
  };

  return (
    <motion.article
      className="group glass rounded-xl overflow-hidden border border-border hover:shadow-lg transition-colors"
      whileHover={{ translateY: -2 }}
      onClick={() => navigate(`/watch/${stream.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/watch/${stream.id}`)}
    >
      <div className="relative aspect-video bg-muted/40">
        <div className="absolute inset-0 bg-[length:200%_100%] animate-shimmer bg-gradient-to-r from-foreground/10 via-transparent to-foreground/10" />
        <Button variant="glass" size="icon" className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play />
        </Button>
        {stream.live ? (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium bg-grad-primary text-[hsl(var(--on-gradient))]">LIVE</span>
        ) : (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium bg-background/80 border border-border">{stream.duration ?? 'Replay'}</span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{stream.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{stream.category} • {stream.viewers} viewers</div>
            <button
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus:outline-none story-link"
              onClick={(e) => { e.stopPropagation(); onOpenProfile?.(stream.userId); }}
            >
              <User className="size-3.5" /> @{stream.username}
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLike} aria-label={liked ? 'Unlike' : 'Like'}>
            <Heart className={liked ? "fill-current text-[hsl(var(--brand-pink))]" : ""} />
          </Button>
        </div>
      </div>
    </motion.article>
  );
};
