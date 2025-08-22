import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, Share2, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

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
    if (!clip.download_url) {
      toast({ title: "Error", description: "Download URL not available", variant: "destructive" });
      return;
    }

    try {
      // Download the watermarked MP4 clip
      const link = document.createElement('a');
      link.href = clip.download_url;
      link.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}_vivoor_clip.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Downloaded", description: "Clip downloaded successfully!" });
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
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 via-brand-iris/5 to-brand-pink/5 -z-10" />
      
      <main className="container mx-auto px-4 py-6">
        <Helmet>
          <title>{clip.title} — Clip on Vivoor</title>
          <meta name="description" content={`Watch clip: ${clip.title}`} />
          <link rel="canonical" href={`/clip/${clip.id}`} />
        </Helmet>
        <h1 className="sr-only">{clip.title}</h1>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          {/* Video Container */}
          <div className="glass rounded-xl p-6 border border-border/50">
            <div className="aspect-video bg-background/50 rounded-lg overflow-hidden mb-4">
              {clip.download_url ? (
                <video
                  src={clip.download_url}
                  controls
                  className="w-full h-full object-contain"
                  poster={clip.thumbnail_url}
                  preload="metadata"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="text-center"
                  >
                    <Play className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Video not available</p>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Clip Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-gradient">{clip.title}</h2>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button 
                  onClick={downloadClip}
                  className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink hover:shadow-lg hover:shadow-brand-iris/20 transition-all duration-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download MP4
                </Button>
                
                {vod && (
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/vod/${vod.id}`)}
                    className="border-brand-iris/30 hover:bg-brand-iris/10 hover:border-brand-iris/50 transition-all duration-300"
                  >
                    View Full VOD
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const shareData = { title: clip.title, url: window.location.href };
                    if (navigator.share) {
                      navigator.share(shareData);
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      toast({ title: "Link copied", description: "Clip link copied to clipboard" });
                    }
                  }}
                  className="border-brand-cyan/30 hover:bg-brand-cyan/10 hover:border-brand-cyan/50 transition-all duration-300"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>

              <div className="text-sm text-muted-foreground p-4 bg-background/30 rounded-lg border border-border/20">
                <p>⏱️ {duration}s clip{vod ? ` from "${vod.title}"` : ' from live stream'}</p>
                <p className="mt-1">💎 Watermarked with Vivoor branding</p>
              </div>
            </motion.div>
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default ClipPage;