import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import HlsPlayer from "@/components/players/HlsPlayer";
import PlayerPlaceholder from "@/components/streams/PlayerPlaceholder";
import TipModal from "@/components/modals/TipModal";
import ProfileModal from "@/components/modals/ProfileModal";
import TipDisplay from "@/components/TipDisplay";
import ChatPanel from "@/components/streams/ChatPanel";
import { StreamCard } from "@/components/streams/StreamCard";
import { useWallet } from "@/context/WalletContext";
import { useTipMonitoring } from "@/hooks/useTipMonitoring";
import { useViewerTracking } from "@/hooks/useViewerTracking";
import ClipCreator from "@/components/modals/ClipCreator";
import { toast } from "sonner";
import { Heart, Play, Pause, MoreVertical, Users, Scissors } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { getCategoryThumbnail } from "@/utils/categoryThumbnails";

const Watch = () => {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { identity } = useWallet();
  const [elapsed, setElapsed] = React.useState(0);
  const [tipOpen, setTipOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [liked, setLiked] = React.useState(false);
  const [followed, setFollowed] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(0);
  const [followerCount, setFollowerCount] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [newTips, setNewTips] = React.useState<any[]>([]);
  const [shownTipIds, setShownTipIds] = React.useState<Set<string>>(new Set());
  const [clipModalOpen, setClipModalOpen] = React.useState(false);

  // Fetch stream data
  const { data: streamData, isLoading } = useQuery({
    queryKey: ['stream', streamId],
    queryFn: async () => {
      if (!streamId) return null;
      const { data } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle();
      return data;
    },
    enabled: !!streamId,
    refetchInterval: 30000 // Refetch every 30 seconds to check if stream is still live
  });

  // Fetch streamer profile using secure function
  const { data: streamerProfile } = useQuery({
    queryKey: ['streamer-profile', streamData?.user_id],
    queryFn: async () => {
      if (!streamData?.user_id) return null;
      const { data } = await supabase.rpc('get_profile_with_stats', { 
        _user_id: streamData.user_id 
      });
      return data?.[0] || null;
    },
    enabled: !!streamData?.user_id
  });

  // Check if user already likes/follows this stream/user
  React.useEffect(() => {
    if (!identity?.id || !streamData?.id || !streamData?.user_id) return;

    const checkLikeStatus = async () => {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', identity.id)
        .eq('stream_id', streamData.id)
        .maybeSingle();
      setLiked(!!data);
    };

    const checkFollowStatus = async () => {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', identity.id)
        .eq('following_id', streamData.user_id)
        .maybeSingle();
      setFollowed(!!data);
    };

    const getLikeCount = async () => {
      const { data } = await supabase.rpc('get_stream_like_count', { 
        stream_id_param: streamData.id 
      });
      setLikeCount(data || 0);
    };

    checkLikeStatus();
    checkFollowStatus();
    getLikeCount();
  }, [identity?.id, streamData?.id, streamData?.user_id]);

  React.useEffect(() => {
    if (streamerProfile?.follower_count !== undefined) {
      setFollowerCount(streamerProfile.follower_count);
    }
  }, [streamerProfile?.follower_count]);

  // Get streamer's Kaspa address for tipping (secure function)
  const { data: streamerKaspaAddress } = useQuery({
    queryKey: ['tip-address', streamId],
    queryFn: async () => {
      if (!streamId || !identity?.id) return null;
      const { data } = await supabase.rpc('get_tip_address', { 
        stream_id: streamId 
      });
      return data;
    },
    enabled: !!streamId && !!identity?.id
  });

  // Fetch suggested streams
  const { data: suggestedStreams } = useQuery({
    queryKey: ['suggested-streams', streamData?.category],
    queryFn: async () => {
      const { data } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          category,
          is_live,
          viewers,
          user_id,
          thumbnail_url,
          started_at
        `)
        .eq('is_live', true)
        .neq('id', streamId || '')
        .limit(6)
        .order('viewers', { ascending: false });
      
      if (!data) return [];
      
      // Fetch profile data separately for each stream
      const streamsWithProfiles = await Promise.all(
        data.map(async (stream) => {
          const { data: profileData } = await supabase.rpc('get_public_profile_display', { 
            user_id: stream.user_id 
          });
          const profile = profileData?.[0];
          
          return {
            id: stream.id,
            title: stream.title,
            category: stream.category || 'IRL',
            live: stream.is_live,
            viewers: stream.viewers || 0,
            username: profile?.handle || profile?.display_name || 'Unknown',
            userId: stream.user_id,
            thumbnail: stream.thumbnail_url || getCategoryThumbnail(stream.category || 'IRL'),
            startedAt: stream.started_at,
          };
        })
      );
      
      return streamsWithProfiles;
    },
    enabled: !!streamData
  });

  // Fetch chat messages
  const { data: chatMessages } = useQuery({
    queryKey: ['chat', streamId],
    queryFn: async () => {
      if (!streamId) return [];
      const { data } = await supabase
        .from('chat_messages')
        .select(`
          *,
          profiles:user_id (display_name, handle, avatar_url)
        `)
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })
        .limit(100);
      
      // Transform data to match ChatMessage interface
      return data?.map(msg => ({
        id: msg.id,
        user: msg.profiles?.display_name || msg.profiles?.handle || 'Anonymous',
        text: msg.message,
        time: new Date(msg.created_at).toLocaleTimeString()
      })) || [];
    },
    enabled: !!streamId,
    refetchInterval: 2000 // Update chat every 2 seconds
  });

  // Monitor tips for this stream
  const { tips: allTips, totalAmountReceived } = useTipMonitoring({
    streamId: streamData?.id,
    kaspaAddress: streamerKaspaAddress,
    streamStartBlockTime: streamData?.treasury_block_time,
    onNewTip: (tip) => {
      if (!shownTipIds.has(tip.id)) {
        setNewTips(prev => [...prev, tip]);
        toast.success(`New tip: ${tip.amount} KAS from ${tip.sender}`);
      }
    }
  });

  // Track viewer count
  useViewerTracking(streamData?.id || null, streamData?.is_live || false);

  const handleTipShown = (tipId: string) => {
    setShownTipIds(prev => new Set([...prev, tipId]));
    setNewTips(prev => prev.filter(tip => tip.id !== tipId));
  };

  // Set up realtime subscription for chat messages
  React.useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `stream_id=eq.${streamId}`
        },
        () => {
          // Refetch chat messages when new ones arrive
          // The query will automatically update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Handle elapsed time calculation
  React.useEffect(() => {
    if (!streamData?.started_at) return;
    
    const startTime = new Date(streamData.started_at);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [streamData?.started_at]);

  const handleSendMessage = async (message: string) => {
    if (!streamId || !identity?.id) {
      toast.error('You must be logged in to chat');
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          stream_id: streamId,
          user_id: identity.id,
          message: message.trim()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleFollow = async () => {
    if (!identity?.id || !streamData?.user_id) {
      onRequireLogin();
      return;
    }

    try {
      if (followed) {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: identity.id, following_id: streamData.user_id });
        setFollowerCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: identity.id, following_id: streamData.user_id });
        setFollowerCount(prev => prev + 1);
      }
      setFollowed(!followed);
      toast.success(followed ? 'Unfollowed' : 'Followed!');
    } catch (error) {
      console.error('Follow error:', error);
      toast.error('Failed to update follow status');
    }
  };

  const handleLike = async () => {
    if (!identity?.id || !streamData?.id) {
      onRequireLogin();
      return;
    }

    try {
      if (liked) {
        await supabase
          .from('likes')
          .delete()
          .match({ user_id: identity.id, stream_id: streamData.id });
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('likes')
          .insert({ user_id: identity.id, stream_id: streamData.id });
        setLikeCount(prev => prev + 1);
      }
      setLiked(!liked);
    } catch (error) {
      console.error('Like error:', error);
      toast.error('Failed to update like status');
    }
  };

  const onRequireLogin = () => {
    toast.error('Please connect your wallet to continue');
  };

  const formatTime = (seconds: number) => {
    return new Date(seconds * 1000).toISOString().substring(11, 19);
  };

  // Current user profile for display
  const profile = React.useMemo(() => {
    if (!identity?.id) return null;
    // Use wallet context profile or create a basic one
    return {
      handle: identity.id.slice(0, 8),
      display_name: identity.id.slice(0, 8)
    };
  }, [identity?.id]);

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">Loading stream...</div>
        </div>
      </main>
    );
  }

  if (!streamData) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">Stream not found</div>
          <Button onClick={() => navigate('/app')} className="mt-4">
            Back to Directory
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>{streamData.title} — Vivoor</title>
        <meta name="description" content={`Watch ${streamData.title} live on Vivoor`} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Helmet>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Video player */}
          <div className="relative rounded-xl overflow-hidden">
            {streamData.playback_url ? (
              <HlsPlayer 
                src={streamData.playback_url} 
                autoPlay 
                isLiveStream={streamData.is_live}
                key={streamData.id}
              />
            ) : (
              <PlayerPlaceholder />
            )}
            
            {/* Video controls overlay - improved for mobile */}
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="glass"
                  size="icon"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="bg-background/80 backdrop-blur-sm text-foreground border border-border/50 h-8 w-8 sm:h-10 sm:w-10"
                >
                  {isPlaying ? <Pause className="size-3 sm:size-4" /> : <Play className="size-3 sm:size-4" />}
                </Button>
                <span className="text-xs sm:text-sm bg-background/80 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-foreground border border-border/50">
                  {streamData.playback_url ? 'LIVE' : 'OFFLINE'} • {formatTime(elapsed)}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="flex items-center gap-1 text-xs sm:text-sm bg-background/80 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-foreground border border-border/50">
                  <Users className="size-3 sm:size-4" />
                  {streamData.viewers || 0}
                </span>
                {streamData.playback_url && (
                  <Button
                    variant="glass" 
                    size="icon"
                    onClick={() => setClipModalOpen(true)}
                    title="Create Clip"
                    className="bg-background/80 backdrop-blur-sm text-foreground border border-border/50 h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <Scissors className="size-3 sm:size-4" />
                  </Button>
                )}
                <Button 
                  variant="glass" 
                  size="icon"
                  className="bg-background/80 backdrop-blur-sm text-foreground border border-border/50 h-8 w-8 sm:h-10 sm:w-10"
                >
                  <MoreVertical className="size-3 sm:size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Stream info */}
          <div className="glass rounded-xl p-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0 w-full sm:w-auto">
                <Avatar className="size-10 sm:size-12 flex-shrink-0">
                  <AvatarImage src={streamerProfile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {(streamerProfile?.display_name || streamerProfile?.handle || 'S').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold truncate">{streamData.title}</h1>
                  <button 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setProfileOpen(true)}
                  >
                    @{streamerProfile?.handle || 'streamer'}
                  </button>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      {streamData.category || 'IRL'}
                    </span>
                    {streamData.playback_url && (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-500 text-white">
                        LIVE
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant={liked ? "hero" : "ghost"}
                  size="sm"
                  onClick={handleLike}
                  className="flex-1 sm:flex-none"
                >
                  <Heart className={`size-4 ${liked ? "fill-current" : ""}`} />
                  <span className="ml-1">{likeCount}</span>
                </Button>
                <Button
                  variant={followed ? "secondary" : "hero"}
                  size="sm"
                  onClick={handleFollow}
                  className="flex-1 sm:flex-none"
                >
                  {followed ? 'Following' : 'Follow'}
                </Button>
                <Button
                  variant="gradientOutline"
                  size="sm"
                  onClick={() => setTipOpen(true)}
                  disabled={!identity?.id || !streamerKaspaAddress}
                  className="flex-1 sm:flex-none"
                >
                  Tip KAS
                </Button>
              </div>
            </div>
          </div>

          {/* Suggested streams */}
          {suggestedStreams && suggestedStreams.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">More Live Streams</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestedStreams.slice(0, 6).map((stream) => (
                  <StreamCard
                    key={stream.id}
                    stream={stream}
                    isLoggedIn={!!identity}
                    onOpenProfile={() => setProfileOpen(true)}
                    onRequireLogin={onRequireLogin}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <div className="lg:col-span-1">
          <div className="h-[400px] lg:h-[600px] glass rounded-xl p-4">
            <h3 className="font-semibold mb-4">Chat</h3>
            <div className="h-full flex flex-col gap-4">
              <div className="flex-1 overflow-y-auto space-y-2">
                {chatMessages?.map(msg => (
                  <div key={msg.id} className="text-sm">
                    <span className="font-medium text-primary">{msg.user}:</span>
                    <span className="ml-2">{msg.text}</span>
                  </div>
                ))}
              </div>
              {identity?.id ? (
                <input 
                  type="text" 
                  placeholder="Type a message..."
                  className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      handleSendMessage(e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    }
                  }}
                />
              ) : (
                <Button onClick={onRequireLogin} size="sm">Connect wallet to chat</Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProfileModal 
        open={profileOpen} 
        onOpenChange={setProfileOpen} 
        profile={streamerProfile ? {
          id: streamerProfile.id,
          displayName: streamerProfile.display_name || streamerProfile.handle || 'Streamer',
          handle: streamerProfile.handle || 'streamer',
          bio: streamerProfile.bio || '',
          followers: followerCount,
          following: streamerProfile.following_count || 0,
          tags: []
        } : undefined}
        isLoggedIn={!!identity}
        onRequireLogin={onRequireLogin}
        onGoToChannel={() => {}}
      />
      
      <TipModal 
        open={tipOpen} 
        onOpenChange={setTipOpen} 
        isLoggedIn={!!identity} 
        onRequireLogin={onRequireLogin} 
        toAddress={streamerKaspaAddress}
        senderHandle={profile?.handle || identity?.id?.slice(0, 8)} 
      />
      
      {/* Tip notifications overlay - positioned for fullscreen compatibility */}
      <TipDisplay newTips={newTips} onTipShown={handleTipShown} />
      
      {/* Clip Creator Modal */}
      <ClipCreator 
        open={clipModalOpen}
        onOpenChange={setClipModalOpen}
        vod={streamData ? {
          id: streamData.id,
          src_url: streamData.playback_url || '',
          title: streamData.title,
          duration_seconds: elapsed
        } : null}
        onCreated={() => {
          toast.success('Clip created successfully!');
        }}
      />
    </main>
  );
};

export default Watch;