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
  const whipResourceRef = useRef<string | null>(null);
  const iceRestartAttemptsRef = useRef(0);

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

      // ICE servers - will be updated from Link header
      let iceServers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
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

      // CRITICAL: Parse Link header for ICE servers (replaces defaults)
      const linkHeader = sdpResponse.headers.get('Link');
      if (linkHeader) {
        console.log('[BrowserStreaming] Link header received:', linkHeader);
        
        // Parse ICE servers from Link header with credentials
        // Format: <stun:server>; rel="ice-server"; username="x"; credential="y"
        const parsedServers: RTCIceServer[] = [];
        const serverMatches = linkHeader.split(',');
        
        for (const serverEntry of serverMatches) {
          const urlMatch = serverEntry.match(/<([^>]+)>/);
          const relMatch = serverEntry.match(/rel="([^"]+)"/);
          
          if (urlMatch && relMatch && relMatch[1] === 'ice-server') {
            const urls = urlMatch[1];
            const usernameMatch = serverEntry.match(/username="([^"]+)"/);
            const credentialMatch = serverEntry.match(/credential="([^"]+)"/);
            
            const server: RTCIceServer = { urls };
            if (usernameMatch) server.username = usernameMatch[1];
            if (credentialMatch) server.credential = credentialMatch[1];
            
            parsedServers.push(server);
            console.log('[BrowserStreaming] Parsed ICE server:', server);
          }
        }
        
        if (parsedServers.length > 0) {
          iceServers = parsedServers; // Replace with Livepeer's servers
          console.log(`[BrowserStreaming] Using ${parsedServers.length} ICE servers from Livepeer`);
        }
      }

      // CRITICAL: Store resource location for potential PATCH requests (trickle ICE)
      const locationHeader = sdpResponse.headers.get('Location');
      if (locationHeader) {
        whipResourceRef.current = locationHeader;
        console.log('[BrowserStreaming] WHIP resource URL:', locationHeader);
      }

      // Set remote description from answer
      console.log('[BrowserStreaming] Setting remote description');
      const answerSDP = await sdpResponse.text();
      
      // CRITICAL: Log the full answer SDP to diagnose candidate format
      console.log('[BrowserStreaming] ===== FULL ANSWER SDP =====');
      console.log(answerSDP);
      console.log('[BrowserStreaming] ===== END ANSWER SDP =====');
      
      // Log answer SDP to check for embedded ICE candidates
      const candidateLines = answerSDP.split('\n').filter(line => line.startsWith('a=candidate:'));
      console.log(`[BrowserStreaming] Answer SDP contains ${candidateLines.length} ICE candidates`);
      
      if (candidateLines.length > 0) {
        console.log('[BrowserStreaming] First candidate:', candidateLines[0]);
      }
      
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSDP })
      );
      
      // CRITICAL: Verify remote description was set correctly
      console.log('[BrowserStreaming] Remote description set:', {
        type: peerConnection.remoteDescription?.type,
        hasSDP: !!peerConnection.remoteDescription?.sdp,
        sdpLength: peerConnection.remoteDescription?.sdp?.length
      });
      
      // ===== ICE CANDIDATE LOGGING (No trickle ICE - Livepeer doesn't support PATCH) =====
      // All candidates are exchanged in initial SDP offer/answer
      let candidatesSent = 0;
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          const c = event.candidate;
          candidatesSent++;
          
          console.log(`[BrowserStreaming] 🧊 Local ICE candidate #${candidatesSent}:`, {
            type: c.type,
            protocol: c.protocol,
            address: c.address,
            port: c.port,
            priority: c.priority
          });
        } else {
          console.log(`[BrowserStreaming] ✅ All ${candidatesSent} local ICE candidates gathered`);
          
          // Start monitoring ICE candidate pairs to see which ones are being tested
          monitorICECandidatePairs(peerConnection);
        }
      };

      // Helper function to monitor ICE candidate pairs
      const monitorICECandidatePairs = async (pc: RTCPeerConnection) => {
        console.log('[BrowserStreaming] 🔍 Monitoring ICE candidate pairs...');
        
        const checkInterval = setInterval(async () => {
          if (pc.connectionState === 'connected' || pc.connectionState === 'closed') {
            clearInterval(checkInterval);
            return;
          }
          
          const stats = await pc.getStats();
          let foundPairs = false;
          
          stats.forEach(stat => {
            if (stat.type === 'candidate-pair') {
              foundPairs = true;
              console.log('[BrowserStreaming] ICE candidate pair:', {
                state: stat.state,
                local: stat.localCandidateId,
                remote: stat.remoteCandidateId,
                nominated: stat.nominated,
                bytesSent: stat.bytesSent,
                bytesReceived: stat.bytesReceived
              });
            }
          });
          
          if (!foundPairs) {
            console.warn('[BrowserStreaming] ⚠️ No ICE candidate pairs found - remote candidates may be missing');
          }
        }, 2000);
        
        // Stop monitoring after 30 seconds
        setTimeout(() => clearInterval(checkInterval), 30000);
      };

      // Monitor connection state with ICE restart capability
      peerConnection.onconnectionstatechange = async () => {
        console.log('[BrowserStreaming] Connection state:', peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
          console.log('[BrowserStreaming] ✅ Peer connection fully established');
          iceRestartAttemptsRef.current = 0; // Reset restart counter on success
          toast.success('Stream connection established!');
          
          // Start monitoring media flow
          monitorMediaFlow(peerConnection);
        } else if (peerConnection.connectionState === 'failed') {
          console.error('[BrowserStreaming] ❌ Connection failed');
          
          // Log stats to diagnose why it failed
          const stats = await peerConnection.getStats();
          let hasRemoteCandidates = false;
          let hasLocalCandidates = false;
          
          stats.forEach(stat => {
            if (stat.type === 'remote-candidate') hasRemoteCandidates = true;
            if (stat.type === 'local-candidate') hasLocalCandidates = true;
          });
          
          // CRITICAL: Log detailed stats to diagnose the issue
          console.error('[BrowserStreaming] Failure diagnosis:', {
            hasLocalCandidates,
            hasRemoteCandidates,
            localDescription: !!peerConnection.localDescription,
            remoteDescription: !!peerConnection.remoteDescription
          });
          
          // Log all remote candidates from getStats
          console.log('[BrowserStreaming] Examining all remote candidates:');
          stats.forEach(stat => {
            if (stat.type === 'remote-candidate') {
              console.log('[BrowserStreaming] Remote candidate found:', {
                id: stat.id,
                address: stat.address,
                port: stat.port,
                protocol: stat.protocol,
                type: stat.candidateType
              });
            }
          });
          
          // ICE restart doesn't work with Livepeer (403 Forbidden)
          // Just fail and let user retry from scratch
          console.error('[BrowserStreaming] Connection failed - no ICE restart support');
          toast.error('Unable to establish connection. Please try again.');
          stopBroadcast();
        } else if (peerConnection.connectionState === 'disconnected') {
          console.warn('[BrowserStreaming] ⚠️ Connection disconnected, waiting for recovery...');
          // Give it more time (10s) to reconnect before taking action
          setTimeout(() => {
            if (peerConnection.connectionState === 'disconnected' || 
                peerConnection.connectionState === 'failed') {
              console.error('[BrowserStreaming] Connection did not recover');
              toast.error('Connection lost');
              stopBroadcast();
            }
          }, 10000);
        }
      };

      // Monitor ICE connection state with detailed transitions
      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log('[BrowserStreaming] 🧊 ICE connection state:', state);
        
        if (state === 'connected' || state === 'completed') {
          console.log('[BrowserStreaming] ✅ ICE connection established successfully');
        } else if (state === 'checking') {
          console.log('[BrowserStreaming] 🔍 ICE candidates being checked...');
        } else if (state === 'failed') {
          console.error('[BrowserStreaming] ❌ ICE connection failed');
          console.error('[BrowserStreaming] This usually indicates:');
          console.error('[BrowserStreaming] - Firewall blocking WebRTC');
          console.error('[BrowserStreaming] - No valid ICE candidate pairs found');
          console.error('[BrowserStreaming] - TURN server not reachable');
          // Don't immediately stop - let connection state handler manage ICE restart
        } else if (state === 'disconnected') {
          console.warn('[BrowserStreaming] ⚠️ ICE connection disconnected');
          // Give it time to reconnect before taking action
        }
      };
      

      // Helper function to monitor media flow
      const monitorMediaFlow = (pc: RTCPeerConnection) => {
        let lastBytesSent = 0;
        
        const statsInterval = setInterval(async () => {
          if (pc.connectionState !== 'connected') {
            clearInterval(statsInterval);
            return;
          }
          
          const stats = await pc.getStats();
          stats.forEach(stat => {
            if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
              const bytesDelta = stat.bytesSent - lastBytesSent;
              const kbps = (bytesDelta * 8) / (5 * 1024); // 5 second interval
              
              console.log('[BrowserStreaming] 📊 Video stream:', {
                bytesSent: stat.bytesSent,
                bandwidth: `${kbps.toFixed(1)} kbps`,
                packetsSent: stat.packetsSent,
                framesEncoded: stat.framesEncoded,
                isFlowing: bytesDelta > 0
              });
              
              if (bytesDelta === 0) {
                console.warn('[BrowserStreaming] ⚠️ No data flowing - stream may be frozen');
              }
              
              lastBytesSent = stat.bytesSent;
            }
          });
        }, 5000);

        // Store interval for cleanup
        (pc as any)._statsInterval = statsInterval;
      };

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
    
    // Reset ICE restart counter
    iceRestartAttemptsRef.current = 0;
    
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
    
    // Clear WHIP resource reference
    whipResourceRef.current = null;

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
