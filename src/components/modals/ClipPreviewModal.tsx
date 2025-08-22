import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, ExternalLink, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface ClipPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clipData: {
    clipId: string;
    downloadUrl: string;
    playbackUrl?: string;
    thumbnailUrl?: string;
    title: string;
  } | null;
}

const ClipPreviewModal: React.FC<ClipPreviewModalProps> = ({
  open,
  onOpenChange,
  clipData
}) => {
  const { toast } = useToast();

  if (!clipData) return null;

  const handleDownload = () => {
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = clipData.downloadUrl;
    link.download = `${clipData.title}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download started",
      description: "Your clip is being downloaded."
    });
  };

  const handleShare = async () => {
    const clipUrl = `${window.location.origin}/clip/${clipData.clipId}`;
    
    try {
      await navigator.clipboard.writeText(clipUrl);
      toast({
        title: "Link copied",
        description: "Clip link copied to clipboard."
      });
    } catch (error) {
      toast({
        title: "Share",
        description: "Clip URL: " + clipUrl,
        variant: "default"
      });
    }
  };

  const handleViewClip = () => {
    window.open(`/clip/${clipData.clipId}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-0 bg-background/95 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/20 via-brand-iris/10 to-brand-pink/20 rounded-lg -z-10" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative"
        >
          <DialogHeader className="text-center space-y-4">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-center gap-2"
            >
              <div className="p-3 rounded-full bg-gradient-to-r from-brand-cyan to-brand-iris">
                <Scissors className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
                Clip Ready!
              </DialogTitle>
            </motion.div>
          </DialogHeader>
          
          <div className="space-y-6 mt-6">
            {/* Video Preview */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="aspect-video bg-background/50 rounded-lg overflow-hidden border border-border/50"
            >
              {clipData.playbackUrl ? (
                <video
                  src={clipData.playbackUrl}
                  controls
                  className="w-full h-full object-contain"
                  poster={clipData.thumbnailUrl}
                  autoPlay={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="text-center"
                  >
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-sm text-muted-foreground">
                      Clip processing complete
                    </p>
                  </motion.div>
                </div>
              )}
            </motion.div>

            {/* Clip Info */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <h3 className="font-semibold text-lg text-gradient">{clipData.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your watermarked clip is ready to download and share!
              </p>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex gap-3 justify-center"
            >
              <Button 
                onClick={handleDownload} 
                className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink hover:shadow-lg hover:shadow-brand-iris/20 transition-all duration-300 gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleShare} 
                className="border-brand-iris/30 hover:bg-brand-iris/10 hover:border-brand-iris/50 transition-all duration-300 gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share Link
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleViewClip} 
                className="border-brand-cyan/30 hover:bg-brand-cyan/10 hover:border-brand-cyan/50 transition-all duration-300 gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Clip
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xs text-muted-foreground text-center p-4 bg-background/30 rounded-lg border border-border/20"
            >
              💎 You can also find this clip in "My Clips" from your profile menu
            </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default ClipPreviewModal;