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
import { useWallet } from "@/context/WalletContext";
import { toast } from "sonner";

const Stream = () => {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { identity } = useWallet();
  const kaspaAddress = identity?.id; // The kaspa address from wallet identity
  const [elapsed, setElapsed] = React.useState(0);
  const [tipOpen, setTipOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);

  // Get current user profile
  const { data: profile } = useQuery({
    queryKey: ['profile', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase.rpc('get_public_profile', { _id: identity.id });
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

  // Fetch streamer profile
  const { data: streamerProfile } = useQuery({
    queryKey: ['streamer-profile', streamData?.user_id],
    queryFn: async () => {
      if (!streamData?.user_id) return null;
      const { data } = await supabase.rpc('get_public_profile', { _id: streamData.user_id });
      return data?.[0] || null;
    },
    enabled: !!streamData?.user_id
  });

  // Get streamer's Kaspa address for tipping
  const { data: streamerKaspaAddress } = useQuery({
    queryKey: ['kaspa-address', streamData?.user_id],
    queryFn: async () => {
      if (!streamData?.user_id || !identity?.id) return null;
      const { data } = await supabase.rpc('get_kaspa_address', { _id: streamData.user_id });
      return data;
    },
    enabled: !!streamData?.user_id && !!identity?.id
  });

  // Use localStorage as fallback for current user's own stream
  const localStreamData = React.useMemo(() => ({
    ingestUrl: localStorage.getItem('currentIngestUrl'),
    streamKey: localStorage.getItem('currentStreamKey'),
    playbackUrl: localStorage.getItem('currentPlaybackUrl'),
    startTime: localStorage.getItem('streamStartTime') ? new Date(localStorage.getItem('streamStartTime')!) : new Date()
  }), []);

  const displayStreamData = streamData || {
    title: "Live Stream",
    category: "IRL",
    playback_url: localStreamData.playbackUrl,
    started_at: localStreamData.startTime.toISOString()
  };

  const isOwnStream = streamData?.user_id === identity?.id;

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
      // Update stream in Supabase
      if (streamData?.id) {
        await supabase
          .from('streams')
          .update({ is_live: false })
          .eq('id', streamData.id);
      }
      
      // Clear local storage
      localStorage.removeItem('currentIngestUrl');
      localStorage.removeItem('currentStreamKey');
      localStorage.removeItem('currentPlaybackUrl');
      localStorage.removeItem('streamStartTime');
      localStorage.removeItem('currentStreamId');
      
      toast.success('Stream ended');
      navigate('/go-live');
    } catch (error) {
      console.error('Failed to end stream:', error);
      toast.error('Failed to end stream');
    }
  };

  const formatTime = (seconds: number) => {
    return new Date(seconds * 1000).toISOString().substring(11, 19);
  };

  const playbackUrl = displayStreamData.playback_url || localStreamData.playbackUrl;
  if (!playbackUrl) {
    return null; // Will redirect in useEffect
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="sr-only">Live Stream</h1>
      
      <section className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          {playbackUrl ? (
            <HlsPlayer src={playbackUrl} autoPlay isLiveStream />
          ) : (
            <PlayerPlaceholder />
          )}
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white">LIVE</span>
            <span>Elapsed: {formatTime(elapsed)}</span>
            <span className="ml-auto">Viewers: {'viewers' in displayStreamData ? displayStreamData.viewers : 0}</span>
            {isOwnStream && (
              <Button variant="destructive" size="sm" onClick={handleEndStream}>
                End Stream
              </Button>
            )}
          </div>
          
          {isOwnStream && (
            <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md text-sm">
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
        </div>
        
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-border p-3 bg-card/60 backdrop-blur-md">
            <div className="font-medium">Streamer</div>
            <div className="flex items-center gap-3 mt-2">
              <Avatar className="size-10">
                <AvatarImage src={streamerProfile?.avatar_url || undefined} alt="Streamer avatar" />
                <AvatarFallback>
                  {(streamerProfile?.display_name || streamerProfile?.handle || 'S').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div>{streamerProfile?.display_name || streamerProfile?.handle || 'Streamer'}</div>
                <button 
                  className="text-xs text-muted-foreground hover:text-foreground story-link" 
                  onClick={() => setProfileOpen(true)}
                >
                  @{streamerProfile?.handle || (streamerProfile?.display_name ? streamerProfile.display_name.toLowerCase().replace(/\s+/g, '_') : 'streamer')}
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
      />
    </main>
  );
};

export default Stream;