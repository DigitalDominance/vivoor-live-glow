import React, { useEffect, useRef } from "react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  startAt?: number; // seconds
  endAt?: number;   // seconds
  loopRange?: boolean; // loop between startAt and endAt
  controls?: boolean;
  autoPlay?: boolean;
  className?: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  startAt,
  endAt,
  loopRange = false,
  controls = true,
  autoPlay = false,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      if (typeof startAt === "number") {
        v.currentTime = clamp(startAt, 0, v.duration || startAt);
      }
      if (autoPlay) v.play().catch(() => {});
    };

    const onTimeUpdate = () => {
      if (!v) return;
      if (typeof startAt === "number" && typeof endAt === "number") {
        if (v.currentTime >= endAt - 0.05) {
          if (loopRange) {
            v.currentTime = startAt;
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      }
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [startAt, endAt, autoPlay, loopRange]);

  return (
    <div className={"relative rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md " + (className || "")}>
      <div className="aspect-[16/9]">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls={controls}
          className="w-full h-full object-contain bg-background"
        />
      </div>
    </div>
  );
};

export default VideoPlayer;
