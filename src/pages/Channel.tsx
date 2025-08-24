import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StreamCard } from "@/components/streams/StreamCard";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { useQuery } from "@tanstack/react-query";
import { Settings, Play, Eye, Heart, ExternalLink } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useUserVerification } from "@/hooks/useUserVerification";

// Component to show verified badge for a user
const VerifiedUserBadge: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: verification } = useUserVerification(userId);
  return <VerifiedBadge size="md" isVerified={verification?.isVerified} />;
};

const Channel: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { identity } = useWallet();

  // Fetch profile data by username (handle)
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile-by-username', username],
    queryFn: async () => {
      if (!username) return null;
      
      // First get the basic profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('handle', username)
        .maybeSingle();
      
      if (!profileData) return null;
      
      // Get follower counts, stream likes, and clip likes
      const [followerResult, followingResult, streamLikesResult, clipLikesResult] = await Promise.all([
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', profileData.id),
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', profileData.id),
        // Get likes for user's streams
        supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .in('stream_id', 
            await supabase
              .from('streams')
              .select('id')
              .eq('user_id', profileData.id)
              .then(({ data }) => data?.map(s => s.id) || [])
          ),
        // Get likes for user's clips
        supabase
          .from('clip_likes')
          .select('id', { count: 'exact', head: true })
          .in('clip_id',
            await supabase
              .from('clips')
              .select('id')
              .eq('user_id', profileData.id)
              .then(({ data }) => data?.map(c => c.id) || [])
          )
      ]);
      
      const totalLikes = (streamLikesResult.count || 0) + (clipLikesResult.count || 0);
      
      return {
        ...profileData,
        follower_count: followerResult.count || 0,
        following_count: followingResult.count || 0,
        total_likes: totalLikes
      };
    },
    enabled: !!username
  });

  const isOwnChannel = identity?.id === profile?.id;

  // Check if following
  const [following, setFollowing] = React.useState(false);
  React.useEffect(() => {
    const checkFollowing = async () => {
      if (!profile?.id || !identity?.id || identity.id === profile.id) {
        setFollowing(false);
        return;
      }
      
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', identity.id)
        .eq('following_id', profile.id)
        .single();
      
      setFollowing(!!data);
    };
    
    checkFollowing();
  }, [profile?.id, identity?.id]);

  const handleFollow = async () => {
    if (!identity?.id || !profile?.id) {
      toast({ title: "Please connect your wallet first" });
      return;
    }

    try {
      if (following) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', identity.id)
          .eq('following_id', profile.id);
        setFollowing(false);
        toast({ title: "Unfollowed" });
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: identity.id,
            following_id: profile.id
          });
        setFollowing(true);
        toast({ title: "Following!" });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({ title: "Failed to update follow status", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">Loading channel...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">Channel not found</div>
          <p className="text-muted-foreground mt-2">
            The channel "@{username}" doesn't exist or may have been removed.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>{profile.display_name || profile.handle} - Channel | Vivoor</title>
        <meta name="description" content={`Watch ${profile.display_name || profile.handle}'s streams and content on Vivoor. ${profile.bio || ''}`} />
      </Helmet>

      {/* Channel Header */}
      <div className="relative">
        {/* Banner */}
        <div className="h-32 md:h-48 relative">
          {profile?.banner_url ? (
            <img 
              src={profile.banner_url} 
              alt="Channel banner" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-grad-primary" />
          )}
          <div className="absolute inset-0 bg-background/10" />
          {isOwnChannel && (
            <Button
              variant="glass"
              size="sm"
              className="absolute top-4 right-4"
              onClick={() => navigate('/channel/settings')}
            >
              <Settings className="size-4 mr-2" />
              Edit Channel
            </Button>
          )}
        </div>
        
        {/* Profile Section */}
        <div className="container mx-auto px-4">
          <div className="relative -mt-16 pb-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="size-24 md:size-32 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar_url || ''} alt={`${profile.display_name} avatar`} />
                <AvatarFallback className="text-2xl bg-grad-primary text-[hsl(var(--on-gradient))]">
                  {(profile.display_name || profile.handle || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl md:text-3xl font-bold">{profile.display_name || profile.handle}</h1>
                      <VerifiedUserBadge userId={profile.id} />
                    </div>
                    {profile.bio ? (
                      <p className="text-muted-foreground">{profile.bio}</p>
                    ) : (
                      <p className="text-muted-foreground">@{profile.handle}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {!isOwnChannel && identity?.id && (
                      <Button
                        variant={following ? "secondary" : "hero"}
                        onClick={handleFollow}
                      >
                        {following ? 'Following' : 'Follow'}
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-6 text-sm mb-4">
                  <div>
                    <span className="font-semibold">{profile.total_likes || 0}</span>
                    <span className="text-muted-foreground ml-1">total likes</span>
                  </div>
                  <div>
                    <span className="font-semibold">{profile.follower_count || 0}</span>
                    <span className="text-muted-foreground ml-1">followers</span>
                  </div>
                  <div>
                    <span className="font-semibold">{profile.following_count || 0}</span>
                    <span className="text-muted-foreground ml-1">following</span>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User's Streams and Clips */}
      <ChannelStreams userId={profile.id} isOwnChannel={isOwnChannel} profile={profile} />
      <ChannelClips userId={profile.id} isOwnChannel={isOwnChannel} profile={profile} />
    </div>
  );
};

// Component to fetch and display user's streams
const ChannelStreams: React.FC<{ userId: string; isOwnChannel: boolean; profile: any }> = ({ userId, isOwnChannel, profile }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = React.useState(1);
  const streamsPerPage = 6;
  
  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['user-streams', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          category,
          is_live,
          viewers,
          thumbnail_url,
          created_at,
          playback_url
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching streams:', error);
        return [];
      }
      
      if (!data) return [];
      
      // Fetch like counts for each stream
      const streamsWithLikes = await Promise.all(
        data.map(async (stream) => {
          const { data: likeData } = await supabase.rpc('get_stream_like_count', { 
            stream_id_param: stream.id 
          });
          return {
            ...stream,
            likeCount: likeData || 0
          };
        })
      );
      
      return streamsWithLikes;
    },
    enabled: !!userId
  });

  const totalPages = Math.ceil(streams.length / streamsPerPage);
  const paginatedStreams = streams.slice(
    (currentPage - 1) * streamsPerPage,
    currentPage * streamsPerPage
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 animate-pulse">
              <div className="aspect-video bg-muted rounded-lg mb-3" />
              <div className="h-4 bg-muted rounded mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {isOwnChannel ? "You haven't streamed yet." : "No streams yet."}
          </div>
          {isOwnChannel && (
            <Button 
              variant="hero" 
              className="mt-4"
              onClick={() => navigate('/go-live')}
            >
              Start Streaming
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold mb-6">
        {isOwnChannel ? 'Your Streams' : 'Recent Streams'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedStreams.map((stream: any) => (
          <StreamCard
            key={stream.id}
            stream={{
              id: stream.id,
              title: stream.title,
              category: stream.category || 'General',
              live: stream.is_live || false,
              viewers: stream.viewers || 0,
              username: profile?.handle || profile?.display_name || 'Unknown',
              userId: userId,
              thumbnail: stream.thumbnail_url,
              likeCount: stream.likeCount || 0,
              avatar: profile?.avatar_url
            }}
          />
        ))}
      </div>
      
      {totalPages > 1 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex justify-center"
        >
          <div className="p-0.5 rounded-xl bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink">
            <Pagination className="bg-background rounded-xl">
              <PaginationContent className="gap-1">
                <PaginationItem>
                  <PaginationPrevious 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    className={`transition-all duration-300 ${
                      currentPage === 1 
                        ? 'pointer-events-none opacity-50' 
                        : 'hover:bg-gradient-to-r hover:from-brand-cyan/10 hover:to-brand-iris/10 hover:border-brand-iris/30'
                    }`}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(page);
                      }}
                      isActive={currentPage === page}
                      className={`transition-all duration-300 ${
                        currentPage === page
                          ? 'bg-gradient-to-r from-brand-iris to-brand-pink text-white border-transparent'
                          : 'hover:bg-gradient-to-r hover:from-brand-cyan/10 hover:to-brand-iris/10 hover:border-brand-iris/30'
                      }`}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    className={`transition-all duration-300 ${
                      currentPage === totalPages 
                        ? 'pointer-events-none opacity-50' 
                        : 'hover:bg-gradient-to-r hover:from-brand-iris/10 hover:to-brand-pink/10 hover:border-brand-pink/30'
                    }`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Component to fetch and display user's clips
const ChannelClips: React.FC<{ userId: string; isOwnChannel: boolean; profile: any }> = ({ userId, isOwnChannel, profile }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = React.useState(1);
  const clipsPerPage = 8;
  
  const { data: clips = [], isLoading } = useQuery({
    queryKey: ['user-clips', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clips')
        .select(`
          id,
          title,
          start_seconds,
          end_seconds,
          thumbnail_url,
          download_url,
          created_at,
          views
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching clips:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!userId
  });

  const totalPages = Math.ceil(clips.length / clipsPerPage);
  const paginatedClips = clips.slice(
    (currentPage - 1) * clipsPerPage,
    currentPage * clipsPerPage
  );

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

  const formatDuration = (startSeconds: number, endSeconds: number) => {
    const duration = endSeconds - startSeconds;
    return `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
  };

  if (clips.length === 0) {
    return null; // Don't show the section if there are no clips
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold mb-6">
        Clips
      </h2>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="relative rounded-xl overflow-hidden border border-border/20 bg-background/40 backdrop-blur-xl animate-pulse p-0.5 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink"
            >
              <div className="relative rounded-xl overflow-hidden bg-background h-full">
                <div className="aspect-video bg-gradient-to-br from-brand-cyan/10 via-brand-iris/10 to-brand-pink/10" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gradient-to-r from-brand-cyan/20 to-brand-iris/20 rounded" />
                  <div className="h-2 bg-gradient-to-r from-brand-iris/20 to-brand-pink/20 rounded w-2/3" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {paginatedClips.map((clip, index) => (
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
                      <Play className="size-8 text-muted-foreground" />
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
                      <Play className="size-4 fill-current" />
                    </Button>
                  </div>
                  
                  {/* Duration */}
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-white text-xs font-medium bg-black/90 backdrop-blur-sm z-10">
                    {formatDuration(clip.start_seconds, clip.end_seconds)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-3">
                  <h3 className="font-medium text-xs mb-2 line-clamp-2 cursor-pointer hover:text-primary transition-colors text-foreground leading-tight" 
                      onClick={() => handleClipClick(clip.id)}>
                    {clip.title}
                  </h3>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <div className="flex items-center gap-1">
                      <Eye className="size-2.5" />
                      {clip.views || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="size-2.5" />
                      0
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-xs text-muted-foreground">
                    {new Date(clip.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      
      {totalPages > 1 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex justify-center"
        >
          <div className="p-0.5 rounded-xl bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink">
            <Pagination className="bg-background rounded-xl">
              <PaginationContent className="gap-1">
                <PaginationItem>
                  <PaginationPrevious 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    className={`transition-all duration-300 ${
                      currentPage === 1 
                        ? 'pointer-events-none opacity-50' 
                        : 'hover:bg-gradient-to-r hover:from-brand-cyan/10 hover:to-brand-iris/10 hover:border-brand-iris/30'
                    }`}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(page);
                      }}
                      isActive={currentPage === page}
                      className={`transition-all duration-300 ${
                        currentPage === page
                          ? 'bg-gradient-to-r from-brand-iris to-brand-pink text-white border-transparent'
                          : 'hover:bg-gradient-to-r hover:from-brand-cyan/10 hover:to-brand-iris/10 hover:border-brand-iris/30'
                      }`}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    className={`transition-all duration-300 ${
                      currentPage === totalPages 
                        ? 'pointer-events-none opacity-50' 
                        : 'hover:bg-gradient-to-r hover:from-brand-iris/10 hover:to-brand-pink/10 hover:border-brand-pink/30'
                    }`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Channel;