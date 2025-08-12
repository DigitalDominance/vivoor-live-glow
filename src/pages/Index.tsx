import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, Repeat, Scissors, Play, Radio, Circle } from "lucide-react";
import { Helmet } from "react-helmet-async";

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

const CreatorCard = ({ name, live }: { name: string; live?: boolean }) => (
  <div className="snap-start shrink-0 w-64 glass rounded-xl p-4 mr-4">
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-full bg-grad-primary p-[2px]">
        <div className="size-full rounded-full bg-background" />
      </div>
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{live ? "LIVE" : "OFFLINE"}</div>
      </div>
    </div>
    <div className="mt-3 h-28 rounded-lg bg-grad-primary opacity-80" />
  </div>
);

const Index = () => {
  return (
    <main id="top">
      <Helmet>
        <title>Vivoor — Go live in seconds. Replay forever.</title>
        <meta name="description" content="Built on Kaspa. Stream live with instant replays and one‑tap clips." />
        <link rel="canonical" href="/" />
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

      {/* Creator Showcase */}
      <section id="creators" className="container mx-auto px-4 mt-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Creator Showcase</h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar snap-x snap-mandatory pb-2 -mx-4 pl-4">
          <div className="flex w-max">
            {Array.from({ length: 10 }).map((_, i) => (
              <CreatorCard key={i} name={`@creator_${i + 1}`} live={i % 3 === 0} />
            ))}
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

      {/* Pricing (placeholder) */}
      <section id="pricing" className="container mx-auto px-4 mt-16">
        <h2 className="font-semibold mb-4">Pricing</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {['Starter', 'Creator', 'Studio'].map((tier, i) => (
            <div key={tier} className="glass rounded-xl p-6">
              <div className="text-sm text-muted-foreground">{tier}</div>
              <div className="mt-2 text-2xl font-bold">${(i + 1) * 5}/mo</div>
              <p className="text-sm text-muted-foreground mt-2">Beautiful placeholder pricing copy.</p>
              <Button className="mt-4" variant={i === 1 ? 'hero' : 'gradientOutline'}>Choose</Button>
            </div>
          ))}
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
