import React, { useRef, useMemo, useCallback } from 'react';
import * as Broadcast from '@livepeer/react/broadcast';
import { getIngest } from '@livepeer/react/external';
import { useBrowserStreaming } from '@/context/BrowserStreamingContext';
import { LoadingIcon, EnableVideoIcon, StopIcon } from '@livepeer/react/assets';
import { toast } from 'sonner';

interface LivepeerBroadcastProps {
  streamKey: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
}

export const LivepeerBroadcast = React.memo<LivepeerBroadcastProps>(({
  streamKey,
  onStreamStart,
  onStreamEnd,
  onError,
}) => {
  const {
    mediaStreamRef,
    setIsStreaming,
    setIsPreviewing,
    setHasVideo,
    setHasAudio,
  } = useBrowserStreaming();

  const videoRef = useRef<HTMLVideoElement>(null);
  const hasStartedRef = useRef(false);
  
  // Stabilize ingest URL to prevent re-renders
  const ingestUrl = useMemo(() => getIngest(streamKey), [streamKey]);

  console.log('[LivepeerBroadcast] Render with stream key:', streamKey);
  console.log('[LivepeerBroadcast] Ingest URL:', ingestUrl);

  // Memoize error handler to prevent re-renders
  const handleError = useCallback((error: any) => {
    console.error('[LivepeerBroadcast] Broadcast error:', error);
    
    // Only handle permissions errors - Livepeer handles reconnection automatically
    if (error?.type === 'permissions') {
      toast.error('Camera/microphone access denied');
      onError?.(new Error('Permissions denied. Please allow access and try again.'));
    }
  }, [onError]);

  // Memoize video play handler
  const handleCanPlay = useCallback(() => {
    console.log('[LivepeerBroadcast] Video can play');
    
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      setIsStreaming(true);
      setIsPreviewing(true);
      onStreamStart?.();
    }
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      mediaStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      
      console.log('[LivepeerBroadcast] Video tracks:', videoTracks.length);
      console.log('[LivepeerBroadcast] Audio tracks:', audioTracks.length);
      console.log('[LivepeerBroadcast] Video track label:', videoTracks[0]?.label);
    }
  }, [onStreamStart, setIsStreaming, setIsPreviewing, setHasVideo, setHasAudio, mediaStreamRef]);

  if (!ingestUrl) {
    console.error('[LivepeerBroadcast] Invalid stream key');
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/50 rounded-xl">
        <p className="text-white">Invalid stream key</p>
      </div>
    );
  }

  return (
    <Broadcast.Root 
      ingestUrl={ingestUrl}
      onError={handleError}
    >
      <Broadcast.Container className="w-full h-full bg-black/50 rounded-xl overflow-hidden relative">
        <Broadcast.Video
          ref={videoRef}
          title="Live stream"
          className="w-full h-full object-cover"
          onCanPlay={handleCanPlay}
        />
        
        {/* Start broadcast button */}
        <Broadcast.EnabledIndicator matcher={false} className="absolute inset-0 flex items-center justify-center bg-black/80">
          <Broadcast.EnabledTrigger className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
            <EnableVideoIcon className="w-6 h-6" />
            <span className="font-medium">Start Camera</span>
          </Broadcast.EnabledTrigger>
        </Broadcast.EnabledIndicator>
        
        <Broadcast.LoadingIndicator className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <LoadingIcon className="w-8 h-8 animate-spin text-white" />
            <span className="text-sm text-white">Starting camera...</span>
          </div>
        </Broadcast.LoadingIndicator>

        <Broadcast.ErrorIndicator
          matcher="not-permissions"
          className="absolute inset-0 flex items-center justify-center bg-black/80"
        >
          <div className="flex flex-col gap-2 text-center text-white">
            <p className="text-xl font-bold">Broadcast failed</p>
            <p className="text-sm">Retrying in the background...</p>
          </div>
        </Broadcast.ErrorIndicator>

        {/* Status indicator */}
        <Broadcast.LoadingIndicator asChild matcher={false}>
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/50 backdrop-blur">
            <Broadcast.StatusIndicator matcher="live" className="flex gap-2 items-center">
              <div className="bg-red-500 animate-pulse h-2 w-2 rounded-full" />
              <span className="text-xs text-white select-none">LIVE</span>
            </Broadcast.StatusIndicator>
            <Broadcast.StatusIndicator matcher="pending" className="flex gap-2 items-center">
              <div className="bg-white/80 h-2 w-2 rounded-full animate-pulse" />
              <span className="text-xs text-white select-none">LOADING</span>
            </Broadcast.StatusIndicator>
            <Broadcast.StatusIndicator matcher="idle" className="flex gap-2 items-center">
              <div className="bg-white/80 h-2 w-2 rounded-full" />
              <span className="text-xs text-white select-none">IDLE</span>
            </Broadcast.StatusIndicator>
          </div>
        </Broadcast.LoadingIndicator>

        {/* Control buttons - only shown when broadcast is enabled */}
        <Broadcast.EnabledIndicator asChild>
          <Broadcast.Controls className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3 bg-black/50 backdrop-blur px-4 py-2 rounded-full">
            <Broadcast.EnabledTrigger className="w-10 h-10 hover:scale-105 flex-shrink-0 transition-transform">
              <Broadcast.EnabledIndicator asChild matcher={true}>
                <StopIcon className="w-full h-full text-red-500" />
              </Broadcast.EnabledIndicator>
            </Broadcast.EnabledTrigger>
          </Broadcast.Controls>
        </Broadcast.EnabledIndicator>
      </Broadcast.Container>
    </Broadcast.Root>
  );
});
