import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import VideoPlayer from "@/components/players/VideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useWallet } from "@/context/WalletContext";
import { useQueryClient } from "@tanstack/react-query";

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
  const [duration, setDuration] = useState<10 | 30 | 60>(10);
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const { identity } = useWallet();
  const queryClient = useQueryClient();

  // Calculate the clip range from current time backwards
  const currentTime = Math.min(vod.duration_seconds || 60, 60); // Default to 60s if no duration
  const startTime = Math.max(0, currentTime - duration);
  const endTime = currentTime;

  useEffect(() => {
    if (!open) {
      setDuration(10);
      setTitle("");
    }
  }, [open]);

  const captureThumbnail = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = vod.src_url;
      video.currentTime = startTime;
      video.muted = true;
      video.addEventListener("loadeddata", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        
        // Draw the video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Add watermark
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width - 150, canvas.height - 40, 140, 30);
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText('vivoor.xyz', canvas.width - 140, canvas.height - 20);
        
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
      });
      video.addEventListener("error", () => resolve(null));
    });
  };

  const createClip = async () => {
    console.log('Identity check:', identity);
    if (!identity?.id) {
      console.log('No identity found, showing login required');
      toast({ title: "Login required", description: "Connect your wallet to create clips.", variant: "destructive" });
      return;
    }
    console.log('Identity found, proceeding with clip creation:', identity.id);

    const start = Math.max(0, Math.floor(startTime));
    const end = Math.max(start + 1, Math.floor(endTime));

    // Upload thumbnail
    let thumbnail_url: string | null = null;
    try {
      const blob = await captureThumbnail();
      if (blob) {
        const path = `${identity.id}/thumbnails/${vod.id}-${Date.now()}.jpg`;
        const up = await supabase.storage.from("clips").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (up.data) {
          const { data: pub } = supabase.storage.from("clips").getPublicUrl(path);
          thumbnail_url = pub.publicUrl;
        }
      }
    } catch {}

    // Handle clips from live streams by not requiring a VOD ID
    const clipData: any = {
      user_id: identity.id,
      title: title || `${vod.title} — Clip (${duration}s)`,
      start_seconds: start,
      end_seconds: end,
      thumbnail_url: thumbnail_url,
    };

    // Only add vod_id if it's a real VOD, not a live stream
    if (vod.id && vod.id !== 'live-stream' && !vod.id.startsWith('live-')) {
      clipData.vod_id = vod.id;
    }

    const insert = await supabase.from("clips").insert(clipData).select("id").maybeSingle();

    if (insert.error || !insert.data) {
      toast({ title: "Failed to create clip", description: insert.error?.message || "Try again.", variant: "destructive" });
      return;
    }

    // Show success with download options
    const clipUrl = `${window.location.origin}/clip/${insert.data.id}`;
    
    toast({ 
      title: "Clip created successfully!", 
      description: "Your clip is ready to share. Check 'My Clips' in your profile menu."
    });
    
    // Auto-copy link to clipboard
    try {
      await navigator.clipboard.writeText(clipUrl);
      setTimeout(() => {
        toast({ title: "Link copied", description: "Clip link copied to clipboard." });
      }, 1000);
    } catch (error) {
      console.log('Clipboard copy failed:', error);
    }
    
    onOpenChange(false);
    onCreated?.(insert.data.id);
    
    // Invalidate clips queries to refresh the clips page
    queryClient.invalidateQueries({ queryKey: ['clips'] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create a clip from the last {duration} seconds</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <VideoPlayer src={vod.src_url} startAt={startTime} endAt={endTime} loopRange className="rounded-lg" />
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
            <label className="text-sm font-medium mb-2 block">Clip Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) as 10 | 30 | 60)}
              className="w-full rounded-md bg-background px-3 py-2 text-sm border border-border"
            >
              <option value={10}>Last 10 seconds</option>
              <option value={30}>Last 30 seconds</option>
              <option value={60}>Last 1 minute</option>
            </select>
            <div className="text-xs text-muted-foreground mt-2">
              Clip will be from {secondsToTs(startTime)} to {secondsToTs(endTime)}
            </div>
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
