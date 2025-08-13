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

  // Mock stream data - in real app, fetch from database
  const streamData = React.useMemo(() => ({
    title: "Live Stream",
    category: "IRL",
    ingestUrl: localStorage.getItem('currentIngestUrl'),
    streamKey: localStorage.getItem('currentStreamKey'),
    playbackUrl: localStorage.getItem('currentPlaybackUrl'),
    startTime: localStorage.getItem('streamStartTime') ? new Date(localStorage.getItem('streamStartTime')!) : new Date()
  }), []);

  React.useEffect(() => {
    if (!streamData.playbackUrl) {
      toast.error('Stream not found');
      navigate('/go-live');
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - streamData.startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [streamData, navigate]);

  const handleEndStream = () => {
    // Clear stream data
    localStorage.removeItem('currentIngestUrl');
    localStorage.removeItem('currentStreamKey');
    localStorage.removeItem('currentPlaybackUrl');
    localStorage.removeItem('streamStartTime');
    localStorage.removeItem('currentStreamId');
    
    toast.success('Stream ended');
    navigate('/go-live');
  };

  const formatTime = (seconds: number) => {
    return new Date(seconds * 1000).toISOString().substring(11, 19);
  };

  if (!streamData.playbackUrl) {
    return null; // Will redirect in useEffect
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="sr-only">Live Stream</h1>
      
      <section className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          {streamData.playbackUrl ? (
            <HlsPlayer src={streamData.playbackUrl} autoPlay isLiveStream />
          ) : (
            <PlayerPlaceholder />
          )}
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white">LIVE</span>
            <span>Elapsed: {formatTime(elapsed)}</span>
            <span className="ml-auto">Viewers: 0 (mock)</span>
            <Button variant="destructive" size="sm" onClick={handleEndStream}>
              End Stream
            </Button>
          </div>
          
          <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground font-medium">Ingest URL:</span>
              <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">
                {streamData.ingestUrl ?? '—'}
              </code>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => streamData.ingestUrl && navigator.clipboard.writeText(streamData.ingestUrl).then(() => toast.success('Copied ingest URL'))}
              >
                Copy
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-muted-foreground font-medium">Stream Key:</span>
              <code className="px-2 py-1 rounded bg-muted/40 border border-border max-w-full truncate">
                {streamData.streamKey ? '••••••••••' : '—'}
              </code>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => streamData.streamKey && navigator.clipboard.writeText(streamData.streamKey).then(() => toast.success('Copied stream key'))}
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
                {streamData.playbackUrl ?? '—'}
              </code>
              {streamData.playbackUrl && (
                <a 
                  className="text-xs underline" 
                  href={streamData.playbackUrl} 
                  target="_blank" 
                  rel="noreferrer"
                >
                  Open
                </a>
              )}
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-border p-3 bg-card/60 backdrop-blur-md">
            <div className="font-medium">Profile</div>
            <div className="flex items-center gap-3 mt-2">
              <Avatar className="size-10">
                <AvatarImage src={profile?.avatar_url || undefined} alt="Profile avatar" />
                <AvatarFallback>
                  {(profile?.display_name || profile?.handle || 'U').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div>{profile?.display_name || profile?.handle || 'Creator'}</div>
                <button 
                  className="text-xs text-muted-foreground hover:text-foreground story-link" 
                  onClick={() => setProfileOpen(true)}
                >
                  @{profile?.handle || (profile?.display_name ? profile.display_name.toLowerCase().replace(/\s+/g, '_') : 'you')}
                </button>
              </div>
            </div>
            
            <div className="mt-3">
              <Button 
                variant="secondary" 
                onClick={() => setTipOpen(true)} 
                disabled={!kaspaAddress}
              >
                Tip in KAS
              </Button>
            </div>
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
        profile={profile ? {
          id: profile.id,
          displayName: profile.display_name || profile.handle || 'Creator',
          handle: profile.handle || (profile.display_name || 'you').toLowerCase().replace(/\s+/g, '_'),
          bio: profile.bio || '',
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
        toAddress={kaspaAddress} 
      />
    </main>
  );
};

export default Stream;