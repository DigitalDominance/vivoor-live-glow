import React from "react";
import Hls from "hls.js";

type HlsPlayerProps = {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
  onStreamReady?: () => void;
  isLiveStream?: boolean;
};

const HlsPlayer: React.FC<HlsPlayerProps> = ({ src, poster, autoPlay = true, controls = true, className, onStreamReady, isLiveStream = false }) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [streamReadyCalled, setStreamReadyCalled] = React.useState(false);
  const retryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    setStreamReadyCalled(false); // Reset when src changes
  }, [src]);

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
      setRetryCount(0);
      if (!streamReadyCalled && onStreamReady) {
        setStreamReadyCalled(true);
        onStreamReady();
      }
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
      
      if (isLiveStream && retryCount < 10) {
        setError('Connection Lost, Retrying...');
        setRetryCount(prev => prev + 1);
        retryTimeoutRef.current = setTimeout(() => {
          console.log('🎬 Retrying stream connection...');
          video.load();
        }, 5000);
      } else {
        setError('Stream unavailable');
      }
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
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
        liveDurationInfinity: true,
        highBufferWatchdogPeriod: 2
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('🎬 HLS error:', event, data);
        
        // Handle buffer stalled errors specifically
        if (data.details === 'bufferStalledError') {
          console.log('🎬 Buffer stalled, trying to recover...');
          if (hls && !data.fatal) {
            hls.recoverMediaError();
            return;
          }
        }
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (isLiveStream && retryCount < 5) {
                setError('Connection Lost, Retrying...');
                setRetryCount(prev => prev + 1);
                retryTimeoutRef.current = setTimeout(() => {
                  console.log('🎬 Retrying HLS connection...');
                  hls?.loadSource(src);
                }, 3000);
              } else {
                setError('Stream Ended or Unavailable');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('🎬 Trying to recover from media error...');
              hls?.recoverMediaError();
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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
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
