import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import HlsPlayer from "@/components/players/HlsPlayer";
import PlayerPlaceholder from "@/components/streams/PlayerPlaceholder";
import BrowserStreaming from "@/components/streaming/BrowserStreaming";
import TipModal from "@/components/modals/TipModal";
import ProfileModal from "@/components/modals/ProfileModal";
import DonationsHistoryModal from "@/components/modals/DonationsHistoryModal";
import TipDisplay from "@/components/TipDisplay";
import { useWallet } from "@/context/WalletContext";
import { useTipMonitoring } from "@/hooks/useTipMonitoring";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";

const Stream = () => {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { identity } = useWallet();
  const kaspaAddress = identity?.address; // The kaspa wallet address from wallet identity
  const [elapsed, setElapsed] = React.useState(0);
  const [isAuthorized, setIsAuthorized] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const [tipOpen, setTipOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [donationsHistoryOpen, setDonationsHistoryOpen] = React.useState(false);
  const [newTips, setNewTips] = React.useState<any[]>([]);
  const [shownTipIds, setShownTipIds] = React.useState<Set<string>>(new Set());

  // Get current user profile using secure function
  const { data: profile } = useQuery({
    queryKey: ['profile', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase.rpc('get_public_profile_display', { user_id: identity.id });
      return data?.[0] || null;
    },
    enabled: !!identity?.id
  });

  // Fetch stream data from Supabase
  const { data: streamData } = useQuery({
    queryKey: ['stream', streamId],
    queryFn: async () => {
      if (!streamId) return null;
      const { data } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single();
      return data;
    },
    enabled: !!streamId
  });

  // Fetch streamer profile using secure function
  const { data: streamerProfile } = useQuery({
    queryKey: ['streamer-profile', streamData?.user_id],
    queryFn: async () => {
      if (!streamData?.user_id) return null;
      const { data } = await supabase.rpc('get_public_profile_display', { 
        user_id: streamData.user_id 
      });
      return data?.[0] || null;
    },
    enabled: !!streamData?.user_id
  });

  // Get streamer's Kaspa address for tipping using secure function
  const { data: streamerKaspaAddress } = useQuery({
    queryKey: ['tip-address', streamData?.id],
    queryFn: async () => {
      if (!streamData?.id || !identity?.id) return null;
      const { data } = await supabase.rpc('get_tip_address', { stream_id: streamData.id });
      return data;
    },
    enabled: !!streamData?.id && !!identity?.id
  });

  // Use localStorage as fallback for current user's own stream
  const localStreamData = React.useMemo(() => ({
    ingestUrl: localStorage.getItem('currentIngestUrl'),
    streamKey: localStorage.getItem('currentStreamKey'),
    playbackUrl: localStorage.getItem('currentPlaybackUrl'),
    streamingMode: localStorage.getItem('currentStreamingMode') as 'rtmp' | 'browser' | null,
    livepeerPlaybackId: localStorage.getItem('currentLivepeerPlaybackId'),
    startTime: localStorage.getItem('streamStartTime') ? new Date(localStorage.getItem('streamStartTime')!) : new Date()
  }), []);

  const displayStreamData = streamData || {
    title: "Live Stream",
    category: "IRL",
    playback_url: localStreamData.playbackUrl,
    streaming_mode: localStreamData.streamingMode,
    livepeer_playback_id: localStreamData.livepeerPlaybackId,
    started_at: localStreamData.startTime.toISOString()
  };

  // Get streaming mode with proper fallback
  const streamingMode = (streamData as any)?.streaming_mode || localStreamData.streamingMode || 'rtmp';

  const isOwnStream = streamData?.user_id === identity?.id;

  // Store donations in localStorage
  const DONATIONS_STORAGE_KEY = `stream_donations_${streamData?.id}`;
  const [allStoredDonations, setAllStoredDonations] = React.useState<any[]>(() => {
    if (!streamData?.id) return [];
    try {
      const stored = localStorage.getItem(DONATIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Monitor tips for this stream (only if it's own stream)
  const { tips: allTips, totalAmountReceived } = useTipMonitoring({
    streamId: streamData?.id,
    kaspaAddress: kaspaAddress, // Use the actual wallet address, not user ID
    streamStartBlockTime: streamData?.treasury_block_time,
    onNewTip: (tip) => {
      if (!shownTipIds.has(tip.id)) {
        setNewTips(prev => [...prev, tip]);
        toast.success(`New tip: ${tip.amount} KAS from ${tip.sender}`);
        
        // Store in localStorage for donations history
        const donation = {
          id: tip.id,
          sender: tip.sender,
          senderAvatar: undefined,
          amount: tip.amount,
          message: tip.message,
          timestamp: tip.timestamp
        };
        
        setAllStoredDonations(prev => {
          const updated = [...prev, donation];
          try {
            localStorage.setItem(DONATIONS_STORAGE_KEY, JSON.stringify(updated));
          } catch (e) {
            console.warn('Failed to save donation to localStorage:', e);
          }
          return updated;
        });
      }
    }
  });

  const handleTipShown = (tipId: string) => {
    setShownTipIds(prev => new Set([...prev, tipId]));
    setNewTips(prev => prev.filter(tip => tip.id !== tipId));
  };

  React.useEffect(() => {
    const checkAuth = async () => {
      if (!streamId) return;
      
      // Check if user owns this stream by checking the streams table
      const { data: stream } = await supabase
        .from('streams')
        .select('user_id')
        .eq('id', streamId)
        .single();
      
      // Only allow access if user owns this stream OR if stream doesn't exist check localStorage
      if (!stream) {
        // If no stream in DB, check if it's in localStorage (just created)
        const localStreamId = localStorage.getItem('currentStreamId');
        if (localStreamId !== streamId) {
          navigate('/app');
          return;
        }
      } else if (stream.user_id !== identity?.id) {
        navigate('/app');
        return;
      }
      
      setIsAuthorized(true);
    };
    
    checkAuth();
  }, [streamId, navigate, identity?.id]);

  // Auto-end stream after 1 minute of disconnection and heartbeat monitoring
  React.useEffect(() => {
    if (!streamData?.id || !isOwnStream) return;

    // Skip heartbeat for browser streams - they use update_browser_stream_heartbeat via BrowserStreaming component
    if (streamData.stream_type === 'browser') {
      return;
    }

    let heartbeatInterval: number;
    let disconnectTimer: number;
    let lastHeartbeat = Date.now();

    const sendHeartbeat = async () => {
      try {
        await supabase.rpc('update_stream_heartbeat', { stream_id: streamData.id });
        lastHeartbeat = Date.now();
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Failed to send heartbeat:', error);
        setConnectionStatus('disconnected');
      }
    };

    const checkAndEndStream = async () => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
      
      if (timeSinceLastHeartbeat > 60000) { // 1 minute
        console.log('Auto-ending stream due to 1 minute disconnection');
        
        try {
          await supabase.rpc('auto_end_disconnected_streams', { timeout_minutes: 1 });
          
          // Clear local storage
          localStorage.removeItem('currentIngestUrl');
          localStorage.removeItem('currentStreamKey');
          localStorage.removeItem('currentPlaybackUrl');
          localStorage.removeItem('streamStartTime');
          localStorage.removeItem('currentStreamId');
          
          toast.error('Stream ended due to 1 minute disconnection');
          navigate('/app');
        } catch (error) {
          console.error('Failed to auto-end stream:', error);
        }
      }
    };

    // Send heartbeat every 30 seconds
    sendHeartbeat(); // Initial heartbeat
    heartbeatInterval = window.setInterval(sendHeartbeat, 30000);
    
    // Check for disconnection every 30 seconds
    disconnectTimer = window.setInterval(checkAndEndStream, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(disconnectTimer);
    };
  }, [streamData?.id, isOwnStream, navigate]);

  React.useEffect(() => {
    const playbackUrl = displayStreamData.playback_url || localStreamData.playbackUrl;
    if (!playbackUrl) {
      toast.error('Stream not found');
      navigate('/go-live');
      return;
    }

    const startTime = displayStreamData.started_at ? new Date(displayStreamData.started_at) : localStreamData.startTime;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [displayStreamData, localStreamData, navigate]);

  const handleEndStream = async () => {
    try {
      console.log('Manually ending stream');
      
      // Update stream in Supabase
      if (streamData?.id) {
        const { error } = await supabase
          .from('streams')
          .update({ 
            is_live: false,
            ended_at: new Date().toISOString()
          })
          .eq('id', streamData.id);
          
        if (error) {
          console.error('Error updating stream in database:', error);
          throw new Error(`Failed to end stream: ${error.message}`);
        }
      }
      
      // Clear local storage
      localStorage.removeItem('currentIngestUrl');
      localStorage.removeItem('currentStreamKey');
      localStorage.removeItem('currentPlaybackUrl');
      localStorage.removeItem('streamStartTime');
      localStorage.removeItem('currentStreamId');
      localStorage.removeItem('currentStreamingMode');
      localStorage.removeItem('currentLivepeerPlaybackId');
      
      toast.success('Stream ended successfully');
      navigate('/app');
    } catch (error) {
      console.error('Failed to end stream:', error);
      toast.error(`Failed to end stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatTime = (seconds: number) => {
    return new Date(seconds * 1000).toISOString().substring(11, 19);
  };

  const playbackUrl = displayStreamData.playback_url || localStreamData.playbackUrl;
  
  if (!streamId || !isAuthorized) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">
            {!streamId ? 'Stream not found' : 'Checking authorization...'}
          </div>
          {!streamId && (
            <Button onClick={() => navigate('/app')} className="mt-4">Back to App</Button>
          )}
        </div>
      </main>
    );
  }
  
  if (!playbackUrl) {
    return null; // Will redirect in useEffect
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="sr-only">Live Stream</h1>
      
      <section className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <div className="relative">
            {/* Stream content - Always use HLS for playback, even for browser streams */}
            {playbackUrl ? (
              <HlsPlayer src={playbackUrl} autoPlay isLiveStream />
            ) : (
              <PlayerPlaceholder />
            )}
            
            {/* Tip notifications overlay positioned over the video player */}
            <TipDisplay newTips={newTips} onTipShown={handleTipShown} userJoinedAt={new Date()} />
          </div>
          
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white">LIVE</span>
            <span>Elapsed: {formatTime(elapsed)}</span>
            <span className="ml-auto">Viewers: {'viewers' in displayStreamData ? displayStreamData.viewers : 0}</span>
            {isOwnStream && totalAmountReceived > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-green-500 text-white">
                Tips: {totalAmountReceived} KAS
              </span>
            )}
            {isOwnStream && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDonationsHistoryOpen(true)}
                  className="border border-white/10 hover:border-primary/50 hover:bg-primary/10"
                >
                  <DollarSign className="size-4" />
                </Button>
                <Button variant="destructive" size="sm" onClick={handleEndStream}>
                  End Stream
                </Button>
              </>
            )}
          </div>
          
          {/* Show RTMP details only for RTMP streams */}
          {isOwnStream && streamingMode === 'rtmp' && (
            <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md text-sm">
              <div className="font-medium mb-3">RTMP Streaming Details</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground font-medium">Ingest URL:</span>
                <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">
                  {localStreamData.ingestUrl ?? '—'}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => localStreamData.ingestUrl && navigator.clipboard.writeText(localStreamData.ingestUrl).then(() => toast.success('Copied ingest URL'))}
                >
                  Copy
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-muted-foreground font-medium">Stream Key:</span>
                <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">
                  {localStreamData.streamKey ? '••••••••••' : '—'}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => localStreamData.streamKey && navigator.clipboard.writeText(localStreamData.streamKey).then(() => toast.success('Copied stream key'))}
                >
                  Copy
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Use these in OBS or Streamlabs. Playback is linked automatically.
              </div>

              <div className="mt-4 grid gap-2">
                <div className="font-medium">OBS setup</div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  <li>Settings → Stream → Service: Custom...</li>
                  <li>Server: paste the Ingest URL</li>
                  <li>Stream Key: paste the Stream Key</li>
                  <li>Output → Encoder: x264 or NVENC H.264, Bitrate: 3500–6000 Kbps (1080p60), 8000–12000 Kbps (1440p60), 15000–25000 Kbps (2160p60), Keyframe Interval: 2s</li>
                  <li>Video → Base/Output: 3840x2160, 2560x1440, 1920x1080, or 1280x720, FPS: 30 or 60</li>
                </ul>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground font-medium">Preview URL:</span>
                <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">
                  {playbackUrl ?? '—'}
                </code>
                {playbackUrl && (
                  <a 
                    className="text-xs underline" 
                    href={playbackUrl} 
                    target="_blank" 
                    rel="noreferrer"
                  >
                    Open
                  </a>
                )}
              </div>
            </div>
          )}
          
          {/* Show streaming mode info for browser streams */}
          {isOwnStream && streamingMode === 'browser' && (
            <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md text-sm">
              <div className="font-medium mb-2">Browser Streaming Active</div>
              <p className="text-xs text-muted-foreground">
                You're streaming directly from your browser using your camera and microphone. 
                Use the controls above to manage your stream.
              </p>
            </div>
          )}
        </div>
        
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-border p-3 bg-card/60 backdrop-blur-md">
            <div className="font-medium">Streamer</div>
            <div className="flex items-center gap-3 mt-2">
              <Avatar className="size-10">
                <AvatarImage src={streamerProfile?.avatar_url || undefined} alt="Streamer avatar" />
                <AvatarFallback>
                  {/* Use display_name, handle, or username as fallback */}
                  {(streamerProfile?.display_name || streamerProfile?.handle || 'S').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                {/* Display the name */}
                <div>{streamerProfile?.display_name || streamerProfile?.handle || 'Streamer'}</div>
                <button 
                  className="text-xs text-muted-foreground hover:text-foreground story-link" 
                  onClick={() => setProfileOpen(true)}
                >
                  @{streamerProfile?.handle || 'streamer'}
                </button>
              </div>
            </div>
            
            <div className="mt-3 space-y-2">
              <h3 className="font-medium">{displayStreamData.title}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{displayStreamData.category}</span>
            </div>
            
            {!isOwnStream && (
              <div className="mt-3">
                <Button 
                  variant="secondary" 
                  onClick={() => setTipOpen(true)} 
                  disabled={!identity?.id || !streamerKaspaAddress}
                >
                  Tip in KAS
                </Button>
              </div>
            )}
          </div>
          
          <div className="rounded-xl border border-border p-3 bg-card/60 backdrop-blur-md">
            <div className="font-medium">Stream Health</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-background border border-border">Excellent</span>
              <span className="px-2 py-1 rounded-full bg-background border border-border">Low latency</span>
              <span className="px-2 py-1 rounded-full bg-background border border-border">Stable</span>
            </div>
          </div>
        </div>
      </section>

      <ProfileModal 
        open={profileOpen} 
        onOpenChange={setProfileOpen} 
        profile={streamerProfile ? {
          id: streamerProfile.id,
          displayName: streamerProfile.display_name || streamerProfile.handle || 'Streamer',
          handle: streamerProfile.handle || (streamerProfile.display_name || 'streamer').toLowerCase().replace(/\s+/g, '_'),
          bio: streamerProfile.bio || '',
          followers: 0,
          following: 0,
          tags: []
        } : undefined}
        isLoggedIn={!!identity}
        onRequireLogin={() => {}}
        onGoToChannel={() => {}}
      />
      
      <TipModal 
        open={tipOpen} 
        onOpenChange={setTipOpen} 
        isLoggedIn={!!identity} 
        onRequireLogin={() => {}} 
        toAddress={streamerKaspaAddress}
        senderHandle={profile?.handle || identity?.id?.slice(0, 8)} 
      />

      {/* Donations History Modal */}
      <DonationsHistoryModal
        open={donationsHistoryOpen}
        onOpenChange={setDonationsHistoryOpen}
        donations={allStoredDonations}
      />
      
    </main>
  );
};

export default Stream;
