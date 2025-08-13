import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import VideoPlayer from "@/components/players/VideoPlayer";
import ClipCreator from "@/components/modals/ClipCreator";
import { supabase } from "@/integrations/supabase/client";

const Vod: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vod, setVod] = React.useState<any | null>(null);
  const [clips, setClips] = React.useState<any[]>([]);
  const [openClip, setOpenClip] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!id) return;
    const v = await supabase.from("vods").select("*").eq("id", id).maybeSingle();
    if (!v.error) setVod(v.data);
    const c = await supabase.from("clips").select("*").eq("vod_id", id).order("created_at", { ascending: false });
    if (!c.error && c.data) setClips(c.data);
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  if (!vod) return (
    <main className="container mx-auto px-4 py-6">
      <div className="text-sm text-muted-foreground">Replay not found.</div>
    </main>
  );

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>{vod.title} — Replay on Vivoor</title>
        <meta name="description" content={`Watch replay: ${vod.title}`} />
        <link rel="canonical" href={`/vod/${vod.id}`} />
      </Helmet>
      <h1 className="sr-only">{vod.title}</h1>

      <section>
        <VideoPlayer src={vod.src_url} poster={vod.thumbnail_url || undefined} className="rounded-xl" />
        <div className="mt-3 flex items-center gap-2">
          <Button variant="gradientOutline" onClick={() => setOpenClip(true)}>Create Clip</Button>
          <Button variant="glass" onClick={() => navigate("/recordings")}>Back to Recordings</Button>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 font-medium">Clips</div>
        {clips.length === 0 ? (
          <div className="text-sm text-muted-foreground">No clips yet. Be the first to capture a moment.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clips.map((c) => (
              <div key={c.id} className="glass rounded-xl overflow-hidden cursor-pointer" onClick={() => navigate(`/clip/${c.id}`)}>
                <div className="aspect-[16/9] bg-muted/20">
                  {c.thumbnail_url ? (
                    <img src={c.thumbnail_url} alt={`${c.title} clip thumbnail`} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium truncate" title={c.title}>{c.title}</div>
                  <div className="text-xs text-muted-foreground">{Math.max(1, c.end_seconds - c.start_seconds)}s</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ClipCreator open={openClip} onOpenChange={setOpenClip} vod={vod} onCreated={(cid) => { setOpenClip(false); load(); navigate(`/clip/${cid}`); }} />
    </main>
  );
};

export default Vod;
