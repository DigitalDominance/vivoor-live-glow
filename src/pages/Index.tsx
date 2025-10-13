import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Repeat,
  Scissors,
  Play,
  Radio,
  Circle,
  Heart,
  Eye,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import ClipVerifiedBadge from "@/components/ClipVerifiedBadge";
import UserKnsBadge from "@/components/UserKnsBadge";
import UserKaspersBadge from "@/components/UserKaspersBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import SwapWidget from "@/components/SwapWidget";

/*
 * This page renders the Vivoor home screen. Several small improvements have
 * been made relative to the original version:
 *
 * - The swap widget heading now uses the cyan→iris→pink gradient to match
 *   other headings on the site.
 * - The FAQ accordion trigger no longer hides its text on hover. We do
 *   this by avoiding the gradient text class on hover and instead
 *   maintaining the regular foreground colour.
 */

const LivePill = ({ label, delay }: { label: string; delay: number }) => (
  <motion.div
    className="px-3 py-1 rounded-full text-xs font-medium gradient-border bg-background/70 text-foreground/90 backdrop-blur"
    initial={{ y: 0, opacity: 0 }}
    animate={{ y: [0, -6, 0], opacity: 1 }}
    transition={{ duration: 6, repeat: Infinity, delay, ease: "easeInOut" }}
  >
    <span className="inline-flex items-center gap-1">
      <Radio className="size-3 text-[hsl(var(--brand-pink))]" /> {label}
    </span>
  </motion.div>
);

const PlayerMock = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayDemo = () => {
    setIsPlaying(true);
  };

  if (isPlaying) {
    return (
      <div className="relative rounded-2xl p-[1px] bg-grad-primary shadow-[0_10px_40px_-12px_hsl(var(--brand-iris)/0.5)]">
        <div className="relative rounded-2xl bg-background/70 backdrop-blur-md border border-border overflow-hidden">
          <div className="aspect-[16/9]">
            <video
              src="https://qcowmxypihinteajhnjw.supabase.co/storage/v1/object/public/clips/vivoordemo.mp4"
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl p-[1px] bg-grad-primary shadow-[0_10px_40px_-12px_hsl(var(--brand-iris)/0.5)]">
      <div className="relative rounded-2xl bg-background/70 backdrop-blur-md border border-border overflow-hidden">
        <div className="aspect-[16/9] flex items-center justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] bg-[length:200%_100%] animate-shimmer" />
          <div className="w-4/5 h-24 rounded-md bg-gradient-to-r from-foreground/15 via-foreground/5 to-foreground/15 bg-[length:200%_100%] animate-shimmer" />
          <Button variant="hero" size="lg" className="absolute bottom-4 right-4" onClick={handlePlayDemo}>
            <Play /> Play demo
          </Button>
        </div>
      </div>
    </div>
  );
};

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
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground mb-3">
            <div className="relative p-0.5 rounded-full bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink shadow-lg shadow-brand-iris/30">
              <Avatar className="size-7">
                <AvatarImage
                  src={clip.profile_avatar_url || ''}
                  alt={`@${clip.profile_handle} avatar`}
                />
                <AvatarFallback className="text-xs">
                  {clip.profile_display_name?.[0]?.toUpperCase() ||
                    clip.profile_handle?.[0]?.toUpperCase() ||
                    'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">@{clip.profile_handle || 'Unknown'}</span>
              <ClipVerifiedBadge userId={clip.user_id} size="sm" />
              <UserKaspersBadge userId={clip.user_id} size="sm" />
              <UserKnsBadge userId={clip.user_id} size="sm" />
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
      const { data, error } = await supabase.rpc(
        'get_clips_with_profiles_and_stats',
        {
          _limit: 10,
          _offset: 0,
          _search: null,
          _order_by: 'likes',
        },
      );
      if (error) {
        console.error('Error fetching top clips:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const handleClipClick = async (clipId: string) => {
    try {
      await supabase.rpc('increment_clip_views', { clip_id_param: clipId });
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
    navigate(`/clip/${clipId}`);
  };

  return (
    <main id="top">
      <Helmet>
        <title>Vivoor - Kaspa Live Streaming Platform | Stream & Earn KAS</title>
        <meta
          name="description"
          content="Join the premier live streaming platform built for the Kaspa community. Stream live, receive KAS tips from viewers, and discover amazing content creators. Start earning with your streams today."
        />
        <meta
          name="keywords"
          content="Kaspa streaming, KAS tips, crypto streaming, live streaming, blockchain streaming, kaspa community, earn crypto streaming, kaspa live, vivoor streaming"
        />
        <link rel="canonical" href="https://vivoor.live/" />
        {/* Additional Open Graph for home page */}
        <meta
          property="og:title"
          content="Vivoor - Kaspa Live Streaming Platform | Stream & Earn KAS"
        />
        <meta
          property="og:description"
          content="Join the premier live streaming platform built for the Kaspa community. Stream live, receive KAS tips, and discover amazing content creators."
        />
        <meta property="og:url" content="https://vivoor.live/" />
        {/* JSON-LD for home page */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Vivoor',
            description:
              'Live streaming platform for the Kaspa community with integrated KAS tipping',
            url: 'https://vivoor.live',
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'Web Browser',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            featureList: [
              'Live Streaming',
              'KAS Cryptocurrency Tips',
              'Real-time Chat',
              'Stream Recording',
              'Clip Creation',
              'Multi-category Content',
            ],
            softwareRequirements: 'Web Browser with JavaScript enabled',
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
              The world's first Kaspa-powered streaming platform. Stream live, earn
              with zero-fee KAS tips, and build your community on decentralized
              infrastructure powered by Livepeer.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="hero" size="lg" onClick={() => navigate('/go-live')}>
                Start Streaming
              </Button>
              <Button variant="glass" size="lg" onClick={() => navigate('/docs')}>
                Read Documentation
              </Button>
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
          <p className="text-sm font-medium">
            Built on{' '}
            <a
              href="https://kaspa.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gradient font-semibold hover:underline"
            >
              Kaspa
            </a>{' '}
            +{' '}
            <a
              href="https://www.livepeer.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gradient font-semibold hover:underline"
            >
              Livepeer
            </a>{' '}
            = Pioneering Streaming with a Web3 Zero-Fee Creator Economy.
          </p>
        </div>
      </section>
      {/* Feature Trio */}
      <section id="features" className="container mx-auto px-4 mt-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={Zap}
            title="Zero-Fee Tips"
            desc="100% of KAS tips go to creators. We take 0% platform fees, powered by Kaspa blockchain."
          />
          <FeatureCard
            icon={Repeat}
            title="Instant Streaming"
            desc="Go live in seconds with Livepeer's decentralized video infrastructure."
          />
          <FeatureCard
            icon={Scissors}
            title="Auto Clipping"
            desc="Create and share highlights instantly with automatic processing."
          />
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
                <ClipCard key={clip.id} clip={clip} onClick={() => handleClipClick(clip.id)} />
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
            { title: 'Go Live', desc: 'One tap to start streaming with ultra-low latency.' },
            { title: 'Auto Clipping', desc: 'Create highlights instantly with automatic processing and AI detection.' },
            { title: 'Share Clips', desc: 'Share your best moments anywhere with beautiful previews.' },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="glass rounded-xl p-5"
              whileInView={{ opacity: [0, 1], y: [8, 0] }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="text-sm text-muted-foreground">Step {i + 1}</div>
              <h3 className="font-semibold mt-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
      {/* Testimonials Ticker */}
      <section className="container mx-auto px-4 mt-16">
        <div className="overflow-hidden rounded-xl p-[1.5px] bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink">
          <div className="rounded-xl bg-background">
            <div className="flex animate-marquee gap-8 py-4 will-change-transform hover:[animation-play-state:paused]">
              {[
                '"Zero fees on tips is game changing" - Alberto',
                '"Kaspa tips arrive instantly" - Cesar',
                '"Finally a platform that doesn\'t steal from creators" - Jonathan',
                '"Fastest go‑live I’ve used" - Alex',
                '"The clip feature is absolutely perfect" - David',
              ]
                .concat([
                  '"Zero fees on tips is game changing" - Alberto',
                  '"Kaspa tips arrive instantly" - Cesar',
                  '"Finally a platform that doesn\'t steal from creators" - Jonathan',
                  '"Fastest go‑live I’ve used" - Alex',
                  '"The clip feature is absolutely perfect" - David',
                ])
                .map((q, i) => (
                  <span key={i} className="text-sm text-muted-foreground whitespace-nowrap ">
                    {q}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </section>
      {/* Instant Tips */}
      <section id="instant-tips" className="container mx-auto px-4 mt-16">
        <h2 className="font-semibold mb-4">Instant Tips on Kaspa</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="size-4 text-[hsl(var(--brand-pink))]" /> Near-instant
            </div>
            <div className="mt-2 text-lg font-bold">Tips settle in seconds</div>
            <p className="text-sm text-muted-foreground mt-2">Kaspa's blockDAG confirms fast: creators see KAS almost immediately.</p>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Circle className="size-4 text-[hsl(var(--brand-iris))]" /> 0% Platform Fee
            </div>
            <div className="mt-2 text-lg font-bold">100% goes to creators</div>
            <p className="text-sm text-muted-foreground mt-2">We take 0% platform fees unlike major streaming platforms that take up to 50%.</p>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Repeat className="size-4 text-[hsl(var(--brand-cyan))]" /> Transparent
            </div>
            <div className="mt-2 text-lg font-bold">On-chain and simple</div>
            <p className="text-sm text-muted-foreground mt-2">No middlemen, no hidden cuts. Direct, on-chain tipping in KAS.</p>
          </div>
        </div>
      </section>
      {/* Swap Widget */}
      <section className="container mx-auto px-4 mt-16">
        <div className="text-center mb-8">
          {/*
            Use a larger font size on bigger screens and apply the same gradient
            styling as other section headings. This helps unify visual
            hierarchy across the page.
          */}
          <h2 className="font-semibold text-2xl md:text-3xl mb-2 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
            Swap Crypto Instantly
          </h2>
          <p className="text-muted-foreground text-sm">
            Exchange Cryptocurrencies for Kaspa seamlessly
          </p>
        </div>
        {/*
          Extend the widget container width on desktop so it aligns with other
          sections on the page. Using max-w-7xl ensures the widget matches
          the overall page width rather than being constrained to 4xl.
        */}
        <div className="max-w-8xl mx-auto">
          <SwapWidget />
        </div>
      </section>
      {/* FAQ */}
      <section id="faq" className="container mx-auto px-4 mt-16 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          {/* Increase heading size and apply gradient matching other sections */}
          <h2 className="font-semibold mb-2 text-2xl md:text-3xl bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-sm">
            Everything you need to know about Vivoor
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          /*
            Increase the max width of the FAQ container so that the two-column
            layout matches the width of other content sections on the page.
            Using max-w-7xl keeps it consistent with the wider desktop layout.
          */
          className="max-w-8xl mx-auto"
        >
          {/* Display accordion items in two columns on medium+ screens */}
          <Accordion type="single" collapsible className="w-full grid gap-4 md:grid-cols-2">
            {[
              {
                q: 'How do I start streaming on Vivoor?',
                a: 'Connect your Kaspa wallet, go to /go-live, pay the 1.2 KAS treasury fee, and get your RTMP details for OBS streaming.',
              },
              {
                q: 'Do you really take 0% fees on tips?',
                a: 'Yes! Unlike traditional platforms that take 30-50% cuts, we take 0% from tips. 100% goes directly to creators.',
              },
              {
                q: 'What makes Kaspa better for tips?',
                a: 'Kaspa has sub-second confirmation times and ultra-low fees, making it perfect for instant micro-payments to creators.',
              },
              {
                q: 'How do I create clips from streams?',
                a: 'While watching any stream, click the scissors icon to create clips up to 60 seconds long. They process instantly via Livepeer.',
              },
              {
                q: 'Can I get verified on Vivoor?',
                a: 'Yes! Visit /verification to purchase monthly (100 KAS) or yearly (1000 KAS) verification for enhanced credibility and priority features.',
              },
              {
                q: 'What is Livepeer and why do you use it?',
                a: 'Livepeer is a decentralized video infrastructure that provides high-quality, low-latency streaming at 50x lower cost than traditional CDNs.',
              },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group"
              >
                <AccordionItem
                  value={`item-${i}`}
                  className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-r from-background via-background to-background hover:from-brand-cyan/5 hover:via-brand-iris/5 hover:to-brand-pink/5 transition-all duration-500 px-6 py-2"
                >
                  {/* Animated border gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink opacity-0 group-hover:opacity-20 transition-opacity duration-500 -z-10" />
                  {/* Floating particles effect */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(3)].map((_, idx) => (
                      <motion.div
                        key={idx}
                        className="absolute w-1 h-1 bg-gradient-to-r from-brand-cyan to-brand-iris rounded-full opacity-0 group-hover:opacity-60"
                        initial={{ x: -10, y: 20 }}
                        animate={{
                          x: [0, 100, 200],
                          y: [20, 10, 30],
                          opacity: [0, 0.6, 0],
                        }}
                        transition={{
                          duration: 3,
                          delay: idx * 0.5,
                          repeat: Infinity,
                          repeatType: 'loop',
                        }}
                        style={{
                          left: `${20 + idx * 30}%`,
                          top: `${30 + idx * 20}%`,
                        }}
                      />
                    ))}
                  </div>
                  <AccordionTrigger
                    className="font-medium hover:no-underline group-hover:text-foreground transition-all duration-300 py-4"
                  >
                    <motion.span
                      className="flex items-center gap-3"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full bg-gradient-to-r from-brand-cyan to-brand-iris relative top-[1px]"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                      />
                      {f.q}
                    </motion.span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="pl-5 relative"
                    >
                      {/* Answer highlight line */}
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-cyan via-brand-iris to-brand-pink opacity-60" />
                      {f.a}
                    </motion.div>
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>
      </section>
      {/* CTA */}
      <section className="container mx-auto px-4 mt-16">
        <div className="rounded-2xl p-[1px] bg-grad-primary">
          <div className="rounded-2xl bg-background/70 backdrop-blur-md p-8 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gradient">
              Your moment, in motion.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              Record and share your most exciting moments. With clipping, your
              highlights reach beyond the live moment.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Button
                variant="hero"
                size="lg"
                onClick={() => navigate('/go-live')}
              >
                Start Streaming
              </Button>
              <Button
                variant="glass"
                size="lg"
                onClick={() => navigate('/app')}
              >
                Explore Clips
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Index;
