import { Heart, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type StreamCardProps = {
  stream: {
    id: string;
    title: string;
    category: string;
    live: boolean;
    viewers: number;
    username: string;
    userId: string;
    thumbnail?: string;
    startedAt?: string;
    duration?: string;
    likeCount?: number;
    avatar?: string;
  };
  isLoggedIn?: boolean;
  onOpenProfile?: (userId: string) => void;
  onRequireLogin?: () => void;
};

export const StreamCard: React.FC<StreamCardProps> = ({ stream, isLoggedIn, onOpenProfile, onRequireLogin }) => {
  const navigate = useNavigate();
  const { identity } = useWallet();
  const [liked, setLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(stream.likeCount || 0);

  // Update likeCount when stream.likeCount changes
  React.useEffect(() => {
    setLikeCount(stream.likeCount || 0);
  }, [stream.likeCount]);

  // Check if user already likes this stream
  React.useEffect(() => {
    if (!identity?.id || !stream.id) return;

    const checkLikeStatus = async () => {
      try {
        const { data } = await supabase
          .from('likes')
          .select('id')
          .eq('user_id', identity.id)
          .eq('stream_id', stream.id)
          .maybeSingle();
        setLiked(!!data);
      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    checkLikeStatus();
  }, [identity?.id, stream.id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!identity?.id) {
      onRequireLogin?.();
      return;
    }

    try {
      if (liked) {
        await supabase
          .from('likes')
          .delete()
          .match({ user_id: identity.id, stream_id: stream.id });
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('likes')
          .insert({ user_id: identity.id, stream_id: stream.id });
        setLikeCount(prev => prev + 1);
      }
      setLiked(!liked);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleClick = () => {
    // Navigate to watch page for all streams
    navigate(`/watch/${stream.id}`);
  };

  return (
    <motion.article
      className="group relative rounded-xl backdrop-blur-xl hover:shadow-2xl hover:shadow-brand-iris/10 transition-all duration-500 p-0.5 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink"
      whileHover={{ translateY: -2 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {/* Inner content container */}
      <div className="relative rounded-xl overflow-hidden bg-background h-full"
        style={{
          background: `linear-gradient(135deg, 
            hsl(var(--background) / 0.95) 0%, 
            hsl(var(--background) / 0.8) 50%, 
            hsl(var(--background) / 0.95) 100%)`
        }}
      >
        <div className="relative aspect-video bg-muted/40 rounded-t-xl overflow-hidden">
          {stream.thumbnail ? (
            <img
              src={stream.thumbnail}
              alt={stream.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
              onError={(e) => {
                // Fallback to category thumbnail if custom thumbnail fails
                const target = e.target as HTMLImageElement;
                target.src = `/src/assets/category-${stream.category.toLowerCase()}.jpg`;
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 flex items-center justify-center">
              <Play className="size-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <Button variant="glass" size="icon" className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm hover:bg-background scale-75 group-hover:scale-100">
            <Play className="fill-current" />
          </Button>
          {stream.live ? (
            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-400/50">LIVE</span>
          ) : (
            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium bg-background/80 border border-border">{stream.duration ?? 'Ended'}</span>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate text-foreground">{stream.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{stream.category} • {stream.viewers} viewers</div>
              <button
                className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground focus:outline-none story-link"
                onClick={(e) => { e.stopPropagation(); onOpenProfile?.(stream.userId); }}
              >
                <Avatar className="size-4">
                  <AvatarImage src={stream.avatar} alt={`@${stream.username} avatar`} />
                  <AvatarFallback className="text-[10px]">{stream.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span>@{stream.username}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="size-3" />
                {likeCount}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLike} 
                aria-label={liked ? 'Unlike' : 'Like'}
                className="size-8 hover:bg-brand-pink/10 hover:text-brand-pink transition-all duration-200"
              >
                <Heart className={liked ? "fill-current text-[hsl(var(--brand-pink))]" : ""} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
