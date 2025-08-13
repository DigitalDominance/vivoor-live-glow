import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PlayerPlaceholder from "@/components/streams/PlayerPlaceholder";
import ProfileModal from "@/components/modals/ProfileModal";
import { users } from "@/mock/data";
import { useWallet } from "@/context/WalletContext";
import { getStartDaa, setStartDaa, clearStartDaa } from "@/lib/streamLocal";
import { fetchAddressFullTxs } from "@/lib/kaspaApi";
import { useKaspaTipScanner } from "@/hooks/useKaspaTipScanner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const GoLive: React.FC = () => {
  const { identity } = useWallet();
  const kaspaAddress = React.useMemo(() => (identity?.id?.startsWith('kaspa:') ? identity.id : null), [identity?.id]);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const example = users['u1'];
  const navigate = useNavigate();

  const [live, setLive] = React.useState(false);
  const [title, setTitle] = React.useState('My awesome stream');
  const [category, setCategory] = React.useState('IRL');
  const [elapsed, setElapsed] = React.useState(0);
  const [startDaa, setStartDaaState] = React.useState<number | null>(null);
  const [dbStreamId, setDbStreamId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (live && kaspaAddress) {
      const v = getStartDaa(kaspaAddress);
      setStartDaaState(v);
    } else {
      setStartDaaState(null);
    }
  }, [live, kaspaAddress]);

  React.useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  const handleStart = React.useCallback(async () => {
    if (!kaspaAddress) {
      toast.error("Connect a Kaspa wallet to go live");
      return;
    }
    try {
      const txs = await fetchAddressFullTxs(kaspaAddress, 50);
      const maxDaa = txs.reduce((m, tx) => Math.max(m, tx.accepting_block_blue_score || 0), 0);
      setStartDaa(kaspaAddress, maxDaa);
      setStartDaaState(maxDaa);
      setLive(true);

      // Persist profile wallet and create a stream if authenticated
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await supabase.from('profiles').upsert({ id: auth.user.id, kaspa_address: kaspaAddress }).select('id');
        const ins = await supabase.from('streams')
          .insert({ user_id: auth.user.id, title, category, is_live: true })
          .select('id')
          .maybeSingle();
        if (!ins.error && ins.data) setDbStreamId(ins.data.id);
      }

      toast.success("Stream started. Kaspa tips scanning enabled.");
    } catch (e:any) {
      toast.error(e?.message || "Failed to set baseline DAA");
    }
  }, [kaspaAddress]);

  const handleEnd = React.useCallback(() => {
    setLive(false);
    if (kaspaAddress) clearStartDaa(kaspaAddress);
    setStartDaaState(null);
  }, [kaspaAddress]);

  useKaspaTipScanner({
    address: kaspaAddress,
    startDaa: startDaa ?? undefined,
    enabled: live && !!kaspaAddress && typeof startDaa === 'number',
    onTip: (tip) => {
      const amountKas = tip.amountSompi / 1e8;
      toast("New KAS tip", { description: `${amountKas.toFixed(8)} KAS • DAA ${tip.daa}${tip.message ? ' — ' + tip.message : ''}` });
      console.log("Tip event", tip);
    },
  });

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>Go Live — Vivoor</title>
        <meta name="description" content="Set up your stream and go live on Vivoor. Mock-only studio with preview and health badges." />
        <link rel="canonical" href="/go-live" />
      </Helmet>

      <h1 className="sr-only">Go Live</h1>

      {!live ? (
        <section className="max-w-3xl mx-auto glass rounded-xl p-5">
          <div className="text-lg font-semibold">Stream setup</div>
          <div className="grid gap-3 mt-4">
            <label className="text-sm">Title</label>
            <input className="rounded-md bg-background px-3 py-2 text-sm border border-border" value={title} onChange={(e)=>setTitle(e.target.value)} />
            <label className="text-sm mt-2">Category</label>
            <select className="rounded-md bg-background border border-border px-3 py-2" value={category} onChange={(e)=>setCategory(e.target.value)}>
              {['IRL','Music','Gaming','Talk','Sports','Crypto','Tech'].map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="text-sm mt-2">Thumbnail (mock)</label>
            <div className="h-24 rounded-md border border-dashed border-border/70 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Upload placeholder</div>
            <div className="flex justify-end mt-4"><Button variant="hero" onClick={handleStart} disabled={!kaspaAddress}>Start Stream</Button></div>
          </div>
        </section>
      ) : (
        <section className="grid lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2">
            <PlayerPlaceholder />
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-grad-primary text-[hsl(var(--on-gradient))]">LIVE</span>
              <span>Elapsed: {new Date(elapsed*1000).toISOString().substring(11,19)}</span>
              <span className="ml-auto">Viewers: 0 (mock)</span>
              <Button variant="destructive" size="sm" onClick={handleEnd}>End Stream</Button>
            </div>
            <div className="mt-4 p-3 rounded-xl border border-border bg-card/60 backdrop-blur-md text-sm text-muted-foreground">
              Ingest URL: rtmp://live.vivoor/mock • Stream Key: pk_live_••••••••••
            </div>
          </div>
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border border-border p-3 bg-card/60 backdrop-blur-md">
              <div className="font-medium">Profile</div>
              <div className="flex items-center gap-3 mt-2">
                <div className="size-10 rounded-full p-[2px] bg-grad-primary"><div className="size-full rounded-full bg-background"/></div>
                <div>
                  <div>{example.displayName}</div>
                  <button className="text-xs text-muted-foreground hover:text-foreground story-link" onClick={()=>setProfileOpen(true)}>@{example.handle}</button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">Followers: {example.followers.toLocaleString()} • Following: {example.following.toLocaleString()}</div>
              <div className="mt-3"><Button variant="secondary" disabled>Tip in KAS (viewers tip you)</Button></div>
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
      )}

      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} profile={example} isLoggedIn={!!identity} onRequireLogin={()=>{}} onGoToChannel={()=>{ if (dbStreamId) navigate(`/watch/${dbStreamId}`); }} />
    </main>
  );
};

export default GoLive;
