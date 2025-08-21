import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as Player from '@livepeer/react/player';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/context/WalletContext";
import ClipPreviewModal from "./ClipPreviewModal";
import { Loader2 } from "lucide-react";

interface LivepeerClipCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbackId: string;
  streamTitle: string;
}

interface ClipContext {
  playbackId: string;
  startTime: number;
  endTime: number;
}

const LivepeerClipCreator: React.FC<LivepeerClipCreatorProps> = ({
  open,
  onOpenChange,
  playbackId,
  streamTitle
}) => {
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [clipPreview, setClipPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const { identity } = useWallet();

  const createClipFromCurrentTime = async (duration: 10 | 30 | 60) => {
    if (!identity?.id) {
      toast({
        title: "Login required",
        description: "Connect your wallet to create clips.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      // Use current time as endTime and calculate startTime
      const now = Date.now();
      const endTime = now;
      const startTime = Math.max(0, endTime - (duration * 1000));

      console.log(`Creating ${duration}s clip from ${startTime}ms to ${endTime}ms`);

      // Call our edge function to create the clip
      const response = await supabase.functions.invoke('livepeer-create-clip', {
        body: {
          playbackId,
          startTime,
          endTime,
          title: title || `${streamTitle} - ${duration}s Clip`,
          userId: identity.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create clip');
      }

      const clipData = response.data;
      console.log('Clip created successfully:', clipData);

      // Show preview modal
      setClipPreview(clipData);
      setShowPreview(true);
      
      toast({
        title: "Clip created!",
        description: `Your ${duration}-second clip is ready.`
      });

    } catch (error: any) {
      console.error('Error creating clip:', error);
      toast({
        title: "Failed to create clip",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const createClip = async (duration: 10 | 30 | 60, clipCtx: ClipContext) => {
    if (!identity?.id) {
      toast({
        title: "Login required",
        description: "Connect your wallet to create clips.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      // Adjust times for "last N seconds"
      const endTime = clipCtx.endTime;
      const startTime = Math.max(0, endTime - (duration * 1000));

      console.log(`Creating ${duration}s clip from ${startTime}ms to ${endTime}ms`);

      // Call our edge function to create the clip
      const response = await supabase.functions.invoke('livepeer-create-clip', {
        body: {
          playbackId: clipCtx.playbackId,
          startTime,
          endTime,
          title: title || `${streamTitle} - ${duration}s Clip`,
          userId: identity.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create clip');
      }

      const clipData = response.data;
      console.log('Clip created successfully:', clipData);

      // Show preview modal
      setClipPreview(clipData);
      setShowPreview(true);
      
      toast({
        title: "Clip created!",
        description: `Your ${duration}-second clip is ready.`
      });

    } catch (error: any) {
      console.error('Error creating clip:', error);
      toast({
        title: "Failed to create clip",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    onOpenChange(false);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setClipPreview(null);
    handleClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create Clip</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Video Player with Clip Buttons */}
            <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
              <video
                src={`https://lp-playback.com/hls/${playbackId}/index.m3u8`}
                controls
                className="w-full h-full object-contain"
                autoPlay
                muted
              />
              
              {/* Custom Clip Controls Overlay */}
              <div className="absolute bottom-16 left-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isCreating}
                  onClick={() => createClipFromCurrentTime(10)}
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clip 10s"}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isCreating}
                  onClick={() => createClipFromCurrentTime(30)}
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clip 30s"}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isCreating}
                  onClick={() => createClipFromCurrentTime(60)}
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clip 60s"}
                </Button>
              </div>
            </div>

            {/* Clip Settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clip-title">Clip Title (Optional)</Label>
                <Input
                  id="clip-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${streamTitle} - Clip`}
                  disabled={isCreating}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                <p>• Click "Clip 10s", "Clip 30s", or "Clip 60s" to create a clip of the last N seconds from the current playback position.</p>
                <p>• The clip will be processed and saved to your account with a watermark.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose} disabled={isCreating}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ClipPreviewModal
        open={showPreview}
        onOpenChange={handlePreviewClose}
        clipData={clipPreview}
      />
    </>
  );
};

export default LivepeerClipCreator;