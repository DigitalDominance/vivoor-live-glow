import React, { useCallback, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

function getCroppedImage(src: string, crop: { width: number; height: number; x: number; y: number }, outSize = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      canvas.width = outSize;
      canvas.height = outSize;

      // Draw the cropped area scaled to outSize x outSize
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        outSize,
        outSize
      );

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Canvas is empty"));
        resolve(blob);
      }, "image/png", 1);
    };
    image.onerror = reject;
    image.src = src;
  });
}

export type AvatarCropperProps = {
  open: boolean;
  src: string | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
};

const AvatarCropper: React.FC<AvatarCropperProps> = ({ open, src, onOpenChange, onConfirm }) => {
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [croppedPixels, setCroppedPixels] = useState<{ width: number; height: number; x: number; y: number } | null>(null);

  const hasImage = useMemo(() => Boolean(src), [src]);

  const handleComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedPixels(croppedAreaPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!src || !croppedPixels) return;
    const blob = await getCroppedImage(src, croppedPixels, 512);
    await onConfirm(blob);
  }, [src, croppedPixels, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Adjust your profile photo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="relative w-full h-[320px] rounded-md overflow-hidden bg-muted">
            {hasImage && (
              <Cropper
                image={src!}
                aspect={1}
                cropShape="round"
                crop={crop}
                onCropChange={setCrop}
                zoom={zoom}
                onZoomChange={setZoom}
                onCropComplete={handleComplete}
                restrictPosition={false}
                showGrid={false}
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground min-w-16">Zoom</div>
            <Slider
              min={1}
              max={3}
              step={0.01}
              value={[zoom] as any}
              onValueChange={(v) => setZoom((v as number[])[0])}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropper;
