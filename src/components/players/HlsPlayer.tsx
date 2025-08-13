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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    let hls: Hls | null = null;

    const onLoadStart = () => setLoading(true);
    const onCanPlay = () => {
      setLoading(false);
      if (autoPlay) {
        video.play().catch((err) => {
          console.warn('Autoplay failed:', err);
          setError('Click to play');
        });
      }
    };
    const onError = () => {
      setLoading(false);
      setError('Stream unavailable');
    };

    video.addEventListener('loadstart', onLoadStart);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (Hls.isSupported()) {
      hls = new Hls({ 
        enableWorker: true, 
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS error:', data);
        if (data.fatal) {
          setError('Stream error - refresh to retry');
        }
      });
      
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }

    return () => {
      video.removeEventListener('loadstart', onLoadStart);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, autoPlay]);

  return (
    <div className={"relative rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md " + (className || "")}
      aria-label="Live player">
      <div className="aspect-[16/9] relative">
        <video ref={videoRef} poster={poster} controls={controls} autoPlay={autoPlay} muted playsInline className="w-full h-full object-contain bg-background" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-sm text-muted-foreground">Loading stream...</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HlsPlayer;
