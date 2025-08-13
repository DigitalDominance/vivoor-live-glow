import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import VideoPlayer from "@/components/players/VideoPlayer";
import { supabase } from "@/integrations/supabase/client";

const ClipPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clip, setClip] = React.useState<any | null>(null);
  const [vod, setVod] = React.useState<any | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!id) return;
      const c = await supabase.from("clips").select("*").eq("id", id).maybeSingle();
      if (c.data && !c.error) {
        setClip(c.data);
        const v = await supabase.from("vods").select("*").eq("id", c.data.vod_id).maybeSingle();
        if (!v.error) setVod(v.data);
      }
    })();
  }, [id]);

  if (!clip || !vod) return (
    <main className="container mx-auto px-4 py-6">
      <div className="text-sm text-muted-foreground">Clip not found.</div>
    </main>
  );

  const duration = Math.max(1, (clip.end_seconds ?? 0) - (clip.start_seconds ?? 0));

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>{clip.title} — Clip on Vivoor</title>
        <meta name="description" content={`Watch clip: ${clip.title}`} />
        <link rel="canonical" href={`/clip/${clip.id}`} />
      </Helmet>
      <h1 className="sr-only">{clip.title}</h1>

      <section>
        <VideoPlayer
          src={vod.src_url}
          poster={clip.thumbnail_url || vod.thumbnail_url || undefined}
          startAt={clip.start_seconds}
          endAt={clip.end_seconds}
          loopRange
          className="rounded-xl"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button variant="glass" onClick={() => navigate(`/vod/${vod.id}`)}>View Full VOD</Button>
          <Button variant="gradientOutline" onClick={() => navigator.share ? navigator.share({ title: clip.title, url: window.location.href }) : navigator.clipboard.writeText(window.location.href)}>Share</Button>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">{duration}s clip from “{vod.title}”.</div>
      </section>
    </main>
  );
};

export default ClipPage;
