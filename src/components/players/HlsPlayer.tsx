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

    console.log('🎬 HlsPlayer: Initializing with src:', src);
    setLoading(true);
    setError(null);

    let hls: Hls | null = null;

    const onLoadStart = () => {
      console.log('🎬 Video: loadstart event');
      setLoading(true);
    };
    const onCanPlay = () => {
      console.log('🎬 Video: canplay event');
      setLoading(false);
      if (autoPlay) {
        video.play().catch((err) => {
          console.warn('🎬 Autoplay failed:', err);
          setError('Click to play');
        });
      }
    };
    const onError = (e: any) => {
      console.error('🎬 Video error:', e, video.error);
      setLoading(false);
      setError('Stream unavailable');
    };
    const onWaiting = () => {
      console.log('🎬 Video: waiting for data');
    };
    const onPlaying = () => {
      console.log('🎬 Video: playing started');
      setError(null);
    };

    video.addEventListener('loadstart', onLoadStart);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('🎬 Using native HLS support');
      video.src = src;
    } else if (Hls.isSupported()) {
      console.log('🎬 Using HLS.js library');
      hls = new Hls({ 
        enableWorker: true, 
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('🎬 HLS error:', event, data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error - check connection');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error - stream format issue');
              break;
            default:
              setError('Stream error - refresh to retry');
          }
        }
      });
      
      hls.on(Hls.Events.MANIFEST_LOADED, () => {
        console.log('🎬 HLS: Manifest loaded');
      });
      
      hls.on(Hls.Events.LEVEL_LOADED, () => {
        console.log('🎬 HLS: Level loaded');
      });
      
      console.log('🎬 Loading HLS source:', src);
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      console.log('🎬 Using fallback direct source');
      video.src = src;
    }

    return () => {
      video.removeEventListener('loadstart', onLoadStart);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
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
