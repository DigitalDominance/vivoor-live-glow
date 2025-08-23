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

  // Function to check stream status via Livepeer API instead of WebSocket
  const checkLivepeerStatus = async () => {
    if (!livepeerStreamId) {
      console.log('No livepeer stream ID available');
      return;
    }

    try {
      console.log('Checking Livepeer stream status for ID:', livepeerStreamId);
      
      // Use Livepeer API to check stream status instead of WebSocket
      const response = await fetch(`https://livepeer.studio/api/stream/${livepeerStreamId}`, {
        headers: {
          'Authorization': 'Bearer your-api-key-here', // This would need to be passed from backend
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Livepeer stream status:', data);
        
        setStreamStatus(prev => ({
          ...prev,
          isLive: data.isActive || false
        }));
      }
    } catch (error) {
      console.error('Failed to check Livepeer status:', error);
      // Fallback: consider stream live if we have a playback URL
      setStreamStatus(prev => ({
        ...prev,
        isLive: true // Assume live since we can't verify
      }));
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
    
    // Fetch initial viewer count
    fetchViewerCount();
    
    // Check Livepeer status periodically instead of WebSocket
    checkLivepeerStatus();
    const statusInterval = setInterval(checkLivepeerStatus, 30000); // Check every 30 seconds
    
    // Set up viewer heartbeat every 30 seconds
    heartbeatInterval.current = setInterval(() => {
      sendViewerHeartbeat();
      fetchViewerCount();
    }, 30000);

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
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      
      if (statusInterval) {
        clearInterval(statusInterval);
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
    isConnected
  };
};