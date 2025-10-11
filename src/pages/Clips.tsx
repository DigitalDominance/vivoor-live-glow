import React, { useState, useEffect } from "react";
import { Heart, Search, Play, Download, Eye, Calendar, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import ProfileModal from "@/components/modals/ProfileModal";
import { useWallet } from "@/context/WalletContext";
import { WalletConnectModal } from "@/components/modals/WalletConnectModal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useNavigate } from "react-router-dom";
import ClipVerifiedBadge from "@/components/ClipVerifiedBadge";
import UserKnsBadge from "@/components/UserKnsBadge";

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
  avatar: string;
  followers: number;
  following: number;
  tags?: string[];
};

const ClipsPage = () => {
  const navigate = useNavigate();
  const { identity, sessionToken } = useWallet();
  const [searchQuery, setSearchQuery] = useState("");
  const [orderBy, setOrderBy] = useState("views");
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [likedClips, setLikedClips] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  const CLIPS_PER_PAGE = 9;

  // Fetch clips with profiles using the database function
  const { data: allClips, isLoading } = useQuery({
    queryKey: ['clips-with-profiles', searchQuery, orderBy],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clips_with_profiles_and_stats', {
        _limit: 1000, // Get all clips for pagination
        _offset: 0,
        _search: searchQuery || null,
        _order_by: orderBy
      });
      
      if (error) {
        console.error('Error fetching clips:', error);
        throw error;
      }
      
      return data || [];
    },
    refetchInterval: 60000 // Refetch every 60 seconds (1 minute) to pick up new clips
  });

  // Calculate pagination
  const totalClips = allClips?.length || 0;
  const totalPages = Math.ceil(totalClips / CLIPS_PER_PAGE);
  const startIndex = (currentPage - 1) * CLIPS_PER_PAGE;
  const clips = allClips?.slice(startIndex, startIndex + CLIPS_PER_PAGE) || [];

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
    if (!identity?.id || !sessionToken) {
      setShowWalletModal(true);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('toggle_clip_like_secure', {
        session_token_param: sessionToken,
        wallet_address_param: identity.address,
        clip_id_param: clipId
      });

      if (error) throw error;

      const result = data?.[0];
      if (result) {
        if (result.action === 'liked') {
          setLikedClips(prev => new Set([...prev, clipId]));
        } else {
          setLikedClips(prev => {
            const newSet = new Set(prev);
            newSet.delete(clipId);
            return newSet;
          });
        }
        // Update local like count
        setLikeCounts(prev => ({
          ...prev,
          [clipId]: result.new_count
        }));
      }
      
      // Invalidate clips to refresh like counts
      queryClient.invalidateQueries({ queryKey: ['clips-with-profiles'] });
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
          avatar: profile.avatar_url || '',
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
    // Increment view count
    try {
      await supabase.rpc('increment_clip_views', { clip_id_param: clipId });
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
    
    // Navigate to clip page
    navigate(`/clip/${clipId}`);
  };

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, orderBy]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/10 via-brand-iris/5 to-brand-pink/10 -z-10" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-background/80 to-background -z-5" />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 relative z-50"
        >
          <h1 className="text-5xl font-bold mb-2">
            <span className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent animate-gradient">
              Discover Clips
            </span>
          </h1>
          <p className="text-foreground text-lg">
            Watch the most popular moments from our community
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative p-6 mb-8 rounded-xl border border-border/20 bg-background/40 backdrop-blur-xl"
          style={{
            background: `linear-gradient(135deg, 
              hsl(var(--background) / 0.8) 0%, 
              hsl(var(--background) / 0.6) 50%, 
              hsl(var(--background) / 0.8) 100%)`
          }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                placeholder="Search clips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/60 border-border/30 backdrop-blur-sm"
              />
            </div>
            <Select value={orderBy} onValueChange={setOrderBy}>
              <SelectTrigger className="w-full sm:w-48 bg-background/60 border-border/30 backdrop-blur-sm">
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
                <SelectItem value="likes">
                  <div className="flex items-center gap-2">
                    <Heart className="size-4" />
                    Most Liked
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Clips Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative rounded-xl overflow-hidden border border-border/20 bg-background/40 backdrop-blur-xl animate-pulse"
                style={{
                  background: `linear-gradient(135deg, 
                    hsl(var(--background) / 0.8) 0%, 
                    hsl(var(--background) / 0.6) 50%, 
                    hsl(var(--background) / 0.8) 100%)`
                }}
              >
                <div className="aspect-video bg-gradient-to-br from-brand-cyan/10 via-brand-iris/10 to-brand-pink/10" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gradient-to-r from-brand-cyan/20 to-brand-iris/20 rounded" />
                  <div className="h-3 bg-gradient-to-r from-brand-iris/20 to-brand-pink/20 rounded w-2/3" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : clips && clips.length > 0 ? (
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {clips.map((clip, index) => {
                const isLiked = likedClips.has(clip.id);
                const likeCount = likeCounts[clip.id] ?? clip.like_count ?? 0;
                
                return (
                  <motion.div
                    key={clip.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                     className="group relative rounded-xl backdrop-blur-xl hover:shadow-2xl hover:shadow-brand-iris/10 transition-all duration-500 p-0.5 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink"
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
                       {/* Thumbnail */}
                       <div
                         className="relative aspect-video cursor-pointer overflow-hidden rounded-t-xl"
                         onClick={() => handleClipClick(clip.id)}
                       >
                      {clip.download_url ? (
                        <video
                          className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                          muted
                          playsInline
                          preload="metadata"
                          webkit-playsinline="true"
                          x-webkit-airplay="deny"
                          poster=""
                          onLoadedMetadata={(e) => {
                            const video = e.currentTarget;
                            video.currentTime = Math.min(0.5, video.duration / 2);
                          }}
                          onMouseEnter={(e) => {
                            const video = e.currentTarget;
                            if (video.readyState >= 1) {
                              video.currentTime = Math.min(0.5, video.duration / 2);
                            }
                          }}
                          onTouchStart={(e) => {
                            const video = e.currentTarget;
                            if (video.readyState >= 1) {
                              video.currentTime = Math.min(0.5, video.duration / 2);
                            }
                          }}
                        >
                          <source src={clip.download_url} type="video/mp4" />
                        </video>
                      ) : clip.thumbnail_url ? (
                        <img
                          src={clip.thumbnail_url}
                          alt={clip.title}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 flex items-center justify-center">
                          <Play className="size-12 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                        {/* Play button overlay */}
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-background/90 backdrop-blur-sm hover:bg-background scale-75 group-hover:scale-100"
                          >
                            <Play className="size-5 fill-current" />
                          </Button>
                        </div>
                      
                        {/* Duration */}
                        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/90 text-white text-xs font-medium backdrop-blur-sm z-10">
                          {Math.floor((clip.end_seconds - clip.start_seconds) / 60)}:
                          {String((clip.end_seconds - clip.start_seconds) % 60).padStart(2, '0')}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h3 className="font-medium text-sm mb-2 line-clamp-2 cursor-pointer hover:text-primary transition-colors text-foreground" 
                            onClick={() => handleClipClick(clip.id)}>
                          {clip.title}
                        </h3>
                      
                        {/* Creator Info */}
                        <button
                          onClick={() => handleProfileClick(clip.user_id)}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 story-link"
                        >
                          <Avatar className="size-5">
                            <AvatarImage src={clip.profile_avatar_url || ''} alt={`@${clip.profile_handle} avatar`} />
                            <AvatarFallback className="text-[10px]">
                              {clip.profile_display_name?.[0]?.toUpperCase() || clip.profile_handle?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-1">
                            <span>@{clip.profile_handle || 'Unknown'}</span>
                            <ClipVerifiedBadge userId={clip.user_id} size="sm" />
                            <UserKnsBadge userId={clip.user_id} size="sm" />
                          </div>
                        </button>

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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 hover:bg-brand-pink/10 hover:text-brand-pink transition-all duration-200 relative z-20"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLike(clip.id, isLiked);
                              }}
                              aria-label={isLiked ? 'Unlike' : 'Like'}
                            >
                              <Heart className={`size-3 transition-all duration-200 ${isLiked ? "fill-current text-brand-pink" : ""}`} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-16 flex justify-center relative z-50"
              >
                <div className="flex items-center gap-2 p-1 rounded-xl bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-background">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium rounded-lg bg-background hover:bg-gradient-to-r hover:from-brand-cyan/20 hover:via-brand-iris/20 hover:to-brand-pink/20 transition-all duration-300 disabled:opacity-50 disabled:hover:bg-background"
                    >
                      <ChevronLeft className="size-4 mr-1" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let page;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={`w-10 h-10 rounded-lg text-sm font-medium transition-all duration-300 ${
                              currentPage === page
                                ? "bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink text-white shadow-lg"
                                : "hover:bg-gradient-to-r hover:from-brand-cyan/20 hover:via-brand-iris/20 hover:to-brand-pink/20"
                            }`}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium rounded-lg bg-background hover:bg-gradient-to-r hover:from-brand-cyan/20 hover:via-brand-iris/20 hover:to-brand-pink/20 transition-all duration-300 disabled:opacity-50 disabled:hover:bg-background"
                    >
                      Next
                      <ChevronRight className="size-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
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