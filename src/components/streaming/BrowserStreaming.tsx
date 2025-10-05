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
    startHeartbeat,
    stopHeartbeat,
    setIsBroadcastActive,
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

  // Start heartbeat when streaming starts
  useEffect(() => {
    if (isStreaming && !isPreviewMode && sessionToken && identity?.address && streamId) {
      console.log('[BrowserStreaming] Starting global heartbeat');
      startHeartbeat(streamId, sessionToken, identity.address);
    }
    
    return () => {
      // Don't stop heartbeat on unmount - it will continue globally
      console.log('[BrowserStreaming] Component unmounting, heartbeat continues globally');
    };
  }, [isStreaming, isPreviewMode, sessionToken, identity?.address, streamId, startHeartbeat]);

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
    setIsBroadcastActive(false); // Mark broadcast as inactive
    
    // Stop the global heartbeat
    stopHeartbeat();
    
    onStreamEnd?.();
  };

  const handleStreamStart = () => {
    console.log('[BrowserStreaming] Livepeer stream started');
    setIsStreaming(true); // Set streaming state to start heartbeat
    setIsPreviewing(false);
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
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-purple-500/50"
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
