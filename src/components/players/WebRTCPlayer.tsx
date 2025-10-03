import React, { useEffect, useRef } from 'react';

interface WebRTCPlayerProps {
  streamKey: string;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  autoPlay?: boolean;
}

const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({ 
  streamKey, 
  className = '',
  videoRef: externalVideoRef,
  autoPlay = true
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    const setupWebRTCConnection = async () => {
      if (!streamKey || cancelled) return;

      try {
        console.log('[WebRTCPlayer] Setting up WebRTC connection for playback');

        // Step 1: Get redirect URL
        const redirectResponse = await fetch(`https://livepeer.studio/webrtc/${streamKey}`, {
          method: 'HEAD',
          redirect: 'manual'
        });

        const redirectUrl = redirectResponse.headers.get('Location') || 
                           `https://livepeer.studio/webrtc/${streamKey}`;
        
        console.log('[WebRTCPlayer] Redirect URL:', redirectUrl);
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

        // Step 3: Create peer connection for receiving
        const peerConnection = new RTCPeerConnection({ iceServers });
        peerConnectionRef.current = peerConnection;

        // Add transceivers to receive video and audio
        peerConnection.addTransceiver('video', { direction: 'recvonly' });
        peerConnection.addTransceiver('audio', { direction: 'recvonly' });

        // Handle incoming tracks
        peerConnection.ontrack = (event) => {
          console.log('[WebRTCPlayer] Received track:', event.track.kind);
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        // Step 4: Create offer
        console.log('[WebRTCPlayer] Creating SDP offer');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Step 5: Wait for ICE gathering
        console.log('[WebRTCPlayer] Waiting for ICE gathering');
        const completeOffer = await new Promise<RTCSessionDescription>((resolve) => {
          setTimeout(() => {
            console.log('[WebRTCPlayer] ICE gathering timeout');
            resolve(peerConnection.localDescription!);
          }, 5000);
          
          peerConnection.onicegatheringstatechange = () => {
            console.log('[WebRTCPlayer] ICE gathering state:', peerConnection.iceGatheringState);
            if (peerConnection.iceGatheringState === 'complete') {
              resolve(peerConnection.localDescription!);
            }
          };
        });

        if (!completeOffer || cancelled) {
          throw new Error('Failed to gather ICE candidates');
        }

        // Step 6: Send offer to server
        console.log('[WebRTCPlayer] Sending offer to Livepeer');
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

        // Step 7: Set remote description
        console.log('[WebRTCPlayer] Setting remote description');
        const answerSDP = await sdpResponse.text();
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: answerSDP })
        );

        console.log('[WebRTCPlayer] WebRTC connection established for playback');

      } catch (error) {
        console.error('[WebRTCPlayer] Error setting up WebRTC connection:', error);
      }
    };

    setupWebRTCConnection();

    return () => {
      cancelled = true;
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [streamKey]);

  return (
    <video
      ref={videoRef}
      autoPlay={autoPlay}
      playsInline
      controls={false}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
};

export default WebRTCPlayer;
