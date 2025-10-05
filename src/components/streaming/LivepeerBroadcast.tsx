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
      <Broadcast.Container className="w-full h-full bg-black overflow-hidden relative">
        <Broadcast.Video
          ref={videoRef}
          title="Live stream"
          className="w-full h-full object-cover"
          onCanPlay={handleCanPlay}
        />
        
        {/* Start broadcast button - no overlay */}
        <Broadcast.EnabledIndicator matcher={false} className="absolute inset-0 flex items-center justify-center">
          <Broadcast.EnabledTrigger className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500/90 via-purple-500/90 to-pink-500/90 backdrop-blur-xl border border-white/20 text-white hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 flex items-center gap-3 shadow-2xl transition-all duration-300 transform hover:scale-105">
            <EnableVideoIcon className="w-6 h-6" />
            <span className="font-semibold text-lg">Start Camera</span>
          </Broadcast.EnabledTrigger>
        </Broadcast.EnabledIndicator>
      </Broadcast.Container>
    </Broadcast.Root>
  );
});
