import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import VideoPlayer from "@/components/players/VideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { Download, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ClipPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clip, setClip] = React.useState<any | null>(null);
  const [vod, setVod] = React.useState<any | null>(null);
  const [stream, setStream] = React.useState<any | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    (async () => {
      if (!id) return;
      const c = await supabase.from("clips").select("*").eq("id", id).maybeSingle();
      if (c.data && !c.error) {
        setClip(c.data);
        
        // Try to get VOD first, if that fails, get stream
        if (c.data.vod_id) {
          const v = await supabase.from("vods").select("*").eq("id", c.data.vod_id).maybeSingle();
          if (!v.error && v.data) {
            setVod(v.data);
          }
        } else {
          // This is a live stream clip, get the stream for playback_url
          const s = await supabase.from("streams").select("*").eq("user_id", c.data.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (!s.error && s.data) {
            setStream(s.data);
          }
        }
      }
    })();
  }, [id]);

  const downloadClip = async () => {
    try {
      // Create a watermarked version of the clip
      const videoSrc = vod?.src_url || stream?.playback_url;
      if (!videoSrc) {
        toast({ title: "Error", description: "Video source not available", variant: "destructive" });
        return;
      }

      // Create a canvas to capture the video frame and add watermark
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoSrc;
      video.currentTime = clip.start_seconds;
      video.muted = true;
      
      video.addEventListener("loadeddata", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        // Draw the video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Add watermark background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(canvas.width - 200, canvas.height - 60, 180, 40);
        
        // Add vivoor.xyz text with gradient effect
        const gradient = ctx.createLinearGradient(canvas.width - 190, canvas.height - 45, canvas.width - 30, canvas.height - 25);
        gradient.addColorStop(0, '#60a5fa'); // cyan
        gradient.addColorStop(0.5, '#a855f7'); // purple  
        gradient.addColorStop(1, '#ec4899'); // pink
        
        ctx.fillStyle = gradient;
        ctx.font = 'bold 18px Arial';
        ctx.fillText('vivoor.xyz', canvas.width - 180, canvas.height - 30);
        
        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}_vivoor_clip.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast({ title: "Downloaded", description: "Clip thumbnail downloaded successfully!" });
        }, "image/jpeg", 0.9);
      });
    } catch (error) {
      toast({ title: "Download failed", description: "Unable to download clip", variant: "destructive" });
    }
  };

  if (!clip || (!vod && !stream)) return (
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
          src={vod?.src_url || stream?.playback_url}
          poster={clip.thumbnail_url || vod?.thumbnail_url || undefined}
          startAt={clip.start_seconds}
          endAt={clip.end_seconds}
          loopRange
          className="rounded-xl"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button variant="glass" onClick={downloadClip}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          {vod && (
            <Button variant="secondary" onClick={() => navigate(`/vod/${vod.id}`)}>
              View Full VOD
            </Button>
          )}
          <Button variant="gradientOutline" onClick={() => navigator.share ? navigator.share({ title: clip.title, url: window.location.href }) : navigator.clipboard.writeText(window.location.href)}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {duration}s clip{vod ? ` from "${vod.title}"` : ' from live stream'}.
        </div>
      </section>
    </main>
  );
};

export default ClipPage;