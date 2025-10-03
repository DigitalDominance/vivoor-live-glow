import React, { useEffect, useState } from 'react';
import * as Broadcast from "@livepeer/react/broadcast";
import { getIngest } from "@livepeer/react/external";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface BrowserStreamingProps {
  streamKey: string;
  playbackId?: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  isPreviewMode?: boolean;
}

const BrowserStreaming: React.FC<BrowserStreamingProps> = ({
  streamKey,
  playbackId,
  onStreamStart,
  onStreamEnd,
  isPreviewMode = false
}) => {
  const ingestUrl = getIngest(streamKey);
  const [streamSource, setStreamSource] = useState<'camera' | 'screen'>('camera');

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

  return (
    <div className="space-y-4">
      {/* Source Selection */}
      <div className="flex items-center gap-2 p-3 bg-black/30 backdrop-blur-sm rounded-lg border border-white/10">
        <span className="text-sm text-white/70 mr-2">Stream Source:</span>
        <Button
          variant={streamSource === 'camera' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStreamSource('camera')}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 7l-7 5 7 5V7z"></path>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          Camera
        </Button>
        <Button
          variant={streamSource === 'screen' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStreamSource('screen')}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          Screen Share
        </Button>
      </div>

      <Broadcast.Root 
        key={streamSource} 
        ingestUrl={ingestUrl}
        video={streamSource === 'screen' ? { displaySurface: 'monitor' } as any : true}
      >
        <Broadcast.Container className="w-full bg-black/50 rounded-xl overflow-hidden border border-white/10">
          {/* Video Element */}
          <div className="relative aspect-video bg-black">
            <Broadcast.Video 
              title="Browser livestream" 
              className="w-full h-full object-cover"
            />

            {/* Status Indicator */}
            <Broadcast.LoadingIndicator asChild matcher={false}>
              <div className="absolute top-3 left-3 overflow-hidden py-1 px-3 rounded-full bg-black/50 backdrop-blur-sm flex items-center gap-2">
                <Broadcast.StatusIndicator
                  matcher="live"
                  className="flex gap-2 items-center"
                >
                  <div className="bg-red-500 animate-pulse h-2 w-2 rounded-full" />
                  <span className="text-xs font-medium text-white select-none">LIVE</span>
                </Broadcast.StatusIndicator>

                <Broadcast.StatusIndicator
                  className="flex gap-2 items-center"
                  matcher="pending"
                >
                  <div className="bg-yellow-500/80 h-2 w-2 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-white select-none">CONNECTING</span>
                </Broadcast.StatusIndicator>

                <Broadcast.StatusIndicator
                  className="flex gap-2 items-center"
                  matcher="idle"
                >
                  <div className="bg-gray-400 h-2 w-2 rounded-full" />
                  <span className="text-xs font-medium text-white select-none">READY</span>
                </Broadcast.StatusIndicator>
              </div>
            </Broadcast.LoadingIndicator>
          </div>

          {/* Controls */}
          <Broadcast.Controls className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border-t border-white/10">
            <div className="flex items-center gap-2">
              {/* Video Source Toggle */}
              <Broadcast.VideoEnabledTrigger className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors">
                <Broadcast.VideoEnabledIndicator asChild matcher={true}>
                  <div className="flex items-center gap-2 text-white text-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 7l-7 5 7 5V7z"></path>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                    <span>Video On</span>
                  </div>
                </Broadcast.VideoEnabledIndicator>
                <Broadcast.VideoEnabledIndicator asChild matcher={false}>
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                    <span>Video Off</span>
                  </div>
                </Broadcast.VideoEnabledIndicator>
              </Broadcast.VideoEnabledTrigger>

              {/* Audio Toggle */}
              <Broadcast.AudioEnabledTrigger className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors">
                <Broadcast.AudioEnabledIndicator asChild matcher={true}>
                  <div className="flex items-center gap-2 text-white text-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"></path>
                      <path d="M19 10v2a7 7 0 01-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                    <span>Mic On</span>
                  </div>
                </Broadcast.AudioEnabledIndicator>
                <Broadcast.AudioEnabledIndicator asChild matcher={false}>
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"></path>
                      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                    <span>Mic Off</span>
                  </div>
                </Broadcast.AudioEnabledIndicator>
              </Broadcast.AudioEnabledTrigger>
            </div>

            {/* Start/Stop Stream */}
            {!isPreviewMode && (
              <Broadcast.EnabledTrigger 
                className="px-6 py-2 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
                onClick={(e) => {
                  // Trigger stream start/end
                  const isCurrentlyLive = (e.currentTarget as HTMLElement).getAttribute('data-live') === 'true';
                  if (!isCurrentlyLive) {
                    handleStreamStart();
                  } else {
                    handleStreamEnd();
                  }
                }}
              >
                <Broadcast.EnabledIndicator asChild matcher={false}>
                  <div className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white flex items-center gap-2" data-live="false">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    <span>Go Live</span>
                  </div>
                </Broadcast.EnabledIndicator>
                <Broadcast.EnabledIndicator asChild matcher={true}>
                  <div className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white flex items-center gap-2" data-live="true">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12"></rect>
                    </svg>
                    <span>End Stream</span>
                  </div>
                </Broadcast.EnabledIndicator>
              </Broadcast.EnabledTrigger>
            )}
          </Broadcast.Controls>
        </Broadcast.Container>
      </Broadcast.Root>

      {/* Help Text */}
      <div className="text-xs text-gray-400 space-y-1 px-2">
        <p>• Choose between Camera or Screen Share as your video source</p>
        <p>• Click "Go Live" to start broadcasting</p>
        <p>• Use the video and audio toggles to control your stream</p>
        <p>• Your browser stream will be available on your channel page</p>
        {isPreviewMode && <p>• This is preview mode - complete setup to go live</p>}
      </div>
    </div>
  );
};

export default BrowserStreaming;
