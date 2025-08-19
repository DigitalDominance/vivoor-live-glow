import { useEffect, useRef } from 'react';

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

    // Join as viewer - for now just track locally until DB functions are available
    const joinAsViewer = async () => {
      if (hasJoined.current) return;
      hasJoined.current = true;
      console.log('Joined as viewer for stream:', streamId);
    };

    // Leave as viewer 
    const leaveAsViewer = async () => {
      if (!hasJoined.current) return;
      hasJoined.current = false;
      console.log('Left as viewer for stream:', streamId);
    };

    // Send viewer heartbeat
    const sendHeartbeat = async () => {
      if (!hasJoined.current) return;
      console.log('Sending viewer heartbeat for stream:', streamId);
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
          hasJoined.current = false;
          console.log('Left as viewer on page hide for stream:', streamId);
        }
      } else {
        // Page is visible, rejoin as viewer
        if (!hasJoined.current) {
          hasJoined.current = true;
          console.log('Rejoined as viewer on page show for stream:', streamId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streamId, isLive]);
};