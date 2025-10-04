import React, { useEffect, useRef, useState } from 'react';
import * as Broadcast from '@livepeer/react/broadcast';
import { getIngest } from '@livepeer/react/external';
import { useBrowserStreaming } from '@/context/BrowserStreamingContext';
import { LoadingIcon, EnableVideoIcon, StopIcon, StartScreenshareIcon, StopScreenshareIcon } from '@livepeer/react/assets';
import { toast } from 'sonner';

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
      video={source === 'camera'}
      audio={source === 'camera'}
      onError={(error) => {
        console.error('[LivepeerBroadcast] Broadcast error:', error);
        if (error?.type === 'permissions') {
          onError?.(new Error('Permissions denied. Please allow access and try again.'));
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
              console.log('[LivepeerBroadcast] Video track label:', videoTracks[0]?.label);
            }
          }}
          onError={() => {
            console.error('[LivepeerBroadcast] Video error');
            onError?.(new Error('Video playback error'));
          }}
        />
        
        {/* Start broadcast button */}
        <Broadcast.EnabledIndicator matcher={false} className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4">
            {source === 'screen' ? (
              <>
                <Broadcast.EnabledTrigger className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
                  <EnableVideoIcon className="w-6 h-6" />
                  <span className="font-medium">Ready to Share Screen</span>
                </Broadcast.EnabledTrigger>
                <p className="text-sm text-white/80 text-center max-w-xs">
                  Click above, then click "Share Screen" to select your display
                </p>
              </>
            ) : (
              <Broadcast.EnabledTrigger className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
                <EnableVideoIcon className="w-6 h-6" />
                <span className="font-medium">Start Camera</span>
              </Broadcast.EnabledTrigger>
            )}
          </div>
        </Broadcast.EnabledIndicator>
        
        <Broadcast.LoadingIndicator className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <LoadingIcon className="w-8 h-8 animate-spin text-white" />
            <span className="text-sm text-white">
              {source === 'screen' ? 'Preparing screen share...' : 'Starting camera...'}
            </span>
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
            {source === 'screen' && (
              <Broadcast.ScreenshareTrigger className="px-4 py-2 rounded-lg hover:scale-105 flex-shrink-0 transition-transform flex items-center gap-2 bg-primary text-primary-foreground">
                <Broadcast.ScreenshareIndicator asChild matcher={false}>
                  <>
                    <StartScreenshareIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Share Screen</span>
                  </>
                </Broadcast.ScreenshareIndicator>
                <Broadcast.ScreenshareIndicator asChild matcher={true}>
                  <>
                    <StopScreenshareIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Stop Sharing</span>
                  </>
                </Broadcast.ScreenshareIndicator>
              </Broadcast.ScreenshareTrigger>
            )}
            
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
};
