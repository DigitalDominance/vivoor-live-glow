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
  livepeerPlaybackId,
  streamTitle
}) => {
  const [title, setTitle] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<10 | 30 | 60>(30);
  const [isCreating, setIsCreating] = useState(false);
  const [clipPreview, setClipPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const { identity } = useWallet();
  const queryClient = useQueryClient();

  const createClip = async () => {
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
      const clipTitle = title || `${streamTitle} - ${selectedDuration}s Clip`;
      console.log(`Creating ${selectedDuration}s clip from live stream with playbackId: ${livepeerPlaybackId}`);

      // 1. Create clip via our app backend (simplified back to working approach)
      const clipResponse = await supabase.functions.invoke('livepeer-create-clip', {
        body: {
          playbackId: livepeerPlaybackId,
          seconds: selectedDuration
        }
      });

      if (clipResponse.error) {
        throw new Error(clipResponse.error.message || 'Failed to create clip');
      }

      const { downloadUrl } = clipResponse.data;
      console.log('Clip created, starting watermarking...');

      // 2. Send the clip to watermark service
      const formData = new FormData();
      formData.append('videoUrl', downloadUrl);
      formData.append('position', 'br');
      formData.append('margin', '24');
      formData.append('wmWidth', '180');
      formData.append('filename', `${clipTitle.replace(/[^a-zA-Z0-9]/g, '-')}.mp4`);

      const watermarkResponse = await fetch('https://vivoor-e15c882142f5.herokuapp.com/watermark', {
        method: 'POST',
        body: formData,
      });

      if (!watermarkResponse.ok) {
        throw new Error('Watermarking failed');
      }

      // 3. Get watermarked video as blob and create download
      const watermarkedBlob = await watermarkResponse.blob();
      const watermarkedUrl = URL.createObjectURL(watermarkedBlob);

      // Save clip to database
      const { data: savedClip, error: saveError } = await supabase
        .from('clips')
        .insert({
          title: clipTitle,
          user_id: identity.id,
          start_seconds: 0,  // For live stream clips, start from 0
          end_seconds: selectedDuration,  // Duration in seconds
          download_url: watermarkedUrl,
          playback_id: livepeerPlaybackId
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving clip:', saveError);
      }

      // Show preview modal with watermarked clip
      setClipPreview({
        clipId: savedClip?.id || `temp-${Date.now()}`,
        downloadUrl: watermarkedUrl,
        playbackUrl: watermarkedUrl,
        title: clipTitle,
        isWatermarked: true
      });
      setShowPreview(true);
      
      // Invalidate clips queries to refresh the clips page
      queryClient.invalidateQueries({ queryKey: ['clips-with-profiles'] });
      
      toast({
        title: "Clip created!",
        description: `Your ${selectedDuration}-second watermarked clip is ready.`
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
    setSelectedDuration(30);
    onOpenChange(false);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setClipPreview(null);
    handleClose();
  };

  const durations = [
    { value: 10, label: "10 Seconds", description: "Quick highlights" },
    { value: 30, label: "30 Seconds", description: "Extended moments" },
    { value: 60, label: "60 Seconds", description: "Full sequences" }
  ] as const;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
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
                  Create Clip
                </DialogTitle>
              </motion.div>
            </DialogHeader>
            
            <div className="space-y-6 mt-6">
              {/* Clip Title Input */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <Label htmlFor="clip-title" className="text-sm font-medium">
                  Clip Title
                </Label>
                <div className="relative">
                  <Input
                    id="clip-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`${streamTitle} - Epic ${selectedDuration}s Clip`}
                    disabled={isCreating}
                    className="bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300"
                  />
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: title ? 1 : 0 }}
                    className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary to-accent origin-left"
                  />
                </div>
              </motion.div>

              {/* Duration Selection */}
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-3"
              >
                <Label className="text-sm font-medium">Duration</Label>
                <div className="grid grid-cols-3 gap-3">
                  {durations.map((duration) => (
                    <motion.button
                      key={duration.value}
                      onClick={() => setSelectedDuration(duration.value)}
                      disabled={isCreating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        relative p-4 rounded-lg border-2 transition-all duration-300 text-left
                        ${selectedDuration === duration.value
                          ? 'border-brand-iris/60 bg-brand-iris/10 shadow-lg shadow-brand-iris/20'
                          : 'border-border/50 bg-background/30 hover:border-brand-iris/30'
                        }
                      `}
                    >
                      <div className="font-semibold text-sm">{duration.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {duration.description}
                      </div>
                      <AnimatePresence>
                        {selectedDuration === duration.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute top-2 right-2 w-3 h-3 bg-gradient-to-r from-brand-cyan to-brand-iris rounded-full"
                          />
                        )}
                      </AnimatePresence>
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex justify-end gap-3 pt-4"
              >
                <Button 
                  variant="ghost" 
                  onClick={handleClose} 
                  disabled={isCreating}
                  className="hover:bg-background/50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createClip}
                  disabled={isCreating}
                  className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink hover:shadow-lg hover:shadow-brand-iris/20 transition-all duration-300 min-w-[140px]"
                >
                  <AnimatePresence mode="wait">
                    {isCreating ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Clip...
                      </motion.div>
                    ) : (
                      <motion.div
                        key="create"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Scissors className="h-4 w-4" />
                        Create Clip
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </div>
          </motion.div>
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