import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as Broadcast from '@livepeer/react/broadcast';
import { getIngest } from '@livepeer/react/external';
import { Video, StopCircle } from 'lucide-react';
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
    isStreaming,
    setIsStreaming,
  } = useBrowserStreaming();

  const { sessionToken, identity } = useWallet();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Monitor broadcast status by checking the DOM for status indicators
  useEffect(() => {
    const checkBroadcastStatus = () => {
      // Check if there's a LIVE indicator visible on the page
      const liveIndicator = document.querySelector('[data-livepeer-broadcast-status="live"]');
      const isLive = liveIndicator !== null;
      
      if (isLive !== isBroadcasting) {
        console.log('[BrowserStreaming] Broadcast status changed:', isLive);
        setIsBroadcasting(isLive);
        setIsStreaming(isLive);
        
        if (isLive) {
          toast.success('Browser stream is now live!');
          onStreamStart?.();
        } else if (isBroadcasting) {
          toast.info('Browser stream ended');
          onStreamEnd?.();
        }
      }
    };

    // Check status every second to detect changes
    statusCheckInterval.current = setInterval(checkBroadcastStatus, 1000);
    
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, [isBroadcasting]);

  // Send heartbeat when broadcasting
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
        console.log(`[BrowserStreaming] Sending heartbeat - streamId: ${streamId}, broadcasting: ${isBroadcasting}`);
        const { error } = await supabase.rpc('update_browser_stream_heartbeat', {
          session_token_param: sessionToken,
          wallet_address_param: identity.address,
          stream_id_param: streamId,
          is_live_param: isBroadcasting
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

    if (isBroadcasting) {
      console.log('[BrowserStreaming] Starting heartbeat interval for live broadcast');
      sendHeartbeat(); // Send immediately
      heartbeatInterval = setInterval(sendHeartbeat, 3000); // Every 3 seconds
    }

    return () => {
      if (heartbeatInterval) {
        console.log('[BrowserStreaming] Clearing heartbeat interval');
        clearInterval(heartbeatInterval);
      }
    };
  }, [isBroadcasting, isPreviewMode, sessionToken, identity]);

  // Mark stream as ended when component unmounts
  useEffect(() => {
    return () => {
      if (!isPreviewMode && sessionToken && identity?.address && isBroadcasting) {
        const streamId = localStorage.getItem('currentStreamId');
        if (streamId) {
          console.log('[BrowserStreaming] Marking stream as ended on unmount');
          supabase.rpc('update_browser_stream_heartbeat', {
            session_token_param: sessionToken,
            wallet_address_param: identity.address,
            stream_id_param: streamId,
            is_live_param: false
          });
        }
      }
    };
  }, [isBroadcasting]);

  return (
    <div className="space-y-4">
      <Broadcast.Root ingestUrl={getIngest(streamKey)}>
        <Broadcast.Container className="w-full bg-black/50 rounded-xl overflow-hidden border border-white/10 relative">
          <Broadcast.Video 
            className="w-full aspect-video bg-black"
            title="Live broadcast"
          />
          
          {/* Status indicator with data attribute for monitoring */}
          <Broadcast.LoadingIndicator asChild matcher={false}>
            <div className="absolute overflow-hidden py-1 px-3 rounded-full top-4 left-4 bg-black/70 flex items-center backdrop-blur">
              <Broadcast.StatusIndicator
                matcher="live"
                className="flex gap-2 items-center"
                data-livepeer-broadcast-status="live"
              >
                <div className="bg-red-500 animate-pulse h-2 w-2 rounded-full" />
                <span className="text-xs select-none text-white font-medium">LIVE</span>
              </Broadcast.StatusIndicator>

              <Broadcast.StatusIndicator
                className="flex gap-2 items-center"
                matcher="pending"
                data-livepeer-broadcast-status="pending"
              >
                <div className="bg-yellow-500 h-2 w-2 rounded-full animate-pulse" />
                <span className="text-xs select-none text-white font-medium">CONNECTING</span>
              </Broadcast.StatusIndicator>

              <Broadcast.StatusIndicator
                className="flex gap-2 items-center"
                matcher="idle"
                data-livepeer-broadcast-status="idle"
              >
                <div className="bg-gray-400 h-2 w-2 rounded-full" />
                <span className="text-xs select-none text-white font-medium">IDLE</span>
              </Broadcast.StatusIndicator>
            </div>
          </Broadcast.LoadingIndicator>
        </Broadcast.Container>

        <Broadcast.Controls className="flex gap-4 justify-center items-center flex-wrap">
          <Broadcast.EnabledTrigger 
            className="px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink hover:opacity-90"
          >
            <Broadcast.EnabledIndicator asChild matcher={false}>
              <>
                <Video className="w-4 h-4" />
                <span>Start Broadcast</span>
              </>
            </Broadcast.EnabledIndicator>
            <Broadcast.EnabledIndicator asChild>
              <>
                <StopCircle className="w-4 h-4" />
                <span>Stop Broadcast</span>
              </>
            </Broadcast.EnabledIndicator>
          </Broadcast.EnabledTrigger>
        </Broadcast.Controls>
      </Broadcast.Root>
    </div>
  );
};

export default BrowserStreaming;
