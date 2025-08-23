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

  // Connect to Livepeer WebSocket for real-time stream status
  const connectToLivepeerWebSocket = () => {
    if (!livepeerStreamId) {
      console.log('No Livepeer stream ID available for WebSocket connection');
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      console.log('Connecting to Livepeer WebSocket for stream ID:', livepeerStreamId);
      
      // Connect to Livepeer WebSocket API for real-time stream status
      // Using Livepeer's WebSocket endpoint for stream status monitoring
      const wsUrl = `wss://livepeer.studio/api/stream/${livepeerStreamId}/status`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Livepeer WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Livepeer WebSocket message received:', data);
          
          // Update stream status based on Livepeer WebSocket data
          if (data.isActive !== undefined) {
            const isCurrentlyLive = data.isActive === true;
            console.log(`Stream ${livepeerStreamId} status update: isActive = ${data.isActive}`);
            
            setStreamStatus(prev => ({
              ...prev,
              isLive: isCurrentlyLive,
              lastHeartbeat: new Date().toISOString()
            }));

            // Update database with real-time status
            updateDatabaseStatus(isCurrentlyLive);
          }
        } catch (error) {
          console.error('Error parsing Livepeer WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Livepeer WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current.onclose = (event) => {
        console.log('Livepeer WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
          console.log(`Attempting to reconnect to Livepeer... (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectToLivepeerWebSocket();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Error creating Livepeer WebSocket connection:', error);
      setIsConnected(false);
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
    
    // Connect to Livepeer WebSocket for real-time status
    connectToLivepeerWebSocket();
    
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
  }, [streamId, livepeerStreamId]);

  return {
    isLive: streamStatus.isLive,
    viewerCount: streamStatus.viewerCount,
    isConnected
  };
};