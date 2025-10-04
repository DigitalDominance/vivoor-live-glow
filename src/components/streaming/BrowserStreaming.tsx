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
  streamId?: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  isPreviewMode?: boolean;
}

const BrowserStreaming: React.FC<BrowserStreamingProps> = ({
  streamKey,
  streamId,
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
      if (isPreviewMode || !sessionToken || !identity?.address || !streamId) return;

      try {
        const { error } = await supabase.rpc('update_browser_stream_heartbeat', {
          session_token_param: sessionToken,
          wallet_address_param: identity.address,
          stream_id_param: streamId,
          is_live_param: true
        });

        if (error) {
          // Only log critical errors (not auth failures which happen during page transitions)
          if (error.code !== 'PGRST301' && !error.message?.includes('session')) {
            console.error('[BrowserStreaming] Heartbeat error:', error);
          }
        }
      } catch (err) {
        // Silently handle heartbeat failures to avoid spam
      }
    };

    if (isStreaming) {
      sendHeartbeat();
      heartbeatInterval = setInterval(sendHeartbeat, 5000);
    }

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }, [isStreaming, isPreviewMode, sessionToken, identity, streamId]);

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
      console.log('[BrowserStreaming] Stream key:', streamKey);
      
      // WHIP endpoint - stream already created by our Supabase edge function
      const whipUrl = `https://livepeer.studio/webrtc/${streamKey}`;
      console.log('[BrowserStreaming] WHIP endpoint:', whipUrl);

      // Set up ICE servers - use Google's public STUN servers as fallback
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.livepeer.studio' }
      ];

      // Get user media
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

      // Create peer connection
      console.log('[BrowserStreaming] Creating peer connection');
      const peerConnection = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = peerConnection;

      // Add all tracks to peer connection using addTransceiver (per Livepeer docs)
      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];
      
      if (videoTrack) {
        peerConnection.addTransceiver(videoTrack, { direction: 'sendonly' });
        console.log('[BrowserStreaming] Added video transceiver:', videoTrack.label);
      }
      
      if (audioTrack) {
        peerConnection.addTransceiver(audioTrack, { direction: 'sendonly' });
        console.log('[BrowserStreaming] Added audio transceiver:', audioTrack.label);
      }

      // Step 5: Create offer
      console.log('[BrowserStreaming] Creating SDP offer');
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Step 6: Wait for ICE gathering
      console.log('[BrowserStreaming] Waiting for ICE gathering');
      const completeOffer = await new Promise<RTCSessionDescription>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('[BrowserStreaming] ICE gathering timeout, using partial candidates');
          resolve(peerConnection.localDescription!);
        }, 5000);
        
        peerConnection.onicegatheringstatechange = () => {
          console.log('[BrowserStreaming] ICE gathering state:', peerConnection.iceGatheringState);
          if (peerConnection.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve(peerConnection.localDescription!);
          }
        };
      });

      if (!completeOffer || !completeOffer.sdp) {
        throw new Error('Failed to create offer SDP');
      }

      // POST offer to WHIP endpoint
      console.log('[BrowserStreaming] Sending WHIP POST to:', whipUrl);
      console.log('[BrowserStreaming] Offer SDP length:', completeOffer.sdp.length);
      
      const sdpResponse = await fetch(whipUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: completeOffer.sdp,
      });

      console.log('[BrowserStreaming] WHIP response status:', sdpResponse.status);
      
      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error('[BrowserStreaming] WHIP error response:', errorText);
        throw new Error(`Failed to negotiate with server: ${sdpResponse.status}`);
      }

      // Set remote description from answer
      console.log('[BrowserStreaming] Setting remote description');
      const answerSDP = await sdpResponse.text();
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSDP })
      );

      // Monitor connection state with more nuanced handling
      peerConnection.onconnectionstatechange = () => {
        console.log('[BrowserStreaming] Connection state:', peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
          console.log('[BrowserStreaming] Peer connection fully established');
        } else if (peerConnection.connectionState === 'failed') {
          console.error('[BrowserStreaming] Connection failed');
          toast.error('Failed to connect to streaming server');
          stopBroadcast();
        } else if (peerConnection.connectionState === 'disconnected') {
          console.warn('[BrowserStreaming] Connection disconnected, attempting to reconnect...');
          // Give it a moment to reconnect before stopping
          setTimeout(() => {
            if (peerConnection.connectionState === 'disconnected') {
              console.error('[BrowserStreaming] Connection lost to Livepeer');
              toast.error('Lost connection to streaming server');
              stopBroadcast();
            }
          }, 3000);
        }
      };

      // Monitor ICE connection state for better debugging
      peerConnection.oniceconnectionstatechange = () => {
        console.log('[BrowserStreaming] ICE connection state:', peerConnection.iceConnectionState);
        
        if (peerConnection.iceConnectionState === 'failed') {
          console.error('[BrowserStreaming] ICE connection failed - likely NAT/firewall issue');
          toast.error('Connection failed - please check network settings');
          stopBroadcast();
        } else if (peerConnection.iceConnectionState === 'disconnected') {
          console.warn('[BrowserStreaming] ICE connection disconnected');
          setTimeout(() => {
            if (peerConnection.iceConnectionState === 'disconnected') {
              console.error('[BrowserStreaming] ICE connection still disconnected after 3s');
              toast.error('Connection lost');
              stopBroadcast();
            }
          }, 3000);
        }
      };
      
      // Log ICE candidates for debugging
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[BrowserStreaming] ICE candidate:', event.candidate.type, event.candidate.protocol);
        } else {
          console.log('[BrowserStreaming] All ICE candidates sent');
        }
      };

      // Log stats every 5 seconds to verify data is flowing
      const statsInterval = setInterval(async () => {
        if (peerConnection.connectionState === 'connected') {
          const stats = await peerConnection.getStats();
          stats.forEach(stat => {
            if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
              console.log('[BrowserStreaming] Video stats:', {
                bytesSent: stat.bytesSent,
                packetsSent: stat.packetsSent,
                framesEncoded: stat.framesEncoded
              });
            }
          });
        }
      }, 5000);

      // Store interval for cleanup
      (peerConnection as any)._statsInterval = statsInterval;

      console.log('[BrowserStreaming] WebRTC connection established');
      setIsStreaming(true);
      toast.success('Browser stream is now live!');
      onStreamStart?.();

      // Stream is already marked as live by create_stream_secure in GoLive.tsx
      // The heartbeat interval will keep it alive using the streamId from localStorage

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
      // Clear stats interval
      if ((peerConnectionRef.current as any)._statsInterval) {
        clearInterval((peerConnectionRef.current as any)._statsInterval);
      }
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
    if (!isPreviewMode && sessionToken && identity?.address && streamId) {
      console.log('[BrowserStreaming] Marking stream as ended');
      await supabase.rpc('update_browser_stream_heartbeat', {
        session_token_param: sessionToken,
        wallet_address_param: identity.address,
        stream_id_param: streamId,
        is_live_param: false
      });
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
