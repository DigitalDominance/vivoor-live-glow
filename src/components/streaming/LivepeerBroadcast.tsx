import React, { useEffect, useRef } from 'react';
import * as Broadcast from '@livepeer/react/broadcast';
import { getIngest } from '@livepeer/react/external';
import { useBrowserStreaming } from '@/context/BrowserStreamingContext';

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

  return (
    <Broadcast.Root ingestUrl={ingestUrl}>
      <Broadcast.Container>
        <Broadcast.Video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '12px',
          }}
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
          onError={(e) => {
            console.error('[LivepeerBroadcast] Video error:', e);
            onError?.(new Error('Video playback error'));
          }}
        />
        
        {/* Hidden controls - we manage UI externally */}
        <div style={{ display: 'none' }}>
          <Broadcast.Controls>
            <Broadcast.EnabledTrigger />
            <Broadcast.SourceSelect name="videoinput" type="videoinput">
              {() => null}
            </Broadcast.SourceSelect>
          </Broadcast.Controls>
        </div>
      </Broadcast.Container>
    </Broadcast.Root>
  );
};
