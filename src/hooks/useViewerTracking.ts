import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useViewerTracking = (streamId: string | null, isLive: boolean) => {
  const hasJoined = useRef(false);
  const heartbeatInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!streamId || !isLive) {
      hasJoined.current = false;
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = undefined;
      }
      return;
    }

    // Join as viewer
    const joinAsViewer = async () => {
      if (hasJoined.current) return;
      
      try {
        const { error } = await supabase.rpc('increment_stream_viewers', {
          stream_id: streamId
        });
        
        if (!error) {
          hasJoined.current = true;
        }
      } catch (error) {
        console.error('Failed to join as viewer:', error);
      }
    };

    // Leave as viewer
    const leaveAsViewer = async () => {
      if (!hasJoined.current) return;
      
      try {
        await supabase.rpc('decrement_stream_viewers', {
          stream_id: streamId
        });
        hasJoined.current = false;
      } catch (error) {
        console.error('Failed to leave as viewer:', error);
      }
    };

    // Send viewer heartbeat
    const sendHeartbeat = async () => {
      if (!hasJoined.current) return;
      
      try {
        await supabase.rpc('viewer_heartbeat', {
          stream_id: streamId
        });
      } catch (error) {
        console.error('Failed to send viewer heartbeat:', error);
      }
    };

    joinAsViewer();

    // Send heartbeat every 30 seconds
    heartbeatInterval.current = setInterval(sendHeartbeat, 30000);

    // Cleanup function
    return () => {
      leaveAsViewer();
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [streamId, isLive]);

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!streamId || !isLive) return;

      if (document.hidden) {
        // Page is hidden, leave as viewer
        if (hasJoined.current) {
          try {
            await supabase.rpc('decrement_stream_viewers', {
              stream_id: streamId
            });
            hasJoined.current = false;
          } catch (error) {
            console.error('Failed to leave as viewer on page hide:', error);
          }
        }
      } else {
        // Page is visible, rejoin as viewer
        if (!hasJoined.current) {
          try {
            const { error } = await supabase.rpc('increment_stream_viewers', {
              stream_id: streamId
            });
            
            if (!error) {
              hasJoined.current = true;
            }
          } catch (error) {
            console.error('Failed to rejoin as viewer on page show:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streamId, isLive]);
};