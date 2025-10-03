import React from "react";

type WebRtcPlayerProps = {
  playbackId: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  onStreamReady?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
};

const WebRtcPlayer: React.FC<WebRtcPlayerProps> = ({ 
  playbackId, 
  poster, 
  autoPlay = true, 
  className, 
  onStreamReady,
  videoRef: externalVideoRef 
}) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const peerConnectionRef = React.useRef<RTCPeerConnection | null>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackId) return;

    console.log('🎬 WebRTC Player: Initializing for playback ID:', playbackId);
    setLoading(true);
    setError(null);

    let peerConnection: RTCPeerConnection | null = null;

    const startWebRtcPlayback = async () => {
      try {
        // Step 1: Create the WHEP endpoint URL
        const whepUrl = `https://livepeercdn.studio/webrtc/${playbackId}`;
        console.log('🎬 WebRTC: Connecting to WHEP endpoint:', whepUrl);

        // Step 2: Extract host for ICE servers from the URL
        const host = new URL(whepUrl).host;
        const iceServers = [
          { urls: `stun:${host}` },
          {
            urls: `turn:${host}`,
            username: "livepeer",
            credential: "livepeer",
          },
        ];

        // Step 3: Create peer connection
        peerConnection = new RTCPeerConnection({ iceServers });
        peerConnectionRef.current = peerConnection;

        // Step 4: Set up to receive video and audio
        peerConnection.addTransceiver('video', { direction: 'recvonly' });
        peerConnection.addTransceiver('audio', { direction: 'recvonly' });

        // Step 5: Handle incoming tracks
        peerConnection.ontrack = (event) => {
          console.log('🎬 WebRTC: Received track:', event.track.kind);
          if (video.srcObject !== event.streams[0]) {
            video.srcObject = event.streams[0];
            console.log('🎬 WebRTC: Set video srcObject');
          }
        };

        // Step 6: Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
          console.log('🎬 WebRTC: Connection state:', peerConnection?.connectionState);
          if (peerConnection?.connectionState === 'connected') {
            setLoading(false);
            setError(null);
            if (onStreamReady) {
              onStreamReady();
            }
          } else if (peerConnection?.connectionState === 'failed') {
            setError('WebRTC connection failed');
            setLoading(false);
          }
        };

        // Step 7: Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Step 8: Wait for ICE gathering
        const offerWithIce = await new Promise<RTCSessionDescription>((resolve) => {
          setTimeout(() => {
            resolve(peerConnection!.localDescription!);
          }, 5000);
          
          peerConnection!.onicegatheringstatechange = () => {
            if (peerConnection!.iceGatheringState === 'complete') {
              resolve(peerConnection!.localDescription!);
            }
          };
        });

        if (!offerWithIce || !offerWithIce.sdp) {
          throw new Error('Failed to gather ICE candidates');
        }

        // Step 9: Send offer to Livepeer WHEP endpoint
        console.log('🎬 WebRTC: Sending offer to:', whepUrl);
        const sdpResponse = await fetch(whepUrl, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'content-type': 'application/sdp',
          },
          body: offerWithIce.sdp,
        });

        if (!sdpResponse.ok) {
          throw new Error(`SDP negotiation failed: ${sdpResponse.status}`);
        }

        const answerSdp = await sdpResponse.text();
        console.log('🎬 WebRTC: Received answer SDP');

        // Step 10: Set remote description
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: answerSdp })
        );

        console.log('🎬 WebRTC: Playback initialized successfully');

        // Auto play
        if (autoPlay) {
          video.play().catch((err) => {
            console.warn('🎬 Autoplay failed:', err);
            setError('Click to play');
          });
        }

      } catch (err) {
        console.error('🎬 WebRTC error:', err);
        setError(err instanceof Error ? err.message : 'WebRTC playback failed');
        setLoading(false);
      }
    };

    startWebRtcPlayback();

    // Cleanup
    return () => {
      console.log('🎬 WebRTC: Cleaning up');
      if (peerConnection) {
        peerConnection.close();
      }
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    };
  }, [playbackId, autoPlay, onStreamReady]);

  return (
    <div className={"relative rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md " + (className || "")}
      aria-label="Live WebRTC player">
      <div className="aspect-[16/9] relative">
        <video 
          ref={(el) => {
            videoRef.current = el;
            if (externalVideoRef && externalVideoRef.current !== el) {
              (externalVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
            }
          }} 
          poster={poster} 
          controls={false} 
          autoPlay={autoPlay} 
          muted 
          playsInline 
          className="w-full h-full object-contain bg-background" 
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-sm text-muted-foreground">Connecting to stream...</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebRtcPlayer;
