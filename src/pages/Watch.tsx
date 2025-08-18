import React from "react";
import { Helmet } from "react-helmet-async";
import HlsPlayer from "@/components/players/HlsPlayer";
import PlayerPlaceholder from "@/components/streams/PlayerPlaceholder";
import ChatPanel, { ChatMessage } from "@/components/streams/ChatPanel";
import TipModal from "@/components/modals/TipModal";
import ProfileModal from "@/components/modals/ProfileModal";
import TipDisplay from "@/components/TipDisplay";
import { Button } from "@/components/ui/button";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Volume2, Play, Settings, Heart } from "lucide-react";
import { StreamCard } from "@/components/streams/StreamCard";
import { useWallet } from "@/context/WalletContext";
import { useTipMonitoring } from "@/hooks/useTipMonitoring";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const Watch: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tipOpen, setTipOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [isLiked, setIsLiked] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [newTips, setNewTips] = React.useState<any[]>([]);
  const [shownTipIds, setShownTipIds] = React.useState<Set<string>>(new Set());

  const { identity } = useWallet();
  const isLoggedIn = !!identity;

  const onRequireLogin = () => {
    if (!isLoggedIn) {
      toast.error('Please connect your wallet to continue');
    }
  };

  // Fetch stream data from database
  const { data: streamData, isLoading } = useQuery({
    queryKey: ['stream', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data: stream, error } = await supabase
        .from('streams')
        .select(`
          *,
          profiles (
            handle,
            display_name,
            avatar_url,
            bio
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching stream:', error);
        return null;
      }
      
      return stream;
    },
    enabled: !!id,
    refetchInterval: 5000 // Refresh every 5 seconds to update viewer count
  });

  // Fetch chat messages for this stream
  // Get streamer's Kaspa address for tipping via secure RPC
  const { data: kaspaAddress } = useQuery({
    queryKey: ['kaspaAddress', streamData?.id],
    queryFn: async () => {
      if (!streamData?.id) return null;
      const { data, error } = await supabase.rpc('get_stream_tip_address', { _stream_id: streamData.id });
      if (error) {
        console.error('Kaspa address fetch error:', error);
        return null;
      }
      return data as string | null;
    },
    enabled: !!streamData?.id
  });

  const { data: chatData = [] } = useQuery({
    queryKey: ['chat-messages', id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          message,
          created_at,
          profiles (
            handle,
            display_name
          )
        `)
        .eq('stream_id', id)
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (error) {
        console.error('Error fetching chat messages:', error);
        return [];
      }
      
      return data.map(msg => ({
        id: msg.id,
        user: (msg.profiles as any)?.handle || (msg.profiles as any)?.display_name || 'Anonymous',
        text: msg.message,
        time: new Date(msg.created_at).toLocaleTimeString()
      }));
    },
    enabled: !!id,
    refetchInterval: 2000 // Refresh chat every 2 seconds
  });

  // Fetch suggested streams from database
  const { data: suggestedStreams = [] } = useQuery({
    queryKey: ['suggested-streams', id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          category,
          is_live,
          viewers,
          user_id,
          thumbnail_url,
          created_at,
          profiles (
            handle,
            display_name,
            avatar_url
          )
        `)
        .neq('id', id)
        .eq('is_live', true)
        .limit(6)
        .order('viewers', { ascending: false });
      
      if (error) {
        console.error('Error fetching suggested streams:', error);
        return [];
      }
      
      return data.map(stream => ({
        id: stream.id,
        title: stream.title,
        category: stream.category,
        live: stream.is_live,
        viewers: stream.viewers,
        username: (stream.profiles as any)?.handle || 'unknown',
        userId: stream.user_id,
        thumbnail: stream.thumbnail_url,
        startedAt: stream.created_at
      }));
    },
    enabled: !!id
  });

  // Set up realtime subscription for chat messages
  React.useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `stream_id=eq.${id}`
        },
        async (payload) => {
          console.log('New chat message:', payload);
          
          // Fetch the profile for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('handle, display_name')
            .eq('id', payload.new.user_id)
            .single();
          
          const newMsg: ChatMessage = {
            id: payload.new.id,
            user: profile?.handle || profile?.display_name || 'Anonymous',
            text: payload.new.message,
            time: new Date(payload.new.created_at).toLocaleTimeString()
          };
          
          setChatMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Update chat messages when data changes
  React.useEffect(() => {
    setChatMessages(chatData);
  }, [chatData]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isLoggedIn || !id) return;
    
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          stream_id: id,
          user_id: identity?.id,
          message: newMessage.trim()
        });
      
      if (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to send message');
        return;
      }
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleFollow = () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }
    setIsFollowing(!isFollowing);
    toast.success(isFollowing ? 'Unfollowed' : 'Followed!');
  };

  const handleLike = () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }
    setIsLiked(!isLiked);
    toast.success('Liked!');
  };

  // Compute profile data (before any early returns to avoid undefined variables)
  const profile = streamData?.profiles as any;
  const computedProfile = profile
    ? {
        id: profile.id || streamData?.user_id,
        handle: profile.handle || 'creator',
        displayName: profile.display_name || profile.handle || 'Creator',
        bio: profile.bio || '',
        followers: 0,
        following: 0,
        tags: [] as string[],
      }
    : undefined;
  const username = profile?.handle || profile?.display_name || 'creator';
  
  // Debug logging for tip address
  React.useEffect(() => {
    if (streamData) {
      console.log('Stream data:', streamData);
      console.log('Profile data:', profile);
      console.log('Streamer Kaspa address for tips:', kaspaAddress);
    }
  }, [streamData, profile, kaspaAddress]);

  // Monitor tips for this stream
  const { tips: allTips } = useTipMonitoring({
    streamId: streamData?.id,
    kaspaAddress: (kaspaAddress || undefined),
    streamStartBlockTime: streamData?.treasury_block_time,
    onNewTip: (tip) => {
      if (!shownTipIds.has(tip.id)) {
        setNewTips(prev => [...prev, tip]);
      }
    }
  });

  const handleTipShown = (tipId: string) => {
    setShownTipIds(prev => new Set([...prev, tipId]));
    setNewTips(prev => prev.filter(tip => tip.id !== tipId));
  };

  // Loading state
  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">Loading stream...</div>
      </main>
    );
  }

  // Stream not found state
  if (!streamData) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">Stream not found or ended</div>
          <Button onClick={() => navigate('/app')} className="mt-4">Back to App</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>{streamData?.title || 'Stream'} — Watch on Vivoor</title>
        <meta name="description" content={`Watch ${streamData?.title || 'stream'} by @${username} on Vivoor.`} />
        <link rel="canonical" href={`/watch/${streamData?.id || id}`} />
      </Helmet>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          {/* Video Player */}
          {streamData?.playback_url ? (
            <HlsPlayer 
              src={streamData.playback_url} 
              autoPlay 
              controls 
              isLiveStream={streamData.is_live}
            />
          ) : (
            <PlayerPlaceholder />
          )}
          <div className="mt-3 flex items-center gap-2">
            <Button variant="glass" size="sm" aria-label="Play/Pause"><Play /></Button>
            <Button variant="glass" size="sm" aria-label="Mute"><Volume2 /></Button>
            <Button variant="glass" size="sm" aria-label="Settings"><Settings /></Button>
            <div className="ml-auto flex items-center gap-2">
              <Button 
                variant="glass" 
                size="sm" 
                onClick={handleLike}
                className={isLiked ? "text-red-500" : ""}
                aria-label="Like stream"
              >
                <Heart className={isLiked ? "fill-current" : ""} />
              </Button>
              <Button variant="gradientOutline" size="sm" onClick={() => setTipOpen(true)}>
                Tip in KAS
              </Button>
              <Button 
                variant={isFollowing ? "secondary" : "hero"} 
                size="sm" 
                onClick={handleFollow}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md">
            <div className="text-sm text-muted-foreground">
              {streamData?.category} • {streamData?.viewers ?? 0} viewers
              {streamData?.is_live && <span className="ml-2 inline-flex items-center gap-1 text-red-500">
                <span className="size-2 bg-red-500 rounded-full animate-pulse"></span>
                LIVE
              </span>}
            </div>
            <div className="font-medium">{streamData?.title}</div>
            <button className="story-link text-sm text-muted-foreground hover:text-foreground" onClick={() => setProfileOpen(true)}>
              @{username}
            </button>
          </div>

          <div className="mt-6">
            <div className="mb-2 font-medium">Suggested streams</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestedStreams.map((s) => (
                <StreamCard key={s.id} stream={s} isLoggedIn={isLoggedIn} onOpenProfile={()=>setProfileOpen(true)} onRequireLogin={onRequireLogin} />
              ))}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="lg:col-span-1 h-full">
          <ChatPanel 
            messages={chatMessages} 
            canPost={isLoggedIn} 
            onRequireLogin={onRequireLogin}
            newMessage={newMessage}
            onMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>

      {/* Modals */}
      <TipModal 
        open={tipOpen} 
        onOpenChange={setTipOpen} 
        isLoggedIn={isLoggedIn} 
        onRequireLogin={onRequireLogin} 
        toAddress={kaspaAddress || undefined}
        senderHandle={profile?.handle || identity?.id?.slice(0, 8)} 
      />
      {computedProfile && (
        <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} profile={computedProfile} isLoggedIn={isLoggedIn} onRequireLogin={onRequireLogin} onGoToChannel={() => navigate(`/watch/${streamData?.id || id}`)} />
      )}
      
      {/* Tip notifications overlay */}
      <TipDisplay newTips={newTips} onTipShown={handleTipShown} />
    </main>
  );
};


  // Viewer-side auto-end enforcement (in case streamer disconnects)
  React.useEffect(() => {
    let timer: any;
    const check = async () => {
      try {
        if (streamData?.id) {
          await supabase.rpc('stream_auto_end', { _stream_id: streamData.id, _threshold_seconds: 60 });
        }
      } catch (e) {
        console.warn('Auto-end check failed', e);
      }
    };
    if (streamData?.id && streamData?.is_live) {
      timer = setInterval(check, 30000);
    }
    return () => timer && clearInterval(timer);
  }, [streamData?.id, streamData?.is_live]);
export default Watch;