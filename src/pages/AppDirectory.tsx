import React from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { StreamCard } from "@/components/streams/StreamCard";
import ProfileModal from "@/components/modals/ProfileModal";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { startStreamCleanupTimer } from "@/lib/streamCleanup";
import { getCategoryThumbnail } from "@/utils/categoryThumbnails";
import { useQuery } from "@tanstack/react-query";

const categories = ['IRL', 'Music', 'Gaming', 'Talk', 'Sports', 'Crypto', 'Tech'];

type SearchMode = 'username' | 'title';

type SortMode = 'viewers' | 'newest' | 'trending';

const AppDirectory: React.FC = () => {
  const [searchMode, setSearchMode] = React.useState<SearchMode>('title');
  const [query, setQuery] = React.useState('');
  const [activeCats, setActiveCats] = React.useState<string[]>([]);
  const [showLive, setShowLive] = React.useState<'live' | 'replay' | 'all'>('live');
  const [sort, setSort] = React.useState<SortMode>('viewers');
  const [visible, setVisible] = React.useState(9);

  const [profileOpen, setProfileOpen] = React.useState(false);
  const [activeProfile, setActiveProfile] = React.useState<any>();
  
  const { identity } = useWallet();
  const isLoggedIn = !!identity;

  // Start stream cleanup timer on app load
  React.useEffect(() => {
    const cleanupTimer = startStreamCleanupTimer();
    return () => clearInterval(cleanupTimer);
  }, []);

  const onRequireLogin = () => {
    if (!isLoggedIn) {
      // Handle login requirement
    }
  };

  // Fetch all streams from database and check their live status
  const { data: allStreams = [] } = useQuery({
    queryKey: ['all-streams'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_streams_with_profiles_and_likes', { 
        _limit: 100, 
        _offset: 0 
      });
      
      if (error) {
        console.error('Error fetching streams:', error);
        return [];
      }
      
      console.log('Raw streams data:', data);
      
      return (data || []).map((stream: any) => {
        // Stream is considered live based on database is_live status
        // which is updated by our Livepeer status check function
        const isLive = stream.is_live;
        
        console.log(`Stream ${stream.id}: is_live=${stream.is_live}, playback_url=${!!stream.playback_url}, final_live=${isLive}`);
        
        return {
          id: stream.id,
          title: stream.title,
          category: stream.category || 'IRL',
          live: isLive,
          viewers: stream.viewers || 0,
          username: stream.profile_handle || stream.profile_display_name || 'unknown',
          userId: stream.user_id,
          thumbnail: stream.thumbnail_url || getCategoryThumbnail(stream.category || 'IRL'),
          startedAt: stream.created_at,
          likeCount: stream.like_count || 0,
          avatar: stream.profile_avatar_url
        };
      });
    },
    refetchInterval: 10000 // Refresh every 10 seconds for live updates
  });

  // Trigger Livepeer status check every 30 seconds
  React.useEffect(() => {
    const checkLivepeerStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-livepeer-status');
        if (error) {
          console.warn('Livepeer status check failed:', error);
        } else {
          console.log('Livepeer status check result:', data);
        }
      } catch (error) {
        console.warn('Failed to invoke Livepeer status check:', error);
      }
    };

    // Check immediately
    checkLivepeerStatus();
    
    // Then check every 30 seconds
    const interval = setInterval(checkLivepeerStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const filtered = React.useMemo(() => {
    // Use only real database streams
    let list = [...allStreams];
    
    if (searchMode === 'username' && query) list = list.filter(s => s.username.toLowerCase().includes(query.toLowerCase()));
    if (searchMode === 'title' && query) list = list.filter(s => s.title.toLowerCase().includes(query.toLowerCase()));
    if (activeCats.length) list = list.filter(s => activeCats.includes(s.category));
    if (showLive !== 'all') list = list.filter(s => (showLive === 'live' ? s.live : !s.live));
    if (sort === 'viewers') list.sort((a,b) => b.viewers - a.viewers);
    if (sort === 'newest') list.sort((a,b) => (b.startedAt?1:0) - (a.startedAt?1:0));
    if (sort === 'trending') list.sort((a,b) => (b.viewers + (b.live?200:0)) - (a.viewers + (a.live?200:0)));
    return list;
  }, [allStreams, searchMode, query, activeCats, showLive, sort]);

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

  const openProfile = async (userId: string) => {
    try {
      const { data } = await supabase.rpc('get_profile_with_stats', { _user_id: userId });
      const profile = Array.isArray(data) ? data[0] : data;
      if (profile) {
        setActiveProfile({
          id: profile.id,
          handle: profile.handle || 'user',
          displayName: profile.display_name || profile.handle || 'User',
          bio: profile.bio || '',
          followers: profile.follower_count || 0,
          following: profile.following_count || 0,
          tags: [],
          avatar: profile.avatar_url
        });
        setProfileOpen(true);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleGoToChannel = async (userId: string) => {
    try {
      // Get the user's handle for routing
      const { data: profile } = await supabase
        .from('profiles')
        .select('handle')
        .eq('id', userId)
        .maybeSingle();
      
      const channelRoute = profile?.handle || userId;
      window.location.href = `/channel/${channelRoute}`;
    } catch (error) {
      console.error('Error getting profile handle:', error);
      window.location.href = `/channel/${userId}`;
    }
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
      <ProfileModal 
        open={profileOpen} 
        onOpenChange={setProfileOpen} 
        profile={activeProfile} 
        isLoggedIn={isLoggedIn} 
        onRequireLogin={onRequireLogin} 
        onGoToChannel={() => activeProfile?.handle && handleGoToChannel(activeProfile.id)} 
      />
    </main>
  );
};

export default AppDirectory;
