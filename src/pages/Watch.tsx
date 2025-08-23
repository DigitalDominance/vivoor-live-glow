import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import HlsPlayer from "@/components/players/HlsPlayer";
import PlayerPlaceholder from "@/components/streams/PlayerPlaceholder";
import CustomVideoControls from "@/components/players/CustomVideoControls";
import TipModal from "@/components/modals/TipModal";
import ProfileModal from "@/components/modals/ProfileModal";
import TipDisplay from "@/components/TipDisplay";
import ChatPanel from "@/components/streams/ChatPanel";
import { StreamCard } from "@/components/streams/StreamCard";
import { useWallet } from "@/context/WalletContext";
import { useTipMonitoring } from "@/hooks/useTipMonitoring";
import { useStreamStatus } from "@/hooks/useStreamStatus";
import { useViewerTracking } from "@/hooks/useViewerTracking";
import { useStreamChat } from "@/hooks/useStreamChat";
import LivepeerClipCreator from "@/components/modals/LivepeerClipCreator";
import { toast } from "sonner";
import { Heart, Volume2, VolumeX } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { getCategoryThumbnail } from "@/utils/categoryThumbnails";
import { containsBadWords, cleanText } from "@/lib/badWords";
import { startStreamTracking, updateStreamStatus, stopStreamTracking } from "@/lib/streamLocal";

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
  const [newMessage, setNewMessage] = React.useState('');
  const [volume, setVolume] = React.useState(1);
  const [isMuted, setIsMuted] = React.useState(true); // Start muted for autoplay, will unmute immediately
  const [showControls, setShowControls] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const playerContainerRef = React.useRef<HTMLDivElement>(null);

  // WebSocket chat
  const { messages: wsMessages, sendChat, isConnected: chatConnected } = useStreamChat(streamId || '');

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

  // Fetch current user's profile for chat display
  const { data: currentUserProfile } = useQuery({
    queryKey: ['current-user-profile', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase.rpc('get_profile_with_stats', { 
        _user_id: identity.id 
      });
      return data?.[0] || null;
    },
    enabled: !!identity?.id
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

  // Transform WebSocket messages to chat format
  const chatMessages = React.useMemo(() => {
    return wsMessages
      .filter(msg => msg.type === 'chat') // Only show chat messages
      .map(msg => ({
        id: `${msg.serverTs}-${msg.user.id}`,
        user: {
          id: msg.user.id,
          name: msg.user.name,
          avatar: msg.user.avatar
        },
        text: msg.text,
        time: new Date(msg.serverTs).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      }));
  }, [wsMessages]);

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

  // Use new stream status tracking
  const { isLive: livepeerIsLive, viewerCount, isConnected: streamConnected } = useStreamStatus(
    streamData?.id || null, 
    streamData?.livepeer_stream_id
  );

  // Use improved viewer tracking with unique session ID
  useViewerTracking(
    streamData?.id || null,
    livepeerIsLive,
    identity?.id || null
  );

  const handleTipShown = (tipId: string) => {
    setShownTipIds(prev => new Set([...prev, tipId]));
    setNewTips(prev => prev.filter(tip => tip.id !== tipId));
  };

  // Set up realtime subscription for chat messages
  React.useEffect(() => {
    // WebSocket handles real-time chat now
  }, [streamId]);

  // Handle stream tracking and elapsed time calculation
  React.useEffect(() => {
    if (!streamData?.started_at || !streamData?.id) return;
    
    // Start tracking this stream in local storage
    const livepeerPlaybackId = streamData.playback_url?.split('/').pop();
    startStreamTracking(streamData.id, livepeerPlaybackId);
    
    const startTime = new Date(streamData.started_at);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => {
      clearInterval(interval);
      if (streamData.id) {
        stopStreamTracking(streamData.id);
      }
    };
  }, [streamData?.started_at, streamData?.id, streamData?.playback_url]);

  // Update stream status based on Livepeer connection
  React.useEffect(() => {
    if (streamData?.id) {
      updateStreamStatus(streamData.id, livepeerIsLive);
    }
  }, [streamData?.id, livepeerIsLive]);

  const handleSendMessage = () => {
    if (!identity?.id || !newMessage.trim()) {
      toast.error('Please connect your wallet to chat');
      return;
    }

    // Check for bad words
    if (containsBadWords(newMessage.trim())) {
      toast.error('Your message contains inappropriate language');
      return;
    }

    const user = {
      id: identity.id,
      name: currentUserProfile?.display_name || currentUserProfile?.handle || `User ${identity.id.slice(0, 8)}`,
      avatar: currentUserProfile?.avatar_url
    };

    sendChat(newMessage.trim(), user);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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

  // Video control handlers
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleFullscreen = () => {
    if (!playerContainerRef.current) return;
    
    if (!isFullscreen) {
      if (playerContainerRef.current.requestFullscreen) {
        playerContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    if (newVolume > 0) setIsMuted(false);
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };

  // Handle video events for control state sync and auto-unmute
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    // Auto-unmute and set proper volume when video can play
    const handleCanPlay = () => {
      video.muted = false;
      video.volume = volume;
      setIsMuted(false);
      // Try to play the video
      video.play().catch(() => {
        // If autoplay fails, that's fine - user will need to interact
        console.log('Autoplay prevented by browser');
      });
    };

    // Also try to unmute on any user interaction
    const handleClick = () => {
      if (video.muted) {
        video.muted = false;
        video.volume = volume;
        setIsMuted(false);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('click', handleClick);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('click', handleClick);
    };
  }, [volume]);

  // Handle fullscreen changes
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Hide controls after inactivity
  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const resetTimeout = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    const handleMouseMove = () => resetTimeout();
    const handleMouseLeave = () => {
      clearTimeout(timeout);
      setShowControls(false);
    };

    if (playerContainerRef.current) {
      playerContainerRef.current.addEventListener('mousemove', handleMouseMove);
      playerContainerRef.current.addEventListener('mouseleave', handleMouseLeave);
      resetTimeout();
    }

    return () => {
      clearTimeout(timeout);
      if (playerContainerRef.current) {
        playerContainerRef.current.removeEventListener('mousemove', handleMouseMove);
        playerContainerRef.current.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  // Current user profile for display
  const profile = React.useMemo(() => {
    // Moved this logic into handleSendMessage
    return null;
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
          <div 
            ref={playerContainerRef}
            className="relative rounded-xl overflow-hidden border-2 border-transparent bg-gradient-to-r from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 p-1"
          >
            <div className="relative rounded-lg overflow-hidden bg-black">
              {streamData.playback_url && livepeerIsLive ? (
                <>
                  <HlsPlayer 
                    src={streamData.playback_url} 
                    autoPlay 
                    isLiveStream={livepeerIsLive}
                    key={streamData.id}
                    className="w-full h-full"
                    videoRef={videoRef}
                  />
                  {showControls && (
                    <CustomVideoControls
                      isPlaying={isPlaying}
                      onPlayPause={handlePlayPause}
                      onFullscreen={handleFullscreen}
                      onCreateClip={() => setClipModalOpen(true)}
                      volume={volume}
                      onVolumeChange={handleVolumeChange}
                      isMuted={isMuted}
                      onToggleMute={handleToggleMute}
                      elapsed={elapsed}
                      viewers={viewerCount}
                      isLive={livepeerIsLive}
                      showClipping={true}
                    />
                  )}
                </>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="text-2xl font-bold bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
                      {!streamConnected ? 'Connecting...' : 'Stream Ended'}
                    </div>
                    <div className="text-gray-400">
                      {!streamConnected ? 'Establishing connection to stream...' : 'Thanks for watching! Stream is no longer live.'}
                    </div>
                    {!livepeerIsLive && streamConnected && (
                      <Button 
                        onClick={() => navigate('/app')}
                        variant="hero"
                        className="mt-4"
                      >
                        Browse Other Streams
                      </Button>
                    )}
                  </div>
                </div>
              )}
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
                    {livepeerIsLive && streamConnected && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white font-medium">
                        LIVE
                      </span>
                    )}
                    {!streamConnected && (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-500 text-black font-medium">
                        CONNECTING
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
                  disabled={!identity?.id || !streamerKaspaAddress || !livepeerIsLive}
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
          <ChatPanel
            messages={chatMessages}
            canPost={!!identity?.id}
            onRequireLogin={onRequireLogin}
            newMessage={newMessage}
            onMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
          />
          {!chatConnected && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Connecting to chat...
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
            {streamerProfile && (
              <ProfileModal
                open={profileOpen}
                onOpenChange={setProfileOpen}
                profile={{
                  id: streamerProfile.id,
                  handle: streamerProfile.handle || 'streamer',
                  displayName: streamerProfile.display_name || streamerProfile.handle || 'Streamer',
                  bio: streamerProfile.bio || '',
                  followers: streamerProfile.follower_count || 0,
                  following: streamerProfile.following_count || 0,
                  tags: [],
                  avatar: streamerProfile.avatar_url || ''
                }}
                isLoggedIn={!!identity?.id}
                onRequireLogin={() => toast.error('Please connect your wallet to continue')}
              />
            )}
      
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
      {livepeerIsLive && streamData?.playback_url && (
        <LivepeerClipCreator
          open={clipModalOpen}
          onOpenChange={setClipModalOpen}
          livepeerPlaybackId={streamData.playback_url.match(/\/hls\/([^\/]+)\//)?.[1] || ''}
          streamTitle={streamData.title}
        />
      )}
    </main>
  );
};

export default Watch;