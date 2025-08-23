import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamStatusData {
  isLive: boolean;
  viewerCount: number;
  lastHeartbeat?: string;
}

export const useStreamStatus = (streamId: string | null, livepeerPlaybackId?: string) => {
  const [streamStatus, setStreamStatus] = useState<StreamStatusData>({
    isLive: false,
    viewerCount: 0
  });
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout>();
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);

  // Function to connect to Livepeer WebSocket
  const connectToLivepeer = () => {
    if (!livepeerPlaybackId) return;

    try {
      // Connect to Livepeer WebSocket for stream status
      const ws = new WebSocket(`wss://livepeer.studio/api/stream/${livepeerPlaybackId}/status`);
      
      ws.onopen = () => {
        console.log('Connected to Livepeer WebSocket');
        setIsConnected(true);
        
        // Clear any existing reconnect timeout
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Livepeer status:', data);
          
          setStreamStatus(prev => ({
            ...prev,
            isLive: data.isActive || data.isLive || false
          }));
        } catch (error) {
          console.error('Error parsing Livepeer WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Livepeer WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeout.current = setTimeout(() => {
          console.log('Attempting to reconnect to Livepeer...');
          connectToLivepeer();
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('Livepeer WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect to Livepeer WebSocket:', error);
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
    
    // Connect to Livepeer WebSocket
    connectToLivepeer();
    
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
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streamId, livepeerPlaybackId]);

  return {
    isLive: streamStatus.isLive,
    viewerCount: streamStatus.viewerCount,
    isConnected
  };
};