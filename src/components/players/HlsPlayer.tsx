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
  videoRef?: React.RefObject<HTMLVideoElement>;
  onQualityLevelsUpdate?: (levels: Array<{label: string, value: number}>) => void;
  onQualityChange?: React.MutableRefObject<((qualityLevel: number) => void) | null>;
};

const HlsPlayer: React.FC<HlsPlayerProps> = ({ src, poster, autoPlay = true, controls = true, className, onStreamReady, isLiveStream = false, videoRef: externalVideoRef, onQualityLevelsUpdate, onQualityChange }) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [streamReadyCalled, setStreamReadyCalled] = React.useState(false);
  const hlsRef = React.useRef<Hls | null>(null);
  const retryTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    setStreamReadyCalled(false); // Reset when src changes
  }, [src]);

  // Pre-check if HLS manifest is ready before trying to load
  React.useEffect(() => {
    if (!src || !isLiveStream) return;
    
    const checkManifestReady = async () => {
      try {
        console.log('🎬 Checking if HLS manifest is ready:', src);
        const response = await fetch(src, { method: 'HEAD' });
        if (response.ok) {
          console.log('🎬 HLS manifest is ready');
          setError(null);
        } else {
          console.log('🎬 HLS manifest not ready yet, status:', response.status);
          setError('Stream is starting up, please wait...');
          // Retry check after 3 seconds
          setTimeout(checkManifestReady, 3000);
        }
      } catch (err) {
        console.log('🎬 HLS manifest check failed:', err);
        setError('Waiting for stream to start...');
        setTimeout(checkManifestReady, 3000);
      }
    };
    
    checkManifestReady();
  }, [src, isLiveStream]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log('🎬 HlsPlayer: Initializing with src:', src);
    setLoading(true);

    let hls: Hls | null = null;

    const onLoadStart = () => {
      console.log('🎬 Video: loadstart event');
      setLoading(true);
    };
    const onCanPlay = () => {
      console.log('🎬 Video: canplay event');
      setLoading(false);
      setRetryCount(0);
      setError(null);
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
      
      if (isLiveStream && retryCount < 30) { // More retries for browser streams
        const waitTime = Math.min(5000 + (retryCount * 1000), 10000); // Gradually increase wait time
        setError(`Stream is transcoding (${retryCount + 1}/30), retrying in ${waitTime/1000}s...`);
        setRetryCount(prev => prev + 1);
        retryTimeoutRef.current = setTimeout(() => {
          console.log(`🎬 Retrying stream connection (attempt ${retryCount + 1})...`);
          setError(null);
          video.load();
        }, waitTime);
      } else {
        setError('Stream unavailable - please refresh the page');
      }
    };
    const onWaiting = () => {
      console.log('🎬 Video: waiting for data');
    };
    const onPlaying = () => {
      console.log('🎬 Video: playing started');
      setError(null);
      setLoading(false);
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
        highBufferWatchdogPeriod: 2,
        // Ensure we follow redirects and use the CDN URLs as returned
        xhrSetup: (xhr: XMLHttpRequest, url: string) => {
          console.log('🎬 HLS.js loading URL:', url);
        }
      });
      
      // Store hls reference for quality control
      hlsRef.current = hls;
      
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
        
        // Handle manifest parsing errors for browser streams - be more patient
        if (data.details === 'manifestParsingError' && isLiveStream) {
          console.log('🎬 Stream not ready yet, will retry...');
          setError('Stream is transcoding (this can take 10-15 seconds)...');
          setRetryCount(prev => prev + 1);
          if (retryCount < 20) { // Increased from 10 to 20 attempts
            retryTimeoutRef.current = setTimeout(() => {
              console.log('🎬 Retrying stream connection...');
              hls?.loadSource(src);
            }, 5000); // Increased from 3 to 5 seconds
          } else {
            setError('Stream unavailable - please refresh the page');
          }
          return;
        }
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (isLiveStream && retryCount < 20) { // Increased retry attempts
                setError('Stream is starting (transcoding in progress)...');
                setRetryCount(prev => prev + 1);
                retryTimeoutRef.current = setTimeout(() => {
                  console.log('🎬 Retrying HLS connection...');
                  hls?.loadSource(src);
                }, 5000); // Increased retry interval
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
        
        // Update quality levels when manifest is loaded
        if (onQualityLevelsUpdate && hls.levels.length > 0) {
          // Create a map to track unique heights and avoid duplicates
          const uniqueHeights = new Map<number, number>();
          const levelsByHeight: Array<{label: string, value: number, height: number}> = [];
          
          hls.levels.forEach((level, index) => {
            if (level.height && !uniqueHeights.has(level.height)) {
              uniqueHeights.set(level.height, index);
              levelsByHeight.push({
                label: `${level.height}p`,
                value: index,
                height: level.height
              });
            }
          });
          
          // Sort by height descending (1080p, 720p, 480p, etc.)
          levelsByHeight.sort((a, b) => b.height - a.height);
          
          // Convert to the expected format
          const levels = levelsByHeight.map(level => ({
            label: level.label,
            value: level.value
          }));
          
          // Add auto quality option at the beginning
          levels.unshift({ label: 'Auto', value: -1 });
          onQualityLevelsUpdate(levels);
        }
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

  // Expose quality change function
  React.useEffect(() => {
    if (onQualityChange) {
      onQualityChange.current = (qualityLevel: number) => {
        if (hlsRef.current) {
          hlsRef.current.currentLevel = qualityLevel;
        }
      };
    }
  }, [onQualityChange]);

  return (
    <div className={"relative rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md " + (className || "")}
      aria-label="Live player">
      <div className="aspect-[16/9] relative">
        <video 
          ref={(el) => {
            videoRef.current = el;
            if (externalVideoRef && externalVideoRef.current !== el) {
              (externalVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
            }
          }} 
          poster={poster} 
          controls={false} 
          autoPlay={autoPlay} 
          muted 
          playsInline 
          className="w-full h-full object-contain bg-background" 
        />
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
