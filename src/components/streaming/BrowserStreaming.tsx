import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Video, Monitor } from 'lucide-react';
import { useBrowserStreaming } from '@/context/BrowserStreamingContext';
import { useWallet } from '@/context/WalletContext';

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
  const {
    mediaStreamRef,
    isStreaming,
    setIsStreaming,
    isPreviewing,
    setIsPreviewing,
    streamingMode,
    setStreamingMode,
    isStreamPreserved,
  } = useBrowserStreaming();

  const { sessionToken, identity } = useWallet();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Send heartbeat to mark stream as live - using secure RPC function like RTMP
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const sendHeartbeat = async () => {
      if (isPreviewMode || !sessionToken || !identity?.address) return;

      const streamId = localStorage.getItem('currentStreamId');
      if (!streamId) {
        console.log('[BrowserStreaming] No streamId in localStorage');
        return;
      }

      try {
        console.log(`[BrowserStreaming] Sending heartbeat - streamId: ${streamId}`);
        const { error } = await supabase.rpc('update_browser_stream_heartbeat', {
          session_token_param: sessionToken,
          wallet_address_param: identity.address,
          stream_id_param: streamId,
          is_live_param: true
        });

        if (error) {
          console.error('[BrowserStreaming] Heartbeat error:', error);
        } else {
          console.log('[BrowserStreaming] Heartbeat sent successfully');
        }
      } catch (err) {
        console.error('[BrowserStreaming] Heartbeat failed:', err);
      }
    };

    if (isStreaming) {
      console.log('[BrowserStreaming] Starting heartbeat interval');
      sendHeartbeat();
      heartbeatInterval = setInterval(sendHeartbeat, 5000);
    }

    return () => {
      if (heartbeatInterval) {
        console.log('[BrowserStreaming] Clearing heartbeat interval');
        clearInterval(heartbeatInterval);
      }
    };
  }, [isStreaming, isPreviewMode, sessionToken, identity]);

  // Restore preserved stream on mount
  useEffect(() => {
    if (isStreamPreserved && mediaStreamRef.current && videoRef.current) {
      console.log('[BrowserStreaming] Restoring preserved stream');
      videoRef.current.srcObject = mediaStreamRef.current;
      setIsPreviewing(true);
    }
  }, [isStreamPreserved]);

  const startBroadcast = async (source: 'camera' | 'screen') => {
    try {
      setStreamingMode(source);
      console.log(`[BrowserStreaming] Starting ${source} broadcast`);
      
      // Step 1: Get redirect URL
      console.log('[BrowserStreaming] Getting redirect URL from Livepeer');
      const redirectResponse = await fetch(`https://livepeer.studio/webrtc/${streamKey}`, {
        method: 'HEAD',
        redirect: 'manual'
      });
      
      const redirectUrl = redirectResponse.headers.get('Location') || 
                         `https://livepeer.studio/webrtc/${streamKey}`;
      
      console.log('[BrowserStreaming] Redirect URL:', redirectUrl);
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

      // Step 3: Get user media with encoding parameters to disable B-frames
      console.log(`[BrowserStreaming] Requesting ${source} media`);
      const mediaStream = source === 'screen' 
        ? await navigator.mediaDevices.getDisplayMedia({
            video: { 
              width: { ideal: 1920 }, 
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            },
            audio: true,
          })
        : await navigator.mediaDevices.getUserMedia({
            video: { 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            },
            audio: true,
          });

      console.log('[BrowserStreaming] Media stream obtained:', {
        video: mediaStream.getVideoTracks().length,
        audio: mediaStream.getAudioTracks().length
      });

      mediaStreamRef.current = mediaStream;

      // Set video preview
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsPreviewing(true);

      // Step 4: Create peer connection
      console.log('[BrowserStreaming] Creating peer connection');
      const peerConnection = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = peerConnection;

      // Add tracks with encoding parameters to disable B-frames
      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];

      if (videoTrack) {
        const videoSender = peerConnection.addTransceiver(videoTrack, { 
          direction: 'sendonly',
          sendEncodings: [{
            // Disable B-frames by setting max bitrate and forcing baseline profile
            maxBitrate: 2500000, // 2.5 Mbps
            maxFramerate: 30,
          }]
        });
        console.log('[BrowserStreaming] Added video track with no B-frames encoding');
      }
      if (audioTrack) {
        peerConnection.addTransceiver(audioTrack, { direction: 'sendonly' });
        console.log('[BrowserStreaming] Added audio track');
      }

      // Step 5: Create offer and modify SDP to force baseline profile (no B-frames)
      console.log('[BrowserStreaming] Creating SDP offer');
      const offer = await peerConnection.createOffer();
      
      // Modify SDP to force H.264 baseline profile (profile-level-id=42e01f or 42001f)
      // This prevents B-frames from being used
      if (offer.sdp) {
        let modifiedSdp = offer.sdp;
        
        // Force baseline profile for H.264
        // Replace any existing profile-level-id with baseline (42e01f = baseline level 3.1)
        modifiedSdp = modifiedSdp.replace(
          /profile-level-id=[0-9a-fA-F]{6}/g,
          'profile-level-id=42e01f'
        );
        
        // Also add baseline profile if not present
        if (!modifiedSdp.includes('profile-level-id')) {
          modifiedSdp = modifiedSdp.replace(
            /(a=fmtp:\d+)/g,
            '$1 profile-level-id=42e01f;level-asymmetry-allowed=1'
          );
        }
        
        // Remove any B-frame related parameters
        modifiedSdp = modifiedSdp.replace(/max-br=[0-9]+;?/g, '');
        modifiedSdp = modifiedSdp.replace(/max-mbps=[0-9]+;?/g, '');
        
        console.log('[BrowserStreaming] Modified SDP to force baseline profile (no B-frames)');
        offer.sdp = modifiedSdp;
      }
      
      await peerConnection.setLocalDescription(offer);

      // Step 6: Wait for ICE gathering
      console.log('[BrowserStreaming] Waiting for ICE gathering');
      const completeOffer = await new Promise<RTCSessionDescription>((resolve) => {
        setTimeout(() => {
          console.log('[BrowserStreaming] ICE gathering timeout');
          resolve(peerConnection.localDescription!);
        }, 5000);
        
        peerConnection.onicegatheringstatechange = () => {
          console.log('[BrowserStreaming] ICE gathering state:', peerConnection.iceGatheringState);
          if (peerConnection.iceGatheringState === 'complete') {
            resolve(peerConnection.localDescription!);
          }
        };
      });

      if (!completeOffer) {
        throw new Error('Failed to gather ICE candidates');
      }

      // Step 7: Send offer to server
      console.log('[BrowserStreaming] Sending offer to Livepeer');
      const sdpResponse = await fetch(redirectUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'content-type': 'application/sdp',
        },
        body: completeOffer.sdp,
      });

      if (!sdpResponse.ok) {
        throw new Error(`Failed to negotiate with server: ${sdpResponse.status}`);
      }

      // Step 8: Set remote description
      console.log('[BrowserStreaming] Setting remote description');
      const answerSDP = await sdpResponse.text();
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSDP })
      );

      console.log('[BrowserStreaming] WebRTC connection established');
      setIsStreaming(true);
      toast.success('Browser stream is now live!');
      onStreamStart?.();

      // Mark stream as live using secure RPC function - same as RTMP
      if (!isPreviewMode && sessionToken && identity?.address) {
        const streamId = localStorage.getItem('currentStreamId');
        console.log('[BrowserStreaming] Marking stream as live, streamId:', streamId);
        
        if (streamId) {
          const { error } = await supabase.rpc('update_browser_stream_heartbeat', {
            session_token_param: sessionToken,
            wallet_address_param: identity.address,
            stream_id_param: streamId,
            is_live_param: true
          });

          if (error) {
            console.error('[BrowserStreaming] Failed to mark stream as live:', error);
          } else {
            console.log('[BrowserStreaming] Stream marked as live successfully');
          }
        } else {
          console.error('[BrowserStreaming] No streamId found in localStorage');
        }
      }

      // Handle stream end when tracks end
      mediaStream.getTracks().forEach(track => {
        track.onended = () => {
          console.log('[BrowserStreaming] Track ended:', track.kind);
          stopBroadcast();
        };
      });

    } catch (error) {
      console.error('[BrowserStreaming] Error starting broadcast:', error);
      toast.error('Failed to start broadcast');
      stopBroadcast();
    }
  };

  const stopBroadcast = async () => {
    console.log('[BrowserStreaming] Stopping broadcast');
    
    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[BrowserStreaming] Stopped track:', track.kind);
      });
      mediaStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log('[BrowserStreaming] Closed peer connection');
    }

    // Clear video preview
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setIsPreviewing(false);
    toast.info('Browser stream ended');
    onStreamEnd?.();

    // Mark stream as ended using secure RPC function
    if (!isPreviewMode && sessionToken && identity?.address) {
      const streamId = localStorage.getItem('currentStreamId');
      if (streamId) {
        console.log('[BrowserStreaming] Marking stream as ended');
        await supabase.rpc('update_browser_stream_heartbeat', {
          session_token_param: sessionToken,
          wallet_address_param: identity.address,
          stream_id_param: streamId,
          is_live_param: false
        });
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
            🔴 Live - Broadcasting {streamingMode === 'screen' ? 'Screen' : 'Camera'}
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
