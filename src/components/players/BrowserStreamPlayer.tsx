import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface BrowserStreamPlayerProps {
  playbackUrl: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  onStreamReady?: () => void;
}

const BrowserStreamPlayer: React.FC<BrowserStreamPlayerProps> = ({
  playbackUrl,
  poster,
  autoPlay = true,
  className,
  onStreamReady,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    console.log('🎬 BrowserStreamPlayer: Initializing with URL:', playbackUrl);
    setLoading(true);
    setError(null);

    // Rewrite URL helper - ensures all requests use livepeercdn.studio
    const rewriteUrl = (url: string): string => {
      if (url.includes('playback.livepeer.studio')) {
        const rewritten = url.replace('playback.livepeer.studio', 'livepeercdn.studio');
        console.log('🎬 Rewriting URL:', url, '→', rewritten);
        return rewritten;
      }
      return url;
    };

    const onCanPlay = () => {
      console.log('🎬 BrowserStreamPlayer: canplay event');
      setLoading(false);
      setError(null);
      onStreamReady?.();
      if (autoPlay) {
        video.play().catch((err) => {
          console.warn('🎬 Autoplay failed:', err);
          setError('Click to play');
        });
      }
    };

    const onError = (e: Event) => {
      console.error('🎬 BrowserStreamPlayer error:', e, video.error);
      setLoading(false);
      setError('Stream unavailable');
    };

    const onPlaying = () => {
      console.log('🎬 BrowserStreamPlayer: playing started');
      setError(null);
      setLoading(false);
    };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
    video.addEventListener('playing', onPlaying);

    // Custom XHR loader that rewrites ALL URLs including segments from manifests
    class CustomXhrLoader extends Hls.DefaultConfig.loader {
      load(context: any, config: any, callbacks: any) {
        // Rewrite the URL before loading
        const originalUrl = context.url;
        context.url = rewriteUrl(context.url);
        
        if (context.url !== originalUrl) {
          console.log('🎬 Loader rewriting:', originalUrl, '→', context.url);
        }
        
        // Call parent load with rewritten URL
        super.load(context, config, callbacks);
      }
    }
    
    // Manifest loader to rewrite segment URLs inside the manifest itself
    class ManifestRewritingLoader extends CustomXhrLoader {
      load(context: any, config: any, callbacks: any) {
        const originalOnSuccess = callbacks.onSuccess;
        
        // Wrap onSuccess to rewrite manifest content
        const wrappedCallbacks = {
          ...callbacks,
          onSuccess: (response: any, stats: any, context: any, networkDetails: any) => {
            // If this is a manifest (playlist), rewrite segment URLs in the response
            if (context.type === 'manifest' || context.type === 'level') {
              const data = response.data;
              if (typeof data === 'string' && data.includes('playback.livepeer.studio')) {
                console.log('🎬 Rewriting manifest content - found playback.livepeer.studio references');
                // Replace all instances of playback.livepeer.studio with livepeercdn.studio
                response.data = data.replace(/playback\.livepeer\.studio/g, 'livepeercdn.studio');
                console.log('🎬 Manifest content rewritten');
              }
            }
            originalOnSuccess(response, stats, context, networkDetails);
          }
        };
        
        super.load(context, config, wrappedCallbacks);
      }
    }

    // ALWAYS use HLS.js for browser streams to ensure URL rewriting works
    // Native HLS doesn't support our manifest rewriting
    if (Hls.isSupported()) {
      console.log('🎬 Using HLS.js with custom loader');
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
        liveDurationInfinity: true,
        highBufferWatchdogPeriod: 2,
        loader: ManifestRewritingLoader, // Use our manifest-rewriting loader
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('🎬 HLS error:', event, data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('🎬 Network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('🎬 Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setError('Stream error - please refresh');
              break;
          }
        }
      });

      hls.on(Hls.Events.MANIFEST_LOADED, () => {
        console.log('🎬 HLS: Manifest loaded successfully');
      });

      hls.on(Hls.Events.LEVEL_LOADED, () => {
        console.log('🎬 HLS: Level loaded');
      });

      // Rewrite the initial URL before loading
      const rewrittenUrl = rewriteUrl(playbackUrl);
      console.log('🎬 Loading source:', rewrittenUrl);
      hls.loadSource(rewrittenUrl);
      hls.attachMedia(video);
    } else {
      console.log('🎬 Using fallback direct source');
      video.src = rewriteUrl(playbackUrl);
    }

    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      video.removeEventListener('playing', onPlaying);
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playbackUrl, autoPlay, onStreamReady]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md ${className || ''}`}
      aria-label="Browser stream player"
    >
      <div className="aspect-[16/9] relative">
        <video
          ref={videoRef}
          poster={poster}
          controls={true}
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

export default BrowserStreamPlayer;
