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

const LivepeerClipCreator: React.FC<LivepeerClipCreatorProps> = ({
  open,
  onOpenChange,
  livepeerPlaybackId,
  streamTitle
}) => {
  const [title, setTitle] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<15 | 30 | 60>(30);
  const [isCreating, setIsCreating] = useState(false);
  const [clipPreview, setClipPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const { identity } = useWallet();
  const queryClient = useQueryClient();

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  const pollAssetReady = async (assetId: string, maxMs = 180000) => {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const status = await supabase.functions.invoke("get-clip-status", {
        body: { assetId }
      });

      if (!status.error) {
        const { phase, downloadUrl } = status.data || {};
        if (phase === "ready" && downloadUrl) {
          return { downloadUrl };
        }
        if (phase === "failed") {
          throw new Error("Clip processing failed at Livepeer.");
        }
      }
      await sleep(3000);
    }
    throw new Error("Timeout waiting for clip to become ready.");
  };

  const createClip = async () => {
    if (!identity?.id) {
      toast({
        title: "Login required",
        description: "Connect your wallet to create clips.",
        variant: "destructive",
      });
      return;
    }

    if (!livepeerPlaybackId || livepeerPlaybackId.trim().length < 6) {
      toast({
        title: "Stream not ready",
        description: "Missing or invalid Livepeer playback ID.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const clipTitle =
        (title && title.trim()) ||
        `${streamTitle} - Epic ${selectedDuration}s Clip`;

      console.log(
        `Creating ${selectedDuration}s clip from live stream with playbackId: ${livepeerPlaybackId}`
      );

      // Close the modal immediately so user can keep watching
      handleClose();

      // Show loading toast
      toast({
        title: "Creating clip...",
        description:
          "You will be notified when your clip is ready. You can continue watching!",
      });

      // 1) Ask server to create the Livepeer clip window (quick response with assetId)
      const clipResponse = await supabase.functions.invoke(
        "create-permanent-clip",
        {
          body: {
            playbackId: livepeerPlaybackId,
            seconds: selectedDuration,
            title: clipTitle,
            userId: identity.id,
            streamTitle,
            nowMs: Date.now(),
          },
        }
      );

      if (clipResponse.error) {
        const msg =
          clipResponse.error.message ||
          clipResponse.error.name ||
          "Failed to create clip";
        throw new Error(msg);
      }

      const { assetId } = clipResponse.data || {};
      if (!assetId) throw new Error("Clip created but no assetId was returned.");

      // 2) Poll Livepeer until ready (client-side to avoid Edge timeouts)
      const { downloadUrl } = await pollAssetReady(assetId);

      // 3) Watermark via our Supabase proxy (fixes CORS)
      toast({
        title: "Adding watermark...",
        description: "Applying watermark to your clip...",
      });

      const functionsBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
      const safeNameCore = slug(clipTitle) || `clip-${Date.now()}`;
      const safeFileName = `${safeNameCore}.mp4`;

      const wmRes = await fetch(`${functionsBase}/watermark-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: downloadUrl,
          position: "br",
          margin: 24,
          wmWidth: 180,
          filename: safeFileName,
        }),
      });

      if (!wmRes.ok) {
        let msg = "Failed to apply watermark";
        try {
          const j = await wmRes.json();
          msg = j?.error || msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      const watermarkedBlob = await wmRes.blob();

      // 4) Upload the watermarked MP4 to Supabase Storage (so the clip page has a stable URL)
      // Ensure you have a public bucket named "clips"
      const filePath = `${identity.id}/${Date.now()}_${safeFileName}`;
      let publicUrl: string | undefined;

      try {
        const { error: upErr } = await supabase.storage
          .from("clips")
          .upload(filePath, watermarkedBlob, {
            cacheControl: "3600",
            upsert: true,
            contentType: "video/mp4",
          });

        if (upErr) {
          console.warn("Storage upload failed, falling back to blob URL:", upErr);
        } else {
          const { data: pub } = supabase.storage.from("clips").getPublicUrl(filePath);
          publicUrl = pub?.publicUrl;
        }
      } catch (e) {
        console.warn("Storage upload threw, falling back to blob URL:", e);
      }

      // 5) Save DB row so the clip page has an id/endpoint
      let savedClipId: string | undefined;
      const finalUrlForDb = publicUrl || downloadUrl; // if upload failed, persist the Livepeer URL

      try {
        const { data: saved, error: saveErr } = await supabase
          .from("clips")
          .insert({
            title: clipTitle,
            user_id: identity.id,
            start_seconds: 0,
            end_seconds: selectedDuration,
            duration_seconds: selectedDuration,
            download_url: finalUrlForDb,
            thumbnail_url: finalUrlForDb,
            livepeer_asset_id: assetId,
            playback_id: livepeerPlaybackId,
            is_watermarked: !!publicUrl, // optional if column exists
          })
          .select("*")
          .single();

        if (saveErr) {
          console.warn("DB insert failed; preview will still show:", saveErr);
        } else {
          savedClipId = saved?.id;
        }
      } catch (e) {
        console.warn("DB insert threw; preview will still show:", e);
      }

      // 6) Build a preview URL:
      // Prefer the public URL from storage; otherwise fallback to the local blob so the user can still see/download it.
      const watermarkedObjectUrl = URL.createObjectURL(watermarkedBlob);
      const previewUrl = publicUrl || watermarkedObjectUrl;

      // Success toast
      toast({
        title: "Clip Ready!",
        description: `Your ${selectedDuration}-second clip is ready to download!`,
      });

      // Show preview modal
      setClipPreview({
        clipId: savedClipId, // enables the clip page route to work
        downloadUrl: previewUrl,
        playbackUrl: previewUrl,
        title: clipTitle,
        isWatermarked: true,
      });
      setShowPreview(true);

      // Refresh any cached lists
      queryClient.invalidateQueries({ queryKey: ["clips-with-profiles"] });
    } catch (error: any) {
      console.error("Error creating clip:", error);
      toast({
        title: "Failed to create clip",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setSelectedDuration(15);
    onOpenChange(false);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setClipPreview(null);
    handleClose();
  };

  const durations = [
    { value: 15, label: "15 Seconds", description: "Quick highlights" },
    { value: 30, label: "30 Seconds", description: "Extended moments" },
    { value: 60, label: "60 Seconds", description: "Full sequences" },
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
                  {([15, 30, 60] as const).map((value) => (
                    <motion.button
                      key={value}
                      onClick={() => setSelectedDuration(value)}
                      disabled={isCreating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        relative p-4 rounded-lg border-2 transition-all duration-300 text-left
                        ${
                          selectedDuration === value
                            ? "border-brand-iris/60 bg-brand-iris/10 shadow-lg shadow-brand-iris/20"
                            : "border-border/50 bg-background/30 hover:border-brand-iris/30"
                        }
                      `}
                    >
                      <div className="font-semibold text-sm">
                        {value} Seconds
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {value === 15
                          ? "Quick highlights"
                          : value === 30
                          ? "Extended moments"
                          : "Full sequences"}
                      </div>
                      <AnimatePresence>
                        {selectedDuration === value && (
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
