import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as Broadcast from '@livepeer/react/broadcast';
import { getIngest } from '@livepeer/react/external';
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
  const { sessionToken, identity } = useWallet();
  const [isEnabled, setIsEnabled] = React.useState(false);

  // Send heartbeat to mark stream as live when broadcast is enabled
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const sendHeartbeat = async () => {
      if (isPreviewMode || !sessionToken || !identity?.address || !isEnabled) return;

      const streamId = localStorage.getItem('currentStreamId');
      if (!streamId) {
        console.log('[BrowserStreaming] No streamId in localStorage');
        return;
      }

      try {
        console.log(`[BrowserStreaming] Sending heartbeat - streamId: ${streamId}, enabled: ${isEnabled}`);
        const { error } = await supabase.rpc('update_browser_stream_heartbeat', {
          session_token_param: sessionToken,
          wallet_address_param: identity.address,
          stream_id_param: streamId,
          is_live_param: isEnabled
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

    if (isEnabled) {
      console.log('[BrowserStreaming] Starting heartbeat interval');
      sendHeartbeat();
      heartbeatInterval = setInterval(sendHeartbeat, 3000);
    }

    return () => {
      if (heartbeatInterval) {
        console.log('[BrowserStreaming] Clearing heartbeat interval');
        clearInterval(heartbeatInterval);
      }
    };
  }, [isEnabled, isPreviewMode, sessionToken, identity]);

  // Handle stream start/end
  useEffect(() => {
    if (isEnabled) {
      console.log('[BrowserStreaming] Broadcast enabled');
      onStreamStart?.();
      
      // Mark stream as live using secure RPC function
      if (!isPreviewMode && sessionToken && identity?.address) {
        const streamId = localStorage.getItem('currentStreamId');
        console.log('[BrowserStreaming] Marking stream as live, streamId:', streamId);
        
        if (streamId) {
          supabase.rpc('update_browser_stream_heartbeat', {
            session_token_param: sessionToken,
            wallet_address_param: identity.address,
            stream_id_param: streamId,
            is_live_param: true
          }).then(({ error }) => {
            if (error) {
              console.error('[BrowserStreaming] Failed to mark stream as live:', error);
            } else {
              console.log('[BrowserStreaming] Stream marked as live successfully');
            }
          });
        }
      }
    } else {
      console.log('[BrowserStreaming] Broadcast disabled');
      onStreamEnd?.();
      
      // Mark stream as ended using secure RPC function
      if (!isPreviewMode && sessionToken && identity?.address) {
        const streamId = localStorage.getItem('currentStreamId');
        if (streamId) {
          console.log('[BrowserStreaming] Marking stream as ended');
          supabase.rpc('update_browser_stream_heartbeat', {
            session_token_param: sessionToken,
            wallet_address_param: identity.address,
            stream_id_param: streamId,
            is_live_param: false
          });
        }
      }
    }
  }, [isEnabled, isPreviewMode, sessionToken, identity, onStreamStart, onStreamEnd]);

  return (
    <Broadcast.Root 
      ingestUrl={getIngest(streamKey)}
      aspectRatio={16 / 9}
      video={{
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }}
      audio={true}
      hotkeys={true}
      timeout={15000}
    >
      <Broadcast.Container className="w-full glass rounded-xl overflow-hidden border border-white/20 aspect-video relative shadow-2xl">
        <Broadcast.Video 
          title="Browser Stream Preview" 
          className="w-full h-full bg-gradient-to-br from-black/90 via-black/80 to-black/90"
        />
        
        {/* Status Indicator - Glass effect */}
        <Broadcast.LoadingIndicator asChild matcher={false}>
          <div className="absolute overflow-hidden py-1.5 px-3 rounded-full top-3 left-3 glass flex items-center backdrop-blur-md z-10 border border-white/20">
            <Broadcast.StatusIndicator
              matcher="live"
              className="flex gap-2 items-center"
            >
              <div className="bg-red-500 animate-pulse h-2 w-2 rounded-full shadow-lg shadow-red-500/50" />
              <span className="text-xs select-none text-white font-semibold tracking-wide">LIVE</span>
            </Broadcast.StatusIndicator>

            <Broadcast.StatusIndicator
              className="flex gap-2 items-center"
              matcher="pending"
            >
              <div className="bg-yellow-400 h-2 w-2 rounded-full animate-pulse shadow-lg shadow-yellow-400/50" />
              <span className="text-xs select-none text-white font-semibold tracking-wide">CONNECTING</span>
            </Broadcast.StatusIndicator>

            <Broadcast.StatusIndicator
              className="flex gap-2 items-center"
              matcher="idle"
            >
              <div className="bg-gray-400 h-2 w-2 rounded-full" />
              <span className="text-xs select-none text-white font-semibold tracking-wide">READY</span>
            </Broadcast.StatusIndicator>
          </div>
        </Broadcast.LoadingIndicator>

        {/* Controls - Glass effect with gradient */}
        <Broadcast.Controls className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 z-10">
          <Broadcast.EnabledTrigger
            className="px-8 py-3 rounded-xl glass border border-white/20 hover:border-white/40 backdrop-blur-md transition-all font-semibold text-white shadow-xl hover:shadow-2xl hover:scale-105 bg-grad-primary"
            onClick={() => {
              setIsEnabled(prev => !prev);
              if (isEnabled) {
                toast.info('Broadcast stopped');
              } else {
                toast.success('Broadcasting started!');
              }
            }}
          >
            <Broadcast.EnabledIndicator asChild matcher={false}>
              <span>Start Broadcasting</span>
            </Broadcast.EnabledIndicator>
            <Broadcast.EnabledIndicator asChild>
              <span>Stop Broadcasting</span>
            </Broadcast.EnabledIndicator>
          </Broadcast.EnabledTrigger>
        </Broadcast.Controls>
      </Broadcast.Container>
    </Broadcast.Root>
  );
};

export default BrowserStreaming;
