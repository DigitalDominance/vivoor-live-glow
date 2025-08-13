import React from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import DbStreamCard, { DbStream, DbProfile } from "@/components/streams/DbStreamCard";
import VodCard from "@/components/streams/VodCard";
import ProfileModal from "@/components/modals/ProfileModal";
import { LoginModal } from "@/components/modals/LoginModal";
import { supabase } from "@/integrations/supabase/client";

const categories = ['IRL','Music','Gaming','Talk','Sports','Crypto','Tech'];

type SearchMode = 'username' | 'title';

type SortMode = 'viewers' | 'newest' | 'trending';

const AppDirectory: React.FC = () => {
  const [searchMode, setSearchMode] = React.useState<SearchMode>('title');
  const [query, setQuery] = React.useState('');
  const [activeCats, setActiveCats] = React.useState<string[]>([]);
  const [showLive, setShowLive] = React.useState<'live' | 'replay' | 'all'>('all');
  const [sort, setSort] = React.useState<SortMode>('viewers');
  const [visible, setVisible] = React.useState(9);

  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [activeProfile, setActiveProfile] = React.useState<DbProfile | undefined>();

  const onRequireLogin = () => setLoginOpen(true);

  const [dbStreams, setDbStreams] = React.useState<DbStream[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, DbProfile>>({});
  const [vods, setVods] = React.useState<any[]>([]);

  React.useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('streams').select('*').order('started_at', { ascending: false });
      if (s) setDbStreams(s as any);
      const uids = Array.from(new Set((s || []).map((x:any)=>x.user_id)));
      if (uids.length) {
        const { data: p } = await supabase.from('profiles').select('id,handle,display_name,avatar_url').in('id', uids);
        const map: Record<string, DbProfile> = {};
        (p||[]).forEach((r:any)=>{ map[r.id] = r; });
        setProfiles(map);
      }
      const { data: v } = await supabase.from('vods').select('id,title,thumbnail_url,created_at').order('created_at', { ascending: false });
      if (v) setVods(v);
    })();
  }, []);

  const filtered = React.useMemo(() => {
    let list = [...dbStreams];
    if (searchMode === 'username' && query) list = list.filter(s => (profiles[s.user_id]?.handle || '').toLowerCase().includes(query.toLowerCase()));
    if (searchMode === 'title' && query) list = list.filter(s => s.title.toLowerCase().includes(query.toLowerCase()));
    if (activeCats.length) list = list.filter(s => activeCats.includes(s.category || ''));
    if (showLive !== 'all') list = list.filter(s => (showLive === 'live' ? s.is_live : !s.is_live));
    if (sort === 'viewers') list.sort((a:any,b:any) => (b.viewers||0) - (a.viewers||0));
    if (sort === 'newest') list.sort((a:any,b:any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    if (sort === 'trending') list.sort((a:any,b:any) => ((b.viewers||0) + (b.is_live?200:0)) - ((a.viewers||0) + (a.is_live?200:0)));
    return list;
  }, [searchMode, query, activeCats, showLive, sort, dbStreams, profiles]);

  // Infinite scroll sentinel
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = sentinelRef.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          setVisible((v) => Math.min(v + 6, filtered.length));
        }
      });
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const openProfile = (userId: string) => {
    const prof = profiles[userId];
    if (prof) { setActiveProfile(prof); setProfileOpen(true); }
  };

  const visibleItems = filtered.slice(0, visible);

  return (
    <main className="container mx-auto px-4 py-8">
      <Helmet>
        <title>Vivoor App Directory — Live & Replays</title>
        <meta name="description" content="Discover live streams and replays on Vivoor. Search, filter by category, and watch anonymously." />
        <link rel="canonical" href="/app" />
      </Helmet>

      <h1 className="sr-only">Vivoor App Directory</h1>

      {/* Search controls */}
      <section className="glass rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button className={`px-3 py-2 text-sm ${searchMode==='title'?'bg-muted text-foreground':'text-muted-foreground'}`} onClick={()=>setSearchMode('title')}>Stream Name</button>
            <button className={`px-3 py-2 text-sm ${searchMode==='username'?'bg-muted text-foreground':'text-muted-foreground'}`} onClick={()=>setSearchMode('username')}>Username</button>
          </div>
          <input
            className="flex-1 min-w-[220px] rounded-md bg-background px-3 py-2 text-sm border border-border"
            placeholder={searchMode==='title'? 'Search streams...' : 'Search usernames...'}
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
          />
          <div className="flex items-center gap-2 text-sm">
            <label className="text-muted-foreground">Live status</label>
            <select className="rounded-md bg-background border border-border px-2 py-2" value={showLive} onChange={(e)=>setShowLive(e.target.value as any)}>
              <option value="all">All</option>
              <option value="live">Live</option>
              <option value="replay">Replays</option>
            </select>
            <label className="text-muted-foreground ml-2">Sort</label>
            <select className="rounded-md bg-background border border-border px-2 py-2" value={sort} onChange={(e)=>setSort(e.target.value as any)}>
              <option value="viewers">Most Viewers</option>
              <option value="newest">Newest</option>
              <option value="trending">Trending</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = activeCats.includes(c);
            return (
              <button key={c} onClick={() => setActiveCats((arr)=> active ? arr.filter(x=>x!==c) : [...arr, c])} className={`px-3 py-1 rounded-full text-xs border ${active ? 'bg-grad-primary text-[hsl(var(--on-gradient))] border-transparent' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {c}
              </button>
            )
          })}
        </div>
      </section>

      <section className="mt-6">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            No results. Try a different category or search.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.slice(0, visible).map((s) => (
              <DbStreamCard key={s.id} stream={s as any} profile={profiles[s.user_id]} />
            ))}
          </div>
        )}
        {visible < filtered.length && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-56 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}
        <div ref={sentinelRef} className="h-8" />
      </section>

      <section className="mt-10">
        <div className="mb-3 font-semibold">Replays</div>
        {vods.length === 0 ? (
          <div className="text-sm text-muted-foreground">No replays yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vods.slice(0, 12).map((v:any) => <VodCard key={v.id} vod={v} />)}
          </div>
        )}
      </section>
      {/* Modals */}
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} onContinue={() => { setIsLoggedIn(true); setLoginOpen(false); }} />
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} profile={activeProfile as any} isLoggedIn={isLoggedIn} onRequireLogin={() => setLoginOpen(true)} onGoToChannel={() => {}} />
    </main>
  );
};

export default AppDirectory;
