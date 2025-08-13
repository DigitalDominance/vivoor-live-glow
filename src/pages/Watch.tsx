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
import { Volume2, Play, Settings } from "lucide-react";
import { StreamCard } from "@/components/streams/StreamCard";

const Watch: React.FC = () => {
  const { id } = useParams();
  const stream = getStreamById(id || "");
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [tipOpen, setTipOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);

  const onRequireLogin = () => setLoginOpen(true);

  const [dbStream, setDbStream] = React.useState<any | null>(null);
  const [dbProfile, setDbProfile] = React.useState<any | null>(null);
  const [kaspaAddress, setKaspaAddress] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: s } = await supabase.from('streams').select('*').eq('id', id).maybeSingle();
      if (s) {
        setDbStream(s);
        const { data: p } = await supabase.rpc('get_public_profile', { _id: s.user_id });
        const pub = Array.isArray(p) ? (p[0] || null) : (p || null);
        setDbProfile(pub);

        const { data: auth } = await supabase.auth.getUser();
        setIsLoggedIn(!!auth.user);
        if (auth.user) {
          const { data: addr } = await supabase.rpc('get_kaspa_address', { _id: s.user_id });
          setKaspaAddress(addr || null);
        } else {
          setKaspaAddress(null);
        }
      }
    })();
  }, [id]);

  const messages: ChatMessage[] = Array.from({ length: 12 }).map((_, i) => ({
    id: String(i), user: i % 3 === 0 ? 'mod' : 'viewer', text: 'Sample message ' + (i + 1), time: 'now'
  }));

  if (!stream && !dbStream) return (
    <main className="container mx-auto px-4 py-8">
      <div className="text-center">Stream not found.</div>
    </main>
  );

  const active = dbStream || stream;
  const computedProfile = dbProfile
    ? {
        id: dbProfile.id,
        handle: dbProfile.handle || (dbProfile.display_name || 'creator').toLowerCase().replace(/\s+/g, '_'),
        displayName: dbProfile.display_name || dbProfile.handle || 'Creator',
        bio: dbProfile.bio || '',
        followers: 0,
        following: 0,
        tags: [] as string[],
      }
    : (stream ? users[stream.userId] : undefined);
  const username = dbProfile?.handle || (active?.username || 'creator');

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
              <Button variant="gradientOutline" size="sm" onClick={() => setTipOpen(true)}>Tip in KAS</Button>
              <Button variant="hero" size="sm" onClick={() => { if (!isLoggedIn) return onRequireLogin(); /* follow toggle */ }}>Follow</Button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md">
            <div className="text-sm text-muted-foreground">{active.category} • {active.viewers ?? 0} viewers</div>
            <div className="font-medium">{active.title}</div>
            <button className="story-link text-sm text-muted-foreground hover:text-foreground" onClick={() => setProfileOpen(true)}>@{username}</button>
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
