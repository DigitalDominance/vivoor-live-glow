import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  // Send heartbeat to mark stream as live
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const sendHeartbeat = async (status: 'live' | 'idle') => {
      if (isPreviewMode) return;

      const streamId = localStorage.getItem('currentStreamId');
      if (!streamId) return;

      try {
        const { error } = await supabase
          .from('streams')
          .update({ 
            is_live: status === 'live',
            last_heartbeat: new Date().toISOString(),
            stream_type: 'browser'
          })
          .eq('id', streamId);

        if (error) {
          console.error('Heartbeat error:', error);
        }
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    };

    // Start heartbeat interval when needed
    const startHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => sendHeartbeat('live'), 5000);
    };

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [isPreviewMode]);

  const handleStreamStart = () => {
    console.log('[BrowserStreaming] Stream started');
    toast.success('Browser stream is now live!');
    onStreamStart?.();

    // Mark stream as live
    if (!isPreviewMode) {
      const streamId = localStorage.getItem('currentStreamId');
      if (streamId) {
        supabase
          .from('streams')
          .update({ 
            is_live: true,
            last_heartbeat: new Date().toISOString(),
            stream_type: 'browser'
          })
          .eq('id', streamId)
          .then(({ error }) => {
            if (error) console.error('Failed to mark stream as live:', error);
          });
      }
    }
  };

  const handleStreamEnd = () => {
    console.log('[BrowserStreaming] Stream ended');
    toast.info('Browser stream ended');
    onStreamEnd?.();

    // Mark stream as ended
    if (!isPreviewMode) {
      const streamId = localStorage.getItem('currentStreamId');
      if (streamId) {
        supabase
          .from('streams')
          .update({ 
            is_live: false,
            ended_at: new Date().toISOString()
          })
          .eq('id', streamId)
          .then(({ error }) => {
            if (error) console.error('Failed to mark stream as ended:', error);
          });
      }
    }
  };

  useEffect(() => {
    // Mark stream as ready when component mounts
    if (!isPreviewMode) {
      const streamId = localStorage.getItem('currentStreamId');
      if (streamId) {
        supabase
          .from('streams')
          .update({ 
            is_live: false,
            stream_type: 'browser'
          })
          .eq('id', streamId);
      }
    }

    // Handle messages from the iframe (if Livepeer sends any)
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://lvpr.tv') return;
      
      if (event.data?.type === 'broadcast-started') {
        handleStreamStart();
      } else if (event.data?.type === 'broadcast-stopped') {
        handleStreamEnd();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPreviewMode]);

  return (
    <div className="w-full bg-black/50 rounded-xl overflow-hidden border border-white/10">
      <iframe
        src={`https://lvpr.tv/broadcast/${streamKey}`}
        className="w-full aspect-video"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture; display-capture; camera; microphone"
        style={{ border: 'none' }}
      />
    </div>
  );
};

export default BrowserStreaming;
