import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useBrowserStreaming } from '@/context/BrowserStreamingContext';

interface ScreenShareBroadcastProps {
  ingestUrl: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
}

export const ScreenShareBroadcast: React.FC<ScreenShareBroadcastProps> = ({
  ingestUrl,
  onStreamStart,
  onStreamEnd,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { setIsStreaming, setIsPreviewing } = useBrowserStreaming();

  const stopSharing = async () => {
    console.log('[ScreenShare] Stopping screen share');
    
    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[ScreenShare] Stopped track:', track.kind);
      });
      mediaStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setIsSharing(false);
    setIsStreaming(false);
    setIsPreviewing(false);
    onStreamEnd?.();
  };

  const startScreenShare = async () => {
    try {
      setIsConnecting(true);
      console.log('[ScreenShare] Requesting screen share permission');

      // Request screen sharing permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        } as any,
        audio: true,
      });

      console.log('[ScreenShare] Screen share permission granted');
      mediaStreamRef.current = stream;

      // Show preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        console.log('[ScreenShare] User stopped sharing via browser');
        stopSharing();
      };

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('[ScreenShare] Added track to peer connection:', track.kind);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('[ScreenShare] Sending offer to:', ingestUrl);

      // Send offer to Livepeer WHIP endpoint
      const response = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHIP endpoint error: ${response.status}`);
      }

      const answerSdp = await response.text();
      console.log('[ScreenShare] Received answer from WHIP');

      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      setIsSharing(true);
      setIsStreaming(true);
      setIsPreviewing(true);
      setIsConnecting(false);
      
      toast.success('Screen sharing started!');
      onStreamStart?.();

    } catch (error: any) {
      console.error('[ScreenShare] Error:', error);
      setIsConnecting(false);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Screen sharing permission denied');
        onError?.(new Error('Permission denied'));
      } else {
        toast.error('Failed to start screen sharing');
        onError?.(error);
      }
      
      stopSharing();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSharing();
    };
  }, []);

  return (
    <div className="w-full h-full bg-black/50 rounded-xl overflow-hidden relative border border-white/10">
      {/* Video preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />

      {/* Start button */}
      {!isSharing && !isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={startScreenShare}
              size="lg"
              className="px-6 py-3 flex items-center gap-2"
            >
              <Monitor className="w-6 h-6" />
              <span className="font-medium">Start Screen Share</span>
            </Button>
            <p className="text-sm text-white/80 text-center max-w-xs">
              You'll be prompted to select which screen or window to share
            </p>
          </div>
        </div>
      )}

      {/* Connecting state */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white">Connecting...</span>
          </div>
        </div>
      )}

      {/* Stop button */}
      {isSharing && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            onClick={stopSharing}
            variant="destructive"
            size="lg"
            className="flex items-center gap-2"
          >
            <Square className="w-5 h-5" />
            <span>Stop Sharing</span>
          </Button>
        </div>
      )}

      {/* Live indicator */}
      {isSharing && (
        <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/50 backdrop-blur flex items-center gap-2">
          <div className="bg-red-500 animate-pulse h-2 w-2 rounded-full" />
          <span className="text-xs text-white select-none">LIVE</span>
        </div>
      )}
    </div>
  );
};
