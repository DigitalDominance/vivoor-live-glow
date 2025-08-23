import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamStatusData {
  isLive: boolean;
  viewerCount: number;
  lastHeartbeat?: string;
}

export const useStreamStatus = (streamId: string | null, livepeerStreamId?: string | null) => {
  const [streamStatus, setStreamStatus] = useState<StreamStatusData>({
    isLive: false,
    viewerCount: 0
  });
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout>();
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Poll Livepeer API for stream status (since WebSocket isn't available)
  const checkLivepeerStatus = async () => {
    if (!livepeerStreamId) {
      console.log('No Livepeer stream ID available for status check');
      return;
    }

    try {
      console.log('Polling Livepeer API for stream status:', livepeerStreamId);
      
      // Use our edge function to check Livepeer status (avoids CORS and API key exposure)
      const { data, error } = await supabase.functions.invoke('check-livepeer-status');
      
      if (error) {
        console.error('Error checking Livepeer status:', error);
        return;
      }

      console.log('Livepeer status check result:', data);
      
      // Fetch updated stream status from database after check
      fetchInitialStatus();
      
    } catch (error) {
      console.error('Error polling Livepeer status:', error);
    }
  };

  // Update database with real-time status from Livepeer
  const updateDatabaseStatus = async (isLive: boolean) => {
    if (!streamId) return;

    try {
      const { error } = await supabase
        .from('streams')
        .update({
          is_live: isLive,
          last_heartbeat: new Date().toISOString(),
          ...(isLive ? {} : { ended_at: new Date().toISOString() })
        })
        .eq('id', streamId);

      if (error) {
        console.error('Error updating stream status in database:', error);
      } else {
        console.log(`Updated database: stream ${streamId} is_live = ${isLive}`);
      }
    } catch (error) {
      console.error('Error updating database:', error);
    }
  };

  // Fetch initial stream status from database
  const fetchInitialStatus = async () => {
    if (!streamId) return;

    try {
      const { data } = await supabase
        .from('streams')
        .select('is_live, viewers, last_heartbeat')
        .eq('id', streamId)
        .single();

      if (data) {
        setStreamStatus({
          isLive: data.is_live || false,
          viewerCount: data.viewers || 0,
          lastHeartbeat: data.last_heartbeat
        });
      }
    } catch (error) {
      console.error('Error fetching initial stream status:', error);
    }
  };

  // Viewer tracking functions
  const joinAsViewer = async () => {
    if (!streamId) return;
    
    try {
      await supabase.rpc('increment_stream_viewers', { stream_id: streamId });
      console.log('Joined as viewer');
    } catch (error) {
      console.error('Error joining as viewer:', error);
    }
  };

  const leaveAsViewer = async () => {
    if (!streamId) return;
    
    try {
      await supabase.rpc('decrement_stream_viewers', { stream_id: streamId });
      console.log('Left as viewer');
    } catch (error) {
      console.error('Error leaving as viewer:', error);
    }
  };

  const sendViewerHeartbeat = async () => {
    if (!streamId) return;
    
    try {
      await supabase.rpc('viewer_heartbeat', { stream_id: streamId });
    } catch (error) {
      console.error('Error sending viewer heartbeat:', error);
    }
  };

  // Fetch viewer count from database
  const fetchViewerCount = async () => {
    if (!streamId) return;
    
    try {
      const { data } = await supabase
        .from('streams')
        .select('viewers')
        .eq('id', streamId)
        .single();
      
      if (data) {
        setStreamStatus(prev => ({
          ...prev,
          viewerCount: data.viewers || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching viewer count:', error);
    }
  };

  useEffect(() => {
    if (!streamId) return;

    // Join as viewer
    joinAsViewer();
    
    // Fetch initial stream status
    fetchInitialStatus();
    
    // Start polling Livepeer status every 60 seconds (less frequent to prevent glitching)
    const statusInterval = setInterval(() => {
      checkLivepeerStatus();
    }, 60000);
    
    // Check immediately but delayed to avoid conflicts
    const initialCheck = setTimeout(() => {
      checkLivepeerStatus();
    }, 5000);
    
    // Set up viewer heartbeat every 45 seconds
    heartbeatInterval.current = setInterval(() => {
      sendViewerHeartbeat();
      fetchViewerCount();
    }, 45000);

    // Handle page visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        leaveAsViewer();
      } else {
        joinAsViewer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Cleanup
      leaveAsViewer();
      
      if (statusInterval) {
        clearInterval(statusInterval);
      }
      
      if (initialCheck) {
        clearTimeout(initialCheck);
      }
      
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streamId, livepeerStreamId]);

  return {
    isLive: streamStatus.isLive,
    viewerCount: streamStatus.viewerCount,
    isConnected: true // Always connected since we're using polling
  };
};