import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Video, Monitor } from 'lucide-react';

interface BrowserStreamingProps {
  streamKey: string;
  playbackId?: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  isPreviewMode?: boolean;
}

const BrowserStreaming: React.FC<BrowserStreamingProps> = ({
  streamKey,
  onStreamStart,
  onStreamEnd,
  isPreviewMode = false,
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamSource, setStreamSource] = useState<'camera' | 'screen' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Send heartbeat to mark stream as live
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const sendHeartbeat = async (status: 'live' | 'idle') => {
      if (isPreviewMode) return;

      const streamId = localStorage.getItem('currentStreamId');
      if (!streamId) return;

      try {
        const { error } = await supabase
          .from('streams')
          .update({ 
            is_live: status === 'live',
            last_heartbeat: new Date().toISOString(),
            stream_type: 'browser'
          })
          .eq('id', streamId);

        if (error) {
          console.error('Heartbeat error:', error);
        }
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    };

    if (isStreaming) {
      sendHeartbeat('live');
      heartbeatInterval = setInterval(() => sendHeartbeat('live'), 5000);
    }

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [isStreaming, isPreviewMode]);

  const startBroadcast = async (source: 'camera' | 'screen') => {
    try {
      setStreamSource(source);
      
      // Step 1: Get redirect URL
      const redirectResponse = await fetch(`https://livepeer.studio/webrtc/${streamKey}`, {
        method: 'HEAD',
        redirect: 'manual'
      });
      
      const redirectUrl = redirectResponse.headers.get('Location') || 
                         `https://livepeer.studio/webrtc/${streamKey}`;
      
      const host = new URL(redirectUrl).host;

      // Step 2: Set up ICE servers
      const iceServers = [
        { urls: `stun:${host}` },
        {
          urls: `turn:${host}`,
          username: 'livepeer',
          credential: 'livepeer',
        },
      ];

      // Step 3: Get user media
      const mediaStream = source === 'screen' 
        ? await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1920, height: 1080 },
            audio: true,
          })
        : await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

      mediaStreamRef.current = mediaStream;

      // Set video preview
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Step 4: Create peer connection
      const peerConnection = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = peerConnection;

      // Add tracks
      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];

      if (videoTrack) {
        peerConnection.addTransceiver(videoTrack, { direction: 'sendonly' });
      }
      if (audioTrack) {
        peerConnection.addTransceiver(audioTrack, { direction: 'sendonly' });
      }

      // Step 5: Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Step 6: Wait for ICE gathering
      const completeOffer = await new Promise<RTCSessionDescription>((resolve) => {
        setTimeout(() => {
          resolve(peerConnection.localDescription!);
        }, 5000);
        
        peerConnection.onicegatheringstatechange = () => {
          if (peerConnection.iceGatheringState === 'complete') {
            resolve(peerConnection.localDescription!);
          }
        };
      });

      if (!completeOffer) {
        throw new Error('Failed to gather ICE candidates');
      }

      // Step 7: Send offer to server
      const sdpResponse = await fetch(redirectUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'content-type': 'application/sdp',
        },
        body: completeOffer.sdp,
      });

      if (!sdpResponse.ok) {
        throw new Error('Failed to negotiate with server');
      }

      // Step 8: Set remote description
      const answerSDP = await sdpResponse.text();
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSDP })
      );

      setIsStreaming(true);
      toast.success('Browser stream is now live!');
      onStreamStart?.();

      // Mark stream as live
      if (!isPreviewMode) {
        const streamId = localStorage.getItem('currentStreamId');
        if (streamId) {
          await supabase
            .from('streams')
            .update({ 
              is_live: true,
              last_heartbeat: new Date().toISOString(),
              stream_type: 'browser'
            })
            .eq('id', streamId);
        }
      }

      // Handle stream end when tracks end
      mediaStream.getTracks().forEach(track => {
        track.onended = () => {
          stopBroadcast();
        };
      });

    } catch (error) {
      console.error('Error starting broadcast:', error);
      toast.error('Failed to start broadcast');
      stopBroadcast();
    }
  };

  const stopBroadcast = async () => {
    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear video preview
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setStreamSource(null);
    toast.info('Browser stream ended');
    onStreamEnd?.();

    // Mark stream as ended
    if (!isPreviewMode) {
      const streamId = localStorage.getItem('currentStreamId');
      if (streamId) {
        await supabase
          .from('streams')
          .update({ 
            is_live: false,
            ended_at: new Date().toISOString()
          })
          .eq('id', streamId);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="w-full bg-black/50 rounded-xl overflow-hidden border border-white/10">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full aspect-video bg-black"
        />
      </div>

      {!isStreaming ? (
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => startBroadcast('camera')}
            className="flex items-center gap-2"
          >
            <Video className="w-4 h-4" />
            Stream Camera
          </Button>
          <Button
            onClick={() => startBroadcast('screen')}
            className="flex items-center gap-2"
            variant="secondary"
          >
            <Monitor className="w-4 h-4" />
            Share Screen
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 items-center">
          <div className="text-sm text-green-500 font-medium">
            🔴 Live - Broadcasting {streamSource === 'screen' ? 'Screen' : 'Camera'}
          </div>
          <Button onClick={stopBroadcast} variant="destructive">
            Stop Broadcast
          </Button>
        </div>
      )}
    </div>
  );
};

export default BrowserStreaming;
