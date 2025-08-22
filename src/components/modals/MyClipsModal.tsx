import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { Download, Play, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Clip {
  id: string;
  title: string;
  start_seconds: number;
  end_seconds: number;
  thumbnail_url?: string;
  created_at: string;
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>My Clips</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : clips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              You haven't created any clips yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clips.map((clip) => (
                <div key={clip.id} className="glass rounded-lg p-4 space-y-3">
                  {clip.thumbnail_url && (
                    <img 
                      src={clip.thumbnail_url} 
                      alt={clip.title}
                      className="w-full h-32 object-cover rounded-md"
                    />
                  )}
                  
                  <div>
                    <h3 className="font-medium text-sm line-clamp-2">{clip.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDuration(clip.start_seconds, clip.end_seconds)} • {formatDate(clip.created_at)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/clip/${clip.id}`, '_blank')}
                      className="flex-1"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadClip(clip)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteClip(clip.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyClipsModal;