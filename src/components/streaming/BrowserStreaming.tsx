import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Video, Monitor } from 'lucide-react';
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
  } = useBrowserStreaming();

  const { sessionToken, identity } = useWallet();
  const [broadcastSource, setBroadcastSource] = useState<'camera' | 'screen' | null>(null);

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

  const startBroadcast = async (source: 'camera' | 'screen') => {
    try {
      setStreamingMode(source);
      console.log(`[BrowserStreaming] Starting ${source} broadcast with Livepeer`);
      setBroadcastSource(source);
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

  const handleStreamStart = () => {
    console.log('[BrowserStreaming] Livepeer stream started');
    toast.success('Browser stream is now live!');
    onStreamStart?.();
  };

  const handleStreamEnd = () => {
    console.log('[BrowserStreaming] Livepeer stream ended');
    stopBroadcast();
  };

  const handleStreamError = (error: Error) => {
    console.error('[BrowserStreaming] Livepeer stream error:', error);
    toast.error(`Stream error: ${error.message}`);
    stopBroadcast();
  };

  return (
    <div className="space-y-4">
      {broadcastSource ? (
        <>
          <div className="w-full bg-black/50 rounded-xl overflow-hidden border border-white/10 aspect-video">
            <LivepeerBroadcast
              streamKey={streamKey}
              source={broadcastSource}
              onStreamStart={handleStreamStart}
              onStreamEnd={handleStreamEnd}
              onError={handleStreamError}
            />
          </div>
          
          <div className="flex flex-col gap-2 items-center">
            <p className="text-xs text-muted-foreground text-center">
              {broadcastSource === 'screen' 
                ? 'Step 1: Click "Enable Broadcast" → Step 2: Click "Share Screen" and select your display'
                : 'Click "Start Camera" and allow camera access'}
            </p>
            <Button onClick={stopBroadcast} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </>
      ) : (
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
      )}
    </div>
  );
};

export default BrowserStreaming;
