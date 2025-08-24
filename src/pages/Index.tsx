import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, Repeat, Scissors, Play, Radio, Circle, Heart, Eye } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import ClipVerifiedBadge from "@/components/ClipVerifiedBadge";

const LivePill = ({ label, delay }: { label: string; delay: number }) => (
  <motion.div
    className="px-3 py-1 rounded-full text-xs font-medium gradient-border bg-background/70 text-foreground/90 backdrop-blur"
    initial={{ y: 0, opacity: 0 }}
    animate={{ y: [0, -6, 0], opacity: 1 }}
    transition={{ duration: 6, repeat: Infinity, delay, ease: "easeInOut" }}
  >
    <span className="inline-flex items-center gap-1"><Radio className="size-3 text-[hsl(var(--brand-pink))]" /> {label}</span>
  </motion.div>
);

const PlayerMock = () => (
  <div className="relative rounded-2xl p-[1px] bg-grad-primary shadow-[0_10px_40px_-12px_hsl(var(--brand-iris)/0.5)]">
    <div className="relative rounded-2xl bg-background/70 backdrop-blur-md border border-border overflow-hidden">
      <div className="aspect-[16/9] flex items-center justify-center">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] bg-[length:200%_100%] animate-shimmer" />
        <div className="w-4/5 h-24 rounded-md bg-gradient-to-r from-foreground/15 via-foreground/5 to-foreground/15 bg-[length:200%_100%] animate-shimmer" />
        <Button variant="hero" size="lg" className="absolute bottom-4 right-4">
          <Play /> Play demo
        </Button>
      </div>
    </div>
  </div>
);

const FeatureCard = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <motion.article
    className="group glass rounded-xl p-5 transition-transform will-change-transform hover:translate-y-[-2px]"
    whileInView={{ opacity: [0, 1], y: [8, 0] }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.5 }}
  >
    <div className="inline-flex items-center justify-center size-10 rounded-full bg-grad-primary text-[hsl(var(--on-gradient))] shadow-sm mb-3">
      <Icon className="" />
    </div>
    <h3 className="font-semibold mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{desc}</p>
  </motion.article>
);

const ClipCard = ({ clip, onClick }: { clip: any; onClick: () => void }) => (
  <motion.div
    className="snap-start shrink-0 w-80 group cursor-pointer mr-4"
    whileHover={{ y: -4 }}
    transition={{ duration: 0.3 }}
    onClick={onClick}
  >
    <div className="relative rounded-xl overflow-hidden p-0.5 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink hover:shadow-lg hover:shadow-brand-iris/20 transition-all duration-300">
      <div className="relative rounded-xl overflow-hidden bg-background h-full">
        {/* Thumbnail/Video */}
        <div className="relative aspect-video overflow-hidden rounded-t-xl">
          {clip.download_url ? (
            <video
              className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
              muted
              playsInline
              webkit-playsinline="true"
              x-webkit-airplay="deny"
              preload="metadata"
              poster=""
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                video.currentTime = 0.5;
              }}
              onMouseEnter={(e) => {
                const video = e.currentTarget;
                video.currentTime = 0.5;
              }}
              onTouchStart={(e) => {
                const video = e.currentTarget;
                video.currentTime = 0.5;
              }}
            >
              <source src={clip.download_url} type="video/mp4" />
            </video>
          ) : clip.thumbnail_url ? (
            <img
              src={clip.thumbnail_url}
              alt={clip.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 flex items-center justify-center">
              <Play className="size-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-background/90 backdrop-blur-sm rounded-full p-3 scale-75 group-hover:scale-100">
              <Play className="size-6 fill-current" />
            </div>
          </div>
          
          {/* Duration */}
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/90 text-white text-xs font-medium backdrop-blur-sm">
            {Math.floor((clip.end_seconds - clip.start_seconds) / 60)}:
            {String((clip.end_seconds - clip.start_seconds) % 60).padStart(2, '0')}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-medium text-sm mb-2 line-clamp-2 text-foreground">
            {clip.title}
          </h3>
          
          {/* Creator Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Avatar className="size-5">
              <AvatarImage src={clip.profile_avatar_url || ''} alt={`@${clip.profile_handle} avatar`} />
              <AvatarFallback className="text-[10px]">
                {clip.profile_display_name?.[0]?.toUpperCase() || clip.profile_handle?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1">
              <span>@{clip.profile_handle || 'Unknown'}</span>
              <ClipVerifiedBadge userId={clip.user_id} size="sm" />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="size-3" />
              {clip.views || 0}
            </div>
            <div className="flex items-center gap-1">
              <Heart className="size-3" />
              {clip.like_count || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

const Index = () => {
  const navigate = useNavigate();
  
  // Fetch top 10 most liked clips
  const { data: topClips } = useQuery({
    queryKey: ['top-clips'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clips_with_profiles_and_stats', {
        _limit: 10,
        _offset: 0,
        _search: null,
        _order_by: 'likes'
      });
      
      if (error) {
        console.error('Error fetching top clips:', error);
        return [];
      }
      
      return data || [];
    },
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  const handleClipClick = async (clipId: string) => {
    // Increment view count
    try {
      await supabase.rpc('increment_clip_views', { clip_id_param: clipId });
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
    
    // Navigate to clip page
    navigate(`/clip/${clipId}`);
  };
  return (
    <main id="top">
      <Helmet>
        <title>Vivoor - Kaspa Live Streaming Platform | Stream & Earn KAS</title>
        <meta name="description" content="Join the premier live streaming platform built for the Kaspa community. Stream live, receive KAS tips from viewers, and discover amazing content creators. Start earning with your streams today." />
        <meta name="keywords" content="Kaspa streaming, KAS tips, crypto streaming, live streaming, blockchain streaming, kaspa community, earn crypto streaming, kaspa live, vivoor streaming" />
        <link rel="canonical" href="https://vivoor.live/" />
        
        {/* Additional Open Graph for home page */}
        <meta property="og:title" content="Vivoor - Kaspa Live Streaming Platform | Stream & Earn KAS" />
        <meta property="og:description" content="Join the premier live streaming platform built for the Kaspa community. Stream live, receive KAS tips, and discover amazing content creators." />
        <meta property="og:url" content="https://vivoor.live/" />
        
        {/* JSON-LD for home page */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Vivoor",
            "description": "Live streaming platform for the Kaspa community with integrated KAS tipping",
            "url": "https://vivoor.live",
            "applicationCategory": "MultimediaApplication",
            "operatingSystem": "Web Browser",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "featureList": [
              "Live Streaming",
              "KAS Cryptocurrency Tips",
              "Real-time Chat",
              "Stream Recording",
              "Clip Creation",
              "Multi-category Content"
            ],
            "softwareRequirements": "Web Browser with JavaScript enabled"
          })}
        </script>
      </Helmet>
      {/* Hero */}
      <section className="container mx-auto px-4 pt-12 md:pt-20">
        <div className="grid md:grid-cols-2 items-center gap-10">
          <div>
            <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-[1.1] text-gradient">
              Go live in seconds. Replay forever.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-prose">
              Vivoor blends effortless live streaming with instant replays and one‑tap clips — all with buttery animations and zero friction.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="hero" size="lg">Start a Stream</Button>
              <Button variant="glass" size="lg">Watch Demos</Button>
            </div>
            <div className="mt-6 flex gap-3">
              <LivePill label="LIVE now" delay={0.3} />
              <LivePill label="100+ creators" delay={0.9} />
            </div>
          </div>
          <PlayerMock />
        </div>
      </section>

      {/* Kaspa highlight */}
      <section className="container mx-auto px-4 mt-10">
        <div className="rounded-xl border border-border p-4 bg-card/60 backdrop-blur-md text-center">
          <p className="text-sm font-medium">Built on <span className="text-gradient font-semibold">Kaspa</span> — the first live streaming platform on Kaspa.</p>
        </div>
      </section>

      {/* Feature Trio */}
      <section id="features" className="container mx-auto px-4 mt-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard icon={Zap} title="Instant Live" desc="Go from tap to live in under a second with optimized start times." />
          <FeatureCard icon={Repeat} title="Auto Replay" desc="Streams are saved instantly — rewind and replay without uploads." />
          <FeatureCard icon={Scissors} title="Clips in One Tap" desc="Capture highlights with a tap; shareable links auto‑generated." />
        </div>
      </section>

      {/* Clip Showcase */}
      <section id="clips" className="container mx-auto px-4 mt-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              <span className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
                Clip Showcase
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">Most liked clips from our community</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/clips')}
            className="border-brand-iris/30 hover:bg-brand-iris/10 hover:border-brand-iris/50 transition-all duration-300"
          >
            View All Clips
          </Button>
        </div>
        
        {/* Custom Gradient Scrollbar */}
        <style>{`
          .gradient-scrollbar::-webkit-scrollbar {
            height: 8px;
          }
          .gradient-scrollbar::-webkit-scrollbar-track {
            background: hsl(var(--background));
            border-radius: 4px;
          }
          .gradient-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(90deg, hsl(var(--brand-cyan)), hsl(var(--brand-iris)), hsl(var(--brand-pink)));
            border-radius: 4px;
            border: 1px solid hsl(var(--background));
          }
          .gradient-scrollbar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(90deg, hsl(var(--brand-cyan)), hsl(var(--brand-iris)), hsl(var(--brand-pink)));
            filter: brightness(1.2);
          }
        `}</style>
        
        <div className="overflow-x-auto gradient-scrollbar snap-x snap-mandatory pb-4 -mx-4 pl-4">
          <div className="flex w-max">
            {topClips && topClips.length > 0 ? (
              topClips.map((clip: any) => (
                <ClipCard 
                  key={clip.id} 
                  clip={clip} 
                  onClick={() => handleClipClick(clip.id)}
                />
              ))
            ) : (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="snap-start shrink-0 w-80 mr-4"
                >
                  <div className="relative rounded-xl overflow-hidden p-0.5 bg-gradient-to-r from-brand-cyan/50 via-brand-iris/50 to-brand-pink/50 animate-pulse">
                    <div className="relative rounded-xl overflow-hidden bg-background h-full">
                      <div className="aspect-video bg-gradient-to-br from-brand-cyan/10 via-brand-iris/10 to-brand-pink/10 rounded-t-xl" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-gradient-to-r from-brand-cyan/20 to-brand-iris/20 rounded" />
                        <div className="h-3 bg-gradient-to-r from-brand-iris/20 to-brand-pink/20 rounded w-2/3" />
                        <div className="h-3 bg-gradient-to-r from-brand-pink/20 to-brand-cyan/20 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container mx-auto px-4 mt-16">
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {[
            { title: "Go Live", desc: "One tap to start streaming with ultra‑low latency." },
            { title: "Auto Save", desc: "Your stream becomes a replay instantly — no extra steps." },
            { title: "Share Replay", desc: "Link your moment anywhere with beautiful previews." },
          ].map((s, i) => (
            <motion.div key={i} className="glass rounded-xl p-5" whileInView={{ opacity: [0, 1], y: [8, 0] }} viewport={{ once: true }}>
              <div className="text-sm text-muted-foreground">Step {i + 1}</div>
              <h3 className="font-semibold mt-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials Ticker */}
      <section className="container mx-auto px-4 mt-16">
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex animate-marquee gap-8 py-4 will-change-transform hover:[animation-play-state:paused]">
            {[
              "“Fastest go‑live I’ve used.” — Alex",
              "“Clipping is magic.” — Priya",
              "“Looks and feels premium.” — Ken",
              "“Auto‑replay saves hours.” — Mei",
            ].concat([
              "“Fastest go‑live I’ve used.” — Alex",
              "“Clipping is magic.” — Priya",
              "“Looks and feels premium.” — Ken",
              "“Auto‑replay saves hours.” — Mei",
            ]).map((q, i) => (
              <span key={i} className="text-sm text-muted-foreground whitespace-nowrap">{q}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 mt-16">
        <div className="rounded-2xl p-[1px] bg-grad-primary">
          <div className="rounded-2xl bg-background/70 backdrop-blur-md p-8 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gradient">Your moment, in motion.</h2>
            <p className="mt-2 text-muted-foreground">Join now and bring your stories to life.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="hero" size="lg">Get the App</Button>
              <Button variant="gradientOutline" size="lg">Join as Creator</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Instant Tips */}
      <section id="instant-tips" className="container mx-auto px-4 mt-16">
        <h2 className="font-semibold mb-4">Instant Tips on Kaspa</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Zap className="size-4 text-[hsl(var(--brand-pink))]" /> Near‑instant</div>
            <div className="mt-2 text-lg font-bold">Tips settle in seconds</div>
            <p className="text-sm text-muted-foreground mt-2">Kaspa’s blockDAG confirms fast — creators see KAS almost immediately.</p>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Circle className="size-4 text-[hsl(var(--brand-iris))]" /> Low fee</div>
            <div className="mt-2 text-lg font-bold">Only 5% platform fee</div>
            <p className="text-sm text-muted-foreground mt-2">We take just 5% — far less than major streaming platforms.</p>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Repeat className="size-4 text-[hsl(var(--brand-cyan))]" /> Transparent</div>
            <div className="mt-2 text-lg font-bold">On‑chain and simple</div>
            <p className="text-sm text-muted-foreground mt-2">No middlemen, no hidden cuts. Direct, on‑chain tipping in KAS.</p>
          </div>
        </div>
      </section>

      {/* FAQ (placeholder) */}
      <section id="faq" className="container mx-auto px-4 mt-16 mb-20">
        <h2 className="font-semibold mb-4">FAQ</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { q: 'Is this functional?', a: 'This landing is non‑functional and runs offline. Animations are smooth and accessible.' },
            { q: 'Does it support dark mode?', a: 'Yes — toggle in the header. Preference persists.' },
            { q: 'Can I upload videos?', a: 'Not in this demo. It focuses on structure and motion only.' },
            { q: 'Is performance optimized?', a: 'Yes — CSS‑only background, reduced motion support, and responsive design.' },
          ].map((f, i) => (
            <div key={i} className="glass rounded-xl p-5">
              <div className="font-medium">{f.q}</div>
              <div className="text-sm text-muted-foreground mt-1">{f.a}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Index;
