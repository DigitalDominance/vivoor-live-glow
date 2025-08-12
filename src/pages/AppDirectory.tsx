import React from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { StreamCard } from "@/components/streams/StreamCard";
import { allCategories, streams, users, Stream, UserProfile } from "@/mock/data";
import ProfileModal from "@/components/modals/ProfileModal";
import { LoginModal } from "@/components/modals/LoginModal";

const categories = allCategories;

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
  const [activeProfile, setActiveProfile] = React.useState<UserProfile | undefined>();

  const onRequireLogin = () => setLoginOpen(true);

  const filtered = React.useMemo(() => {
    let list = [...streams];
    if (searchMode === 'username' && query) list = list.filter(s => s.username.toLowerCase().includes(query.toLowerCase()));
    if (searchMode === 'title' && query) list = list.filter(s => s.title.toLowerCase().includes(query.toLowerCase()));
    if (activeCats.length) list = list.filter(s => activeCats.includes(s.category));
    if (showLive !== 'all') list = list.filter(s => (showLive === 'live' ? s.live : !s.live));
    if (sort === 'viewers') list.sort((a,b) => b.viewers - a.viewers);
    if (sort === 'newest') list.sort((a,b) => (b.startedAt?1:0) - (a.startedAt?1:0));
    if (sort === 'trending') list.sort((a,b) => (b.viewers + (b.live?200:0)) - (a.viewers + (a.live?200:0)));
    return list;
  }, [searchMode, query, activeCats, showLive, sort]);

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
    const prof = users[userId];
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

      {/* Results */}
      <section className="mt-6">
        {visibleItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            No results. Try a different category or search.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((s) => (
              <StreamCard key={s.id} stream={s} isLoggedIn={isLoggedIn} onOpenProfile={(id)=>openProfile(id)} onRequireLogin={onRequireLogin} />
            ))}
          </div>
        )}
        {/* skeletons for loading more (mock) */}
        {visible < filtered.length && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-56 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}
        <div ref={sentinelRef} className="h-8" />
      </section>

      {/* Modals */}
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} onContinue={() => { setIsLoggedIn(true); setLoginOpen(false); }} />
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} profile={activeProfile} isLoggedIn={isLoggedIn} onRequireLogin={() => setLoginOpen(true)} onGoToChannel={() => {}} />
    </main>
  );
};

export default AppDirectory;
