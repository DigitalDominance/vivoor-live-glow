import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Generate a unique session ID for this viewer session
const generateSessionId = (): string => {
  return `viewer_${Date.now()}_${Math.random().toString(36).substring(2)}`;
};

export const useViewerTracking = (streamId: string | null, isLive: boolean, userId?: string | null) => {
  const sessionId = useRef<string>(generateSessionId());
  const hasJoined = useRef(false);
  const heartbeatInterval = useRef<NodeJS.Timeout>();

  // Join as viewer with unique session ID
  const joinAsViewer = async () => {
    if (hasJoined.current || !streamId) return;
    
    try {
      await supabase.rpc('join_stream_viewer', {
        stream_id_param: streamId,
        session_id_param: sessionId.current,
        user_id_param: userId || null
      });
      hasJoined.current = true;
      console.log('Joined as viewer for stream:', streamId, 'Session:', sessionId.current);
    } catch (error) {
      console.error('Error joining as viewer:', error);
    }
  };

  // Leave as viewer 
  const leaveAsViewer = async () => {
    if (!hasJoined.current || !streamId) return;
    
    try {
      await supabase.rpc('leave_stream_viewer', {
        stream_id_param: streamId,
        session_id_param: sessionId.current
      });
      hasJoined.current = false;
      console.log('Left as viewer for stream:', streamId, 'Session:', sessionId.current);
    } catch (error) {
      console.error('Error leaving as viewer:', error);
    }
  };

  // Send viewer heartbeat
  const sendHeartbeat = async () => {
    if (!hasJoined.current || !streamId) return;
    
    try {
      await supabase.rpc('update_viewer_heartbeat', {
        stream_id_param: streamId,
        session_id_param: sessionId.current
      });
      console.log('Sent viewer heartbeat for stream:', streamId);
    } catch (error) {
      console.error('Error sending viewer heartbeat:', error);
    }
  };

  useEffect(() => {
    if (!streamId || !isLive) {
      // Clean up if stream is not live or no stream ID
      if (hasJoined.current) {
        leaveAsViewer();
      }
      return;
    }

    joinAsViewer();

    // Send heartbeat every 60 seconds
    heartbeatInterval.current = setInterval(sendHeartbeat, 60000);

    // Cleanup function
    return () => {
      leaveAsViewer();
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = undefined;
      }
    };
  }, [streamId, isLive, userId]);

  // Handle page visibility change
  useEffect(() => {
    if (!streamId || !isLive) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Page is hidden, leave as viewer
        if (hasJoined.current) {
          try {
            await supabase.rpc('leave_stream_viewer', {
              stream_id_param: streamId,
              session_id_param: sessionId.current
            });
            hasJoined.current = false;
            console.log('Left as viewer on page hide for stream:', streamId);
          } catch (error) {
            console.error('Error leaving on page hide:', error);
          }
        }
      } else {
        // Page is visible, rejoin as viewer
        if (!hasJoined.current) {
          try {
            await supabase.rpc('join_stream_viewer', {
              stream_id_param: streamId,
              session_id_param: sessionId.current,
              user_id_param: userId || null
            });
            hasJoined.current = true;
            console.log('Rejoined as viewer on page show for stream:', streamId);
          } catch (error) {
            console.error('Error rejoining on page show:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streamId, isLive, userId]);

  // Handle page unload
  useEffect(() => {
    if (!streamId || !isLive) return;

    const handleBeforeUnload = () => {
      if (hasJoined.current) {
        // Use sendBeacon for reliable cleanup on page unload
        const blob = new Blob([JSON.stringify({
          streamId,
          sessionId: sessionId.current
        })], { type: 'application/json' });
        navigator.sendBeacon('https://qcowmxypihinteajhnjw.supabase.co/functions/v1/viewer-cleanup', blob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [streamId, isLive]);
};