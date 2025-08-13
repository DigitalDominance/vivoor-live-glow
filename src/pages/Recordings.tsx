import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

type Vod = {
  id: string;
  title: string;
  created_at: string;
  thumbnail_url: string | null;
  src_url: string;
  duration_seconds: number | null;
};

const Recordings: React.FC = () => {
  const [vods, setVods] = useState<Vod[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadVods = async () => {
    const { data, error } = await supabase.from("vods").select("id,title,created_at,thumbnail_url,src_url,duration_seconds").order("created_at", { ascending: false });
    if (!error && data) setVods(data as Vod[]);
  };

  useEffect(() => {
    loadVods();
  }, []);

  const captureThumb = (url: string): Promise<Blob | null> =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = url;
      video.muted = true;
      video.addEventListener("loadeddata", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
      });
      video.addEventListener("error", () => resolve(null));
    });

  const getVideoDuration = (url: string): Promise<number | null> =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = url; video.preload = "metadata"; video.muted = true;
      video.onloadedmetadata = () => resolve(isFinite(video.duration) ? Math.floor(video.duration) : null);
      video.onerror = () => resolve(null);
    });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      toast({ title: "Login required", description: "Sign in to upload recordings.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const path = `${user.user.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("vods").upload(path, file, { contentType: file.type, upsert: true });
      if (up.error || !up.data) throw up.error;
      const { data: pub } = supabase.storage.from("vods").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const duration = await getVideoDuration(publicUrl);

      // thumbnail
      let thumbUrl: string | null = null;
      const blob = await captureThumb(publicUrl);
      if (blob) {
        const tpath = `${user.user.id}/thumbnails/${Date.now()}.jpg`;
        const tuf = await supabase.storage.from("vods").upload(tpath, blob, { contentType: "image/jpeg", upsert: true });
        if (tuf.data) {
          const { data: tpub } = supabase.storage.from("vods").getPublicUrl(tpath);
          thumbUrl = tpub.publicUrl;
        }
      }

      const title = file.name.replace(/\.[^/.]+$/, "");
      const ins = await supabase.from("vods").insert({
        user_id: user.user.id,
        title,
        src_url: publicUrl,
        thumbnail_url: thumbUrl,
        duration_seconds: duration,
      }).select("id").maybeSingle();

      if (ins.error || !ins.data) throw ins.error;

      toast({ title: "Uploaded", description: "Recording saved as a replay." });
      await loadVods();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  };

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>My Recordings — Vivoor</title>
        <meta name="description" content="View and manage your past Vivoor streams and recordings." />
        <link rel="canonical" href="/recordings" />
      </Helmet>
      <h1 className="sr-only">My Recordings</h1>

      <section className="rounded-xl border border-border p-4 bg-card/60 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm text-muted-foreground">Upload a finished stream to create a replay.</div>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex">
              <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
              <Button asChild variant="hero" disabled={uploading}>
                <span>{uploading ? "Uploading…" : "Upload Replay"}</span>
              </Button>
            </label>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 font-medium">Your Replays</div>
        {vods.length === 0 ? (
          <div className="text-sm text-muted-foreground">No replays yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vods.map((v) => (
              <div key={v.id} className="glass rounded-xl overflow-hidden">
                <div className="aspect-[16/9] bg-muted/20">
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={`${v.title} replay thumbnail`} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium truncate" title={v.title}>{v.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="glass" onClick={() => navigate(`/vod/${v.id}`)}>View VOD</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default Recordings;
