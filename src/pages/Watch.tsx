import React from "react";
import { Helmet } from "react-helmet-async";
import PlayerPlaceholder from "@/components/streams/PlayerPlaceholder";
import ChatPanel, { ChatMessage } from "@/components/streams/ChatPanel";
import TipModal from "@/components/modals/TipModal";
import ProfileModal from "@/components/modals/ProfileModal";
import { Button } from "@/components/ui/button";
import { useParams, useNavigate } from "react-router-dom";
import { getStreamById, streams, users } from "@/mock/data";
import { supabase } from "@/integrations/supabase/client";
import { Volume2, Play, Settings, Heart } from "lucide-react";
import { StreamCard } from "@/components/streams/StreamCard";
import { useWallet } from "@/context/WalletContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const Watch: React.FC = () => {
  const { id } = useParams();
  const stream = getStreamById(id || "");
  const navigate = useNavigate();

  const [tipOpen, setTipOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [isLiked, setIsLiked] = React.useState(false);

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
          profiles!streams_user_id_fkey (
            handle,
            display_name,
            avatar_url,
            bio,
            kaspa_address
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

  const messages: ChatMessage[] = Array.from({ length: 12 }).map((_, i) => ({
    id: String(i), user: i % 3 === 0 ? 'mod' : 'viewer', text: 'Sample message ' + (i + 1), time: 'now'
  }));

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

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">Loading stream...</div>
      </main>
    );
  }

  const active = streamData || stream;
  if (!active) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">Stream not found.</div>
      </main>
    );
  }

  const profile = streamData?.profiles as any;
  const computedProfile = profile
    ? {
        id: profile.id || (active as any).user_id || (active as any).userId,
        handle: profile.handle || 'creator',
        displayName: profile.display_name || profile.handle || 'Creator',
        bio: profile.bio || '',
        followers: 0,
        following: 0,
        tags: [] as string[],
      }
    : (stream ? users[stream.userId] : undefined);
  const username = profile?.handle || ((active as any)?.username || 'creator');
  const kaspaAddress = profile?.kaspa_address;

  const suggested = streams.filter((s) => s.id !== (active?.id || '')).slice(0, 6);

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>{active.title} — Watch on Vivoor</title>
        <meta name="description" content={`Watch ${active.title} by @${username} on Vivoor.`} />
        <link rel="canonical" href={`/watch/${active.id}`} />
      </Helmet>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <PlayerPlaceholder />
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
              {active.category} • {active.viewers ?? 0} viewers
              {((active as any).is_live !== false) && <span className="ml-2 inline-flex items-center gap-1 text-red-500">
                <span className="size-2 bg-red-500 rounded-full animate-pulse"></span>
                LIVE
              </span>}
            </div>
            <div className="font-medium">{active.title}</div>
            <button className="story-link text-sm text-muted-foreground hover:text-foreground" onClick={() => setProfileOpen(true)}>
              @{username}
            </button>
          </div>

          <div className="mt-6">
            <div className="mb-2 font-medium">Suggested streams</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggested.map((s) => (
                <StreamCard key={s.id} stream={s} isLoggedIn={isLoggedIn} onOpenProfile={()=>setProfileOpen(true)} onRequireLogin={onRequireLogin} />
              ))}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="lg:col-span-1 h-full">
          <ChatPanel messages={messages} canPost={isLoggedIn} onRequireLogin={onRequireLogin} />
        </div>
      </div>

      {/* Modals */}
      <TipModal open={tipOpen} onOpenChange={setTipOpen} isLoggedIn={isLoggedIn} onRequireLogin={onRequireLogin} toAddress={kaspaAddress} />
      {computedProfile && (
        <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} profile={computedProfile} isLoggedIn={isLoggedIn} onRequireLogin={onRequireLogin} onGoToChannel={() => navigate(`/watch/${active.id}`)} />
      )}
    </main>
  );
};

export default Watch;
