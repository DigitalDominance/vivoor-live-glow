import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import VideoPlayer from "@/components/players/VideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface VodLike {
  id: string;
  src_url: string;
  title: string;
  duration_seconds?: number | null;
}

interface ClipCreatorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vod: VodLike;
  onCreated?: (clipId: string) => void;
}

const secondsToTs = (s: number) => {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

const ClipCreator: React.FC<ClipCreatorProps> = ({ open, onOpenChange, vod, onCreated }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [range, setRange] = useState<[number, number]>([0, Math.min(30, vod.duration_seconds || 30)]);
  const [title, setTitle] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setRange([0, Math.min(30, vod.duration_seconds || 30)]);
      setTitle("");
    }
  }, [open, vod.duration_seconds]);

  const captureThumbnail = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = vod.src_url;
      video.currentTime = range[0];
      video.muted = true;
      video.addEventListener("loadeddata", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
      });
      video.addEventListener("error", () => resolve(null));
    });
  };

  const createClip = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      toast({ title: "Login required", description: "Sign in to create clips.", variant: "destructive" });
      return;
    }

    const start = Math.max(0, Math.floor(range[0]));
    const end = Math.max(start + 1, Math.floor(range[1]));

    // Upload thumbnail
    let thumbnail_url: string | null = null;
    try {
      const blob = await captureThumbnail();
      if (blob) {
        const path = `${user.user.id}/thumbnails/${vod.id}-${Date.now()}.jpg`;
        const up = await supabase.storage.from("clips").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (up.data) {
          const { data: pub } = supabase.storage.from("clips").getPublicUrl(path);
          thumbnail_url = pub.publicUrl;
        }
      }
    } catch {}

    const insert = await supabase.from("clips").insert({
      vod_id: vod.id,
      user_id: user.user.id,
      title: title || `${vod.title} — Clip (${secondsToTs(start)}-${secondsToTs(end)})`,
      start_seconds: start,
      end_seconds: end,
      thumbnail_url: thumbnail_url,
    }).select("id").maybeSingle();

    if (insert.error || !insert.data) {
      toast({ title: "Failed to create clip", description: insert.error?.message || "Try again.", variant: "destructive" });
      return;
    }

    toast({ title: "Clip created", description: "Your clip is ready to share." });
    onOpenChange(false);
    onCreated?.(insert.data.id);
  };

  const maxDur = Math.max(vod.duration_seconds || 0, range[1]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create a clip</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <VideoPlayer src={vod.src_url} startAt={range[0]} endAt={range[1]} loopRange className="rounded-lg" />
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
              className="mt-1 w-full rounded-md bg-background px-3 py-2 text-sm border border-border"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{secondsToTs(range[0])}</span>
              <span>{secondsToTs(range[1])}</span>
            </div>
            <Slider
              value={[range[0], range[1]]}
              min={0}
              max={Math.max(30, maxDur || 30)}
              step={1}
              onValueChange={(v) => setRange([v[0], v[1]] as [number, number])}
            />
            <div className="text-xs text-muted-foreground mt-1">Drag the handles to choose your moment.</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="hero" onClick={createClip}>Create Clip</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClipCreator;
