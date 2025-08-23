import React, { useState, useEffect } from "react";
import { Heart, Search, Play, Download, Eye, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import ProfileModal from "@/components/modals/ProfileModal";
import { useWallet } from "@/context/WalletContext";
import WalletConnectModal from "@/components/modals/WalletConnectModal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

type ClipWithProfile = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  download_url: string | null;
  views?: number;
  created_at: string;
  user_id: string;
  start_seconds: number;
  end_seconds: number;
  profiles?: {
    handle: string;
    display_name: string;
    avatar_url: string;
  };
};

type UserProfile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatar_url: string;
  followers: number;
  following: number;
  tags?: string[];
};

const ClipsPage = () => {
  const navigate = useNavigate();
  const { identity } = useWallet();
  const [searchQuery, setSearchQuery] = useState("");
  const [orderBy, setOrderBy] = useState("created_at");
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [likedClips, setLikedClips] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch clips with profiles
  const { data: clips, isLoading } = useQuery({
    queryKey: ['clips', searchQuery, orderBy],
    queryFn: async () => {
      let query = supabase
        .from('clips')
        .select(`
          *,
          profiles:user_id (
            handle,
            display_name,
            avatar_url
          )
        `);

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      if (orderBy === 'views') {
        query = query.order('views', { ascending: false });
      } else if (orderBy === 'created_at') {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 10000 // Refetch every 10 seconds to pick up new clips
  });

  // Fetch clip like counts using database function
  const { data: clipLikeCounts } = useQuery({
    queryKey: ['clip-like-counts', clips?.map(c => c.id)],
    queryFn: async () => {
      if (!clips || clips.length === 0) return {};
      
      // Get like counts for each clip
      const likeCounts: Record<string, number> = {};
      await Promise.all(
        clips.map(async (clip) => {
          const { data } = await supabase.rpc('get_clip_like_count', { 
            clip_id_param: clip.id 
          });
          likeCounts[clip.id] = data || 0;
        })
      );
      
      return likeCounts;
    },
    enabled: !!clips && clips.length > 0
  });

  // Check which clips the user has liked
  useEffect(() => {
    if (!identity?.id || !clips) return;

    const checkLikedClips = async () => {
      try {
        const clipIds = clips.map(clip => clip.id);
        const { data } = await supabase
          .from('clip_likes')
          .select('clip_id')
          .eq('user_id', identity.id)
          .in('clip_id', clipIds);
        
        if (data) {
          setLikedClips(new Set(data.map(like => like.clip_id)));
        }
      } catch (error) {
        console.error('Error checking liked clips:', error);
      }
    };

    checkLikedClips();
  }, [identity?.id, clips]);

  const handleLike = async (clipId: string, isLiked: boolean) => {
    if (!identity?.id) {
      setShowWalletModal(true);
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('clip_likes')
          .delete()
          .match({ user_id: identity.id, clip_id: clipId });
        setLikedClips(prev => {
          const newSet = new Set(prev);
          newSet.delete(clipId);
          return newSet;
        });
      } else {
        await supabase
          .from('clip_likes')
          .insert({ user_id: identity.id, clip_id: clipId });
        setLikedClips(prev => new Set([...prev, clipId]));
      }
      
      // Invalidate clip like counts to refresh
      queryClient.invalidateQueries({ queryKey: ['clip-like-counts'] });
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like status');
    }
  };

  const handleProfileClick = async (userId: string) => {
    try {
      const { data } = await supabase.rpc('get_profile_with_stats', {
        _user_id: userId
      });
      
      if (data && data.length > 0) {
        const profile = data[0];
        setSelectedProfile({
          id: profile.id,
          handle: profile.handle,
          displayName: profile.display_name || profile.handle,
          bio: profile.bio || '',
          avatar_url: profile.avatar_url || '',
          followers: profile.follower_count || 0,
          following: profile.following_count || 0,
          tags: []
        });
        setShowProfileModal(true);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    }
  };

  const handleClipClick = async (clipId: string) => {
    // Navigate to clip page
    navigate(`/clip/${clipId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-grad-primary bg-clip-text text-transparent mb-2">
            Discover Clips
          </h1>
          <p className="text-muted-foreground">
            Watch the most popular moments from our community
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6 mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                placeholder="Search clips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={orderBy} onValueChange={setOrderBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4" />
                    Latest
                  </div>
                </SelectItem>
                <SelectItem value="views">
                  <div className="flex items-center gap-2">
                    <Eye className="size-4" />
                    Most Viewed
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Clips Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted/20" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted/20 rounded" />
                  <div className="h-3 bg-muted/20 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : clips && clips.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {clips.map((clip, index) => {
              const isLiked = likedClips.has(clip.id);
              const profile = Array.isArray(clip.profiles) ? clip.profiles[0] : clip.profiles;
              const likeCount = clipLikeCounts?.[clip.id] || 0;
              return (
                <motion.div
                  key={clip.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group glass rounded-xl overflow-hidden border border-border hover:shadow-lg transition-all duration-300"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative aspect-video bg-muted/40 cursor-pointer"
                    onClick={() => handleClipClick(clip.id)}
                  >
                    {clip.thumbnail_url ? (
                      <img
                        src={clip.thumbnail_url}
                        alt={clip.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-grad-subtle flex items-center justify-center">
                        <Play className="size-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Button
                        variant="glass"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play className="size-5" />
                      </Button>
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 text-white text-xs">
                      {Math.floor((clip.end_seconds - clip.start_seconds) / 60)}:
                      {String((clip.end_seconds - clip.start_seconds) % 60).padStart(2, '0')}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-medium text-sm mb-2 line-clamp-2 cursor-pointer hover:text-primary transition-colors" 
                        onClick={() => handleClipClick(clip.id)}>
                      {clip.title}
                    </h3>
                    
                    {/* Creator Info */}
                    {profile && (
                      <button
                        onClick={() => handleProfileClick(clip.user_id)}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 story-link"
                      >
                        <Avatar className="size-5">
                          <AvatarImage src={profile.avatar_url || ''} alt={`@${profile.handle} avatar`} />
                          <AvatarFallback className="text-[10px]">
                            {profile.display_name?.[0]?.toUpperCase() || profile.handle?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>@{profile.handle}</span>
                      </button>
                    )}

                    {/* Stats and Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="size-3" />
                          {clip.views || 0}
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="size-3" />
                          {likeCount}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {clip.download_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(clip.download_url!, '_blank');
                            }}
                            aria-label="Download clip"
                          >
                            <Download className="size-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(clip.id, isLiked);
                          }}
                          aria-label={isLiked ? 'Unlike' : 'Like'}
                        >
                          <Heart className={`size-3 ${isLiked ? "fill-current text-[hsl(var(--brand-pink))]" : ""}`} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Play className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No clips found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? "Try adjusting your search" : "Be the first to create a clip!"}
            </p>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        profile={selectedProfile ? {
          ...selectedProfile,
          tags: selectedProfile.tags || []
        } : null}
        isLoggedIn={!!identity}
        onRequireLogin={() => setShowWalletModal(true)}
        onGoToChannel={() => {}}
      />

      <WalletConnectModal
        open={showWalletModal}
        onOpenChange={setShowWalletModal}
      />
    </div>
  );
};

export default ClipsPage;