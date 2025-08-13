import React from "react";
import Hls from "hls.js";

type HlsPlayerProps = {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
};

const HlsPlayer: React.FC<HlsPlayerProps> = ({ src, poster, autoPlay = true, controls = true, className }) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      // Fallback: try to set src directly
      video.src = src;
    }

    const onCanPlay = () => {
      if (autoPlay) {
        video.play().catch(() => {});
      }
    };
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('canplay', onCanPlay);
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, autoPlay]);

  return (
    <div className={"relative rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md " + (className || "")}
      aria-label="Live player">
      <div className="aspect-[16/9]">
        <video ref={videoRef} poster={poster} controls={controls} autoPlay={autoPlay} muted playsInline className="w-full h-full object-contain bg-background" />
      </div>
    </div>
  );
};

export default HlsPlayer;
