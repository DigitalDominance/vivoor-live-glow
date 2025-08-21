import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Clip Ready!</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Video Preview */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            {clipData.playbackUrl ? (
              <video
                src={clipData.playbackUrl}
                controls
                className="w-full h-full object-contain"
                poster={clipData.thumbnailUrl}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl mb-2">🎬</div>
                  <p className="text-sm text-muted-foreground">
                    Clip processing complete
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Clip Info */}
          <div className="text-center">
            <h3 className="font-semibold text-lg">{clipData.title}</h3>
            <p className="text-sm text-muted-foreground">
              Your clip has been created successfully!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-center">
            <Button onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
            
            <Button variant="outline" onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" />
              Share Link
            </Button>
            
            <Button variant="outline" onClick={handleViewClip} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View Clip
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            You can also find this clip in "My Clips" from your profile menu.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClipPreviewModal;