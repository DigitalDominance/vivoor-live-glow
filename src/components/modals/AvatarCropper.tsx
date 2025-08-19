import React, { useCallback, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

function getCroppedImage(src: string, crop: { width: number; height: number; x: number; y: number }, outWidth = 512, outHeight = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      canvas.width = outWidth;
      canvas.height = outHeight;

      // Draw the cropped area scaled to outWidth x outHeight
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        outWidth,
        outHeight
      );

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Canvas is empty"));
        resolve(blob);
      }, "image/jpeg", 0.85);
    };
    image.onerror = () => reject(new Error("Image load error"));
    image.src = src;
  });
}

export type AvatarCropperProps = {
  open: boolean;
  src: string | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
  aspect?: number; // Aspect ratio (width/height)
};

const AvatarCropper: React.FC<AvatarCropperProps> = ({ open, src, onOpenChange, onConfirm, aspect = 1 }) => {
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [croppedPixels, setCroppedPixels] = useState<{ width: number; height: number; x: number; y: number } | null>(null);

  const hasImage = useMemo(() => Boolean(src), [src]);

  const handleComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedPixels(croppedAreaPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!src || !croppedPixels) return;
    
    // Calculate output dimensions based on aspect ratio
    const baseSize = 512;
    const outWidth = aspect >= 1 ? baseSize * aspect : baseSize;
    const outHeight = aspect >= 1 ? baseSize : baseSize / aspect;
    
    const blob = await getCroppedImage(src, croppedPixels, outWidth, outHeight);
    await onConfirm(blob);
  }, [src, croppedPixels, onConfirm, aspect]);

  const isRound = aspect === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isRound ? 'Adjust your profile photo' : 'Adjust your banner image'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="relative w-full h-[320px] rounded-md overflow-hidden bg-muted">
            {hasImage && (
              <Cropper
                image={src!}
                aspect={aspect}
                cropShape={isRound ? "round" : "rect"}
                crop={crop}
                onCropChange={setCrop}
                zoom={zoom}
                onZoomChange={setZoom}
                onCropComplete={handleComplete}
                restrictPosition={false}
                showGrid={!isRound}
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