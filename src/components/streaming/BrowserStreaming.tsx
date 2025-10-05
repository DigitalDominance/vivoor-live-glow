import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';
import { useBrowserStreaming } from '@/context/BrowserStreamingContext';
import { useWallet } from '@/context/WalletContext';
import { LivepeerBroadcast } from './LivepeerBroadcast';

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
    isStreaming,
    setIsStreaming,
    setIsPreviewing,
    streamingMode,
    setStreamingMode,
    isStreamPreserved,
  } = useBrowserStreaming();

  const { sessionToken, identity } = useWallet();
  const [broadcastSource, setBroadcastSource] = useState<'camera' | null>(
    // If stream is preserved, automatically set broadcast source
    isStreamPreserved ? 'camera' : null
  );
  
  // Handle preserved stream on mount
  React.useEffect(() => {
    if (isStreamPreserved && !isPreviewMode) {
      console.log('[BrowserStreaming] Using preserved stream connection');
      setBroadcastSource('camera');
      setIsStreaming(true);
      setIsPreviewing(false);
      onStreamStart?.();
    }
  }, []);

  // Send heartbeat to mark stream as live
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

  const startBroadcast = async () => {
    try {
      setStreamingMode('camera');
      console.log('[BrowserStreaming] Starting camera broadcast with Livepeer');
      setBroadcastSource('camera');
    } catch (error) {
      console.error('[BrowserStreaming] Error starting broadcast:', error);
      toast.error('Failed to start broadcast');
    }
  };

  const stopBroadcast = async () => {
    console.log('[BrowserStreaming] Stopping broadcast');
    
    setBroadcastSource(null);
    setIsStreaming(false);
    setIsPreviewing(false);
    onStreamEnd?.();

    // Mark stream as ended using secure RPC function
    if (!isPreviewMode && sessionToken && identity?.address && streamId) {
      console.log('[BrowserStreaming] Marking stream as ended');
      try {
        await supabase.rpc('update_browser_stream_heartbeat', {
          session_token_param: sessionToken,
          wallet_address_param: identity.address,
          stream_id_param: streamId,
          is_live_param: false
        });
      } catch (error) {
        console.error('[BrowserStreaming] Error marking stream as ended:', error);
      }
    }
  };

  const handleStreamStart = () => {
    console.log('[BrowserStreaming] Livepeer stream started');
    toast.success('Camera connected!');
    onStreamStart?.();
  };

  const handleStreamEnd = () => {
    console.log('[BrowserStreaming] Livepeer stream ended');
    stopBroadcast();
  };

  const handleStreamError = (error: Error) => {
    console.error('[BrowserStreaming] Livepeer stream error:', error);
    stopBroadcast();
  };

  return (
    <div className="space-y-4">
      {broadcastSource ? (
        <>
          <div className="w-full rounded-xl overflow-hidden aspect-video">
            <LivepeerBroadcast
              key={streamKey}
              streamKey={streamKey}
              onStreamStart={handleStreamStart}
              onStreamEnd={handleStreamEnd}
              onError={handleStreamError}
            />
          </div>
          
          {!isPreviewMode && (
            <div className="flex flex-col gap-2 items-center">
              <Button onClick={stopBroadcast} variant="destructive" size="sm">
                End Stream
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex gap-4 justify-center">
          <Button
            onClick={startBroadcast}
            className="flex items-center gap-2"
          >
            <Video className="w-4 h-4" />
            Start Camera Stream
          </Button>
        </div>
      )}
    </div>
  );
};

export default BrowserStreaming;
