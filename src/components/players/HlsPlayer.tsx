import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

interface HlsPlayerProps {
  src: string; // HLS m3u8 URL
  poster?: string;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
}

const HlsPlayer: React.FC<HlsPlayerProps> = ({ src, poster, autoPlay = true, controls = true, className }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 10 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {});
      });
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => { if (autoPlay) video.play().catch(()=>{}); });
      return () => { video.removeAttribute('src'); };
    }
  }, [src, autoPlay]);

  return (
    <div className={"relative rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md " + (className || "") }>
      <div className="aspect-[16/9]">
        <video ref={videoRef} poster={poster} controls={controls} className="w-full h-full object-contain bg-background" />
      </div>
    </div>
  );
};

export default HlsPlayer;
