import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { Download, Play, Trash2, Eye, Heart, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Clip {
  id: string;
  title: string;
  start_seconds: number;
  end_seconds: number;
  thumbnail_url?: string;
  download_url?: string;
  created_at: string;
  views: number;
  vod_id?: string;
}

interface MyClipsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MyClipsModal: React.FC<MyClipsModalProps> = ({ open, onOpenChange }) => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(false);
  const { identity } = useWallet();
  const { toast } = useToast();

  const fetchClips = async () => {
    if (!identity?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('user_id', identity.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClips(data || []);
    } catch (error) {
      console.error('Error fetching clips:', error);
      toast({
        title: "Error loading clips",
        description: "Failed to load your clips. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && identity?.id) {
      fetchClips();
    }
    
    // Set up real-time subscription for new clips
    if (open && identity?.id) {
      const channel = supabase
        .channel('user-clips')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'clips',
            filter: `user_id=eq.${identity.id}`
          },
          () => {
            fetchClips(); // Refresh clips when new ones are added
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, identity?.id]);

  const downloadClip = async (clip: Clip) => {
    try {
      // For now, we'll generate a shareable link since we don't have direct video file access
      const clipUrl = `${window.location.origin}/clip/${clip.id}`;
      await navigator.clipboard.writeText(clipUrl);
      toast({
        title: "Clip link copied",
        description: "The shareable link has been copied to your clipboard."
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download clip. Please try again.",
        variant: "destructive"
      });
    }
  };

  const deleteClip = async (clipId: string) => {
    try {
      const { error } = await supabase
        .from('clips')
        .delete()
        .eq('id', clipId);

      if (error) throw error;

      setClips(clips.filter(clip => clip.id !== clipId));
      toast({
        title: "Clip deleted",
        description: "Your clip has been deleted successfully."
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Unable to delete clip. Please try again.",
        variant: "destructive"
      });
    }
  };

  const formatDuration = (startSeconds: number, endSeconds: number) => {
    const duration = endSeconds - startSeconds;
    return `${duration}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto border-0 bg-background/95 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/20 via-brand-iris/10 to-brand-pink/20 rounded-lg -z-10" />
        
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent text-center">
            My Clips
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative rounded-xl overflow-hidden border border-border/20 bg-background/40 backdrop-blur-xl animate-pulse p-0.5 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink"
                >
                  <div className="relative rounded-xl overflow-hidden bg-background h-full">
                    <div className="aspect-video bg-gradient-to-br from-brand-cyan/10 via-brand-iris/10 to-brand-pink/10" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gradient-to-r from-brand-cyan/20 to-brand-iris/20 rounded" />
                      <div className="h-3 bg-gradient-to-r from-brand-iris/20 to-brand-pink/20 rounded w-2/3" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : clips.length === 0 ? (
            <div className="text-center py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="text-6xl opacity-20">🎬</div>
                <h3 className="text-xl font-semibold text-muted-foreground">No clips yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Start watching live streams and create your first clip! Clips will appear here once you create them.
                </p>
              </motion.div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {clips.map((clip, index) => (
                <motion.div
                  key={clip.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative rounded-xl backdrop-blur-xl hover:shadow-2xl hover:shadow-brand-iris/10 transition-all duration-500 p-0.5 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink"
                >
                  {/* Inner content container */}
                  <div className="relative rounded-xl overflow-hidden bg-background h-full"
                    style={{
                      background: `linear-gradient(135deg, 
                        hsl(var(--background) / 0.95) 0%, 
                        hsl(var(--background) / 0.8) 50%, 
                        hsl(var(--background) / 0.95) 100%)`
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-video cursor-pointer overflow-hidden rounded-t-xl"
                      onClick={() => window.open(`/clip/${clip.id}`, '_blank')}
                    >
                      {clip.download_url ? (
                        <video
                          className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                          muted
                          playsInline
                          preload="metadata"
                          poster={clip.thumbnail_url || undefined}
                          controls={false}
                          webkit-playsinline="true"
                          onMouseEnter={(e) => {
                            if (window.innerWidth > 768) {
                              const video = e.currentTarget;
                              video.currentTime = 0.5;
                              video.play().catch(() => {});
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (window.innerWidth > 768) {
                              const video = e.currentTarget;
                              video.pause();
                            }
                          }}
                        >
                          <source src={clip.download_url} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      ) : clip.thumbnail_url ? (
                        <img
                          src={clip.thumbnail_url}
                          alt={clip.title}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 flex items-center justify-center">
                          <Play className="size-12 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-background/90 backdrop-blur-sm hover:bg-background scale-75 group-hover:scale-100"
                        >
                          <Play className="size-5 fill-current" />
                        </Button>
                      </div>
                      
                      {/* Duration */}
                      <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/90 text-white text-xs font-medium backdrop-blur-sm z-10">
                        {Math.floor((clip.end_seconds - clip.start_seconds) / 60)}:
                        {String((clip.end_seconds - clip.start_seconds) % 60).padStart(2, '0')}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-medium text-sm mb-2 line-clamp-2 cursor-pointer hover:text-primary transition-colors text-foreground" 
                          onClick={() => window.open(`/clip/${clip.id}`, '_blank')}>
                        {clip.title}
                      </h3>
                      
                      {/* Date */}
                      <div className="text-xs text-muted-foreground mb-3">
                        {formatDate(clip.created_at)}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Eye className="size-3" />
                          {clip.views || 0}
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="size-3" />
                          0
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/clip/${clip.id}`, '_blank')}
                          className="flex-1 h-8 text-xs hover:bg-brand-cyan/10 hover:text-brand-cyan transition-all duration-200"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadClip(clip)}
                          className="h-8 px-2 hover:bg-brand-iris/10 hover:text-brand-iris transition-all duration-200"
                          title="Copy link"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteClip(clip.id)}
                          className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                          title="Delete clip"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyClipsModal;