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
  const [liked, setLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(stream.likeCount || 0);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) return onRequireLogin?.();
    
    try {
      // Use wallet identity for likes - the identity.id is now the user UUID from authenticate_wallet_user
      const walletData = JSON.parse(localStorage.getItem('vivoor.wallet.provider') || 'null');
      if (!walletData) {
        onRequireLogin?.();
        return;
      }

      // Get current wallet address to get user ID
      const kaswareAccounts = await (window as any).kasware?.getAccounts?.();
      const walletAddress = kaswareAccounts?.[0];
      if (!walletAddress) {
        onRequireLogin?.();
        return;
      }

      // Get user ID from wallet address
      const { data: userId } = await supabase.rpc('authenticate_wallet_user', {
        wallet_address: walletAddress
      });

      if (!userId) {
        onRequireLogin?.();
        return;
      }

      if (liked) {
        // Remove like
        await supabase.from('likes').delete().match({ 
          stream_id: stream.id, 
          user_id: userId
        });
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        // Add like
        await supabase.from('likes').insert({ 
          stream_id: stream.id, 
          user_id: userId
        });
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
      className="group glass rounded-xl overflow-hidden border border-border hover:shadow-lg transition-colors"
      whileHover={{ translateY: -2 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className="relative aspect-video bg-muted/40">
        {stream.thumbnail ? (
          <img
            src={stream.thumbnail}
            alt={stream.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to category thumbnail if custom thumbnail fails
              const target = e.target as HTMLImageElement;
              target.src = `/src/assets/category-${stream.category.toLowerCase()}.jpg`;
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[length:200%_100%] animate-shimmer bg-gradient-to-r from-foreground/10 via-transparent to-foreground/10" />
        )}
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
            <Button variant="ghost" size="icon" onClick={handleLike} aria-label={liked ? 'Unlike' : 'Like'}>
              <Heart className={liked ? "fill-current text-[hsl(var(--brand-pink))]" : ""} />
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
