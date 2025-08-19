import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import ClipCreator from "@/components/modals/ClipCreator";

type Vod = {
  id: string;
  title: string;
  created_at: string;
  thumbnail_url: string | null;
  src_url: string;
  duration_seconds: number | null;
};

type Clip = {
  id: string;
  title: string;
  created_at: string;
  thumbnail_url: string | null;
  start_seconds: number;
  end_seconds: number;
  vods: {
    title: string;
    src_url: string;
  };
};

const Recordings: React.FC = () => {
  const [vods, setVods] = useState<Vod[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [uploading, setUploading] = useState(false);
  const [clipModalOpen, setClipModalOpen] = useState(false);
  const [selectedVod, setSelectedVod] = useState<Vod | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadVods = async () => {
    const { data, error } = await supabase.from("vods").select("id,title,created_at,thumbnail_url,src_url,duration_seconds").order("created_at", { ascending: false });
    if (!error && data) setVods(data as Vod[]);
  };

  const loadClips = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    
    const { data, error } = await supabase
      .from("clips")
      .select(`
        id,
        title,
        created_at,
        thumbnail_url,
        start_seconds,
        end_seconds,
        vods!inner(title, src_url)
      `)
      .eq('user_id', user.user.id)
      .order("created_at", { ascending: false });
    
    if (!error && data) setClips(data as Clip[]);
  };

  useEffect(() => {
    loadVods();
    loadClips();
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

      <Tabs defaultValue="recordings" className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="clips">My Clips</TabsTrigger>
        </TabsList>
        
        <TabsContent value="recordings" className="mt-4">
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
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedVod(v);
                          setClipModalOpen(true);
                        }}
                      >
                        Create Clip
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="clips" className="mt-4">
          <div className="mb-2 font-medium">Your Clips</div>
          {clips.length === 0 ? (
            <div className="text-sm text-muted-foreground">No clips yet. Create clips from your recordings!</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map((clip) => (
                <div key={clip.id} className="glass rounded-xl overflow-hidden">
                  <div className="aspect-[16/9] bg-muted/20">
                    {clip.thumbnail_url ? (
                      <img src={clip.thumbnail_url} alt={`${clip.title} clip thumbnail`} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium truncate" title={clip.title}>{clip.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(clip.created_at).toLocaleString()} • {clip.end_seconds - clip.start_seconds}s
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      From: {clip.vods.title}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="glass" onClick={() => navigate(`/clip/${clip.id}`)}>View Clip</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ClipCreator 
        open={clipModalOpen}
        onOpenChange={setClipModalOpen}
        vod={selectedVod}
        onCreated={() => {
          loadClips();
          setSelectedVod(null);
        }}
      />
    </main>
  );
};

export default Recordings;
