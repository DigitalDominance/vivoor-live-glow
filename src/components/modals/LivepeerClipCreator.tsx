import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/context/WalletContext";
import ClipPreviewModal from "./ClipPreviewModal";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Scissors } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LivepeerClipCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  livepeerPlaybackId: string;
  streamTitle?: string;
}

const LivepeerClipCreator: React.FC<LivepeerClipCreatorProps> = ({
  open,
  onOpenChange,
  livepeerPlaybackId,
  streamTitle,
}) => {
  const { toast } = useToast();
  const { identity } = useWallet();
  const queryClient = useQueryClient();

  const [clipTitle, setClipTitle] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [isWorking, setIsWorking] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [clipPreview, setClipPreview] = useState<any>(null);

  const handlePreviewClose = (open: boolean) => {
    setShowPreview(open);
    if (!open) setClipPreview(null);
  };

  const createClip = async () => {
    if (!identity?.id || !livepeerPlaybackId) {
      toast({ title: "Missing info", description: "You must be logged in and have an active stream." });
      return;
    }
    setIsWorking(true);

    try {
      // calculate client time window (kept from your original logic)
      const clientNow = Date.now();
      const bufferMs = 1000;
      const clientEndTime = clientNow - bufferMs;
      const clientStartTime = clientEndTime - selectedDuration * 1000;

      // Call our JSON-returning function
      const { data: watermarkData, error: watermarkError } = await supabase.functions.invoke('watermark-clip', {
        body: {
          playbackId: livepeerPlaybackId,
          seconds: selectedDuration,
          title: clipTitle,
          userId: identity.id,
          streamTitle,
          startTime: clientStartTime,
          endTime: clientEndTime
        }
      });

      if (watermarkError) {
        throw new Error(watermarkError.message || 'Failed to create and watermark clip');
      }
      const meta: any = watermarkData;
      if (!meta || typeof meta !== 'object') {
        throw new Error('Unexpected response from watermark service');
      }
      const watermarked: boolean = !!meta.watermarked;
      const finalUrl: string = meta.url;

      toast({
        title: "Clip Ready!",
        description: watermarked
          ? `Your ${selectedDuration}-second clip is ready to download!`
          : `Your clip is ready, but watermarking failed. Original clip provided.`,
      });

      const clipId = `temp-${Date.now()}`;
      setClipPreview({
        clipId,
        downloadUrl: finalUrl,
        playbackUrl: finalUrl,
        title: meta.filename || clipTitle || "Clip",
        watermarked,
      });
      setShowPreview(true);

      // Refresh any clip lists if you're caching them
      queryClient.invalidateQueries({ queryKey: ["my-clips"] });
    } catch (err: any) {
      console.error("Error creating clip:", err);
      toast({
        title: "Error creating clip",
        description: err?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5" /> Create Clip
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="clip-title">Title</Label>
              <Input
                id="clip-title"
                value={clipTitle}
                onChange={(e) => setClipTitle(e.target.value)}
                placeholder="My awesome moment"
              />
            </div>

            <div>
              <Label>Duration</Label>
              <div className="flex gap-2">
                {[15, 30, 60].map((s) => (
                  <Button key={s} variant={selectedDuration === s ? "hero" : "outline"} onClick={() => setSelectedDuration(s)}>
                    {s}s
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="hero" onClick={createClip} disabled={isWorking}>
                {isWorking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</> : "Create Clip"}
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
