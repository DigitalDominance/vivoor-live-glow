import React, { useEffect, useRef } from 'react';
import * as Broadcast from '@livepeer/react/broadcast';
import { getIngest } from '@livepeer/react/external';
import { useBrowserStreaming } from '@/context/BrowserStreamingContext';
import { LoadingIcon } from '@livepeer/react/assets';

interface LivepeerBroadcastProps {
  streamKey: string;
  source: 'camera' | 'screen';
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
}

export const LivepeerBroadcast: React.FC<LivepeerBroadcastProps> = ({
  streamKey,
  source,
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
  const ingestUrl = getIngest(streamKey);

  console.log('[LivepeerBroadcast] Initializing with stream key:', streamKey);
  console.log('[LivepeerBroadcast] Ingest URL:', ingestUrl);
  console.log('[LivepeerBroadcast] Source:', source);

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
      video={true}
      audio={true}
      onError={(error) => {
        console.error('[LivepeerBroadcast] Broadcast error:', error);
        if (error?.type === 'permissions') {
          onError?.(new Error('Camera/microphone permissions denied. Please allow access and try again.'));
        } else {
          onError?.(new Error('Broadcast failed. Please try again.'));
        }
      }}
    >
      <Broadcast.Container className="w-full h-full bg-black/50 rounded-xl overflow-hidden relative">
        <Broadcast.Video
          ref={videoRef}
          title="Live stream"
          className="w-full h-full object-cover"
          onCanPlay={() => {
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
            }
          }}
          onError={() => {
            console.error('[LivepeerBroadcast] Video error');
            onError?.(new Error('Video playback error'));
          }}
        />
        
        <Broadcast.LoadingIndicator className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <LoadingIcon className="w-8 h-8 animate-spin text-white" />
            <span className="text-sm text-white">Starting broadcast...</span>
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

        {/* Hidden controls - handled externally */}
        <div style={{ display: 'none' }}>
          <Broadcast.Controls>
            <Broadcast.EnabledTrigger />
          </Broadcast.Controls>
        </div>
      </Broadcast.Container>
    </Broadcast.Root>
  );
};
