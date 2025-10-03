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

  // Poll Livepeer API for stream status (including browser streams via WebRTC)
  const checkLivepeerStatus = async () => {
    if (!livepeerStreamId) {
      console.log('No Livepeer stream ID available for status check');
      return;
    }

    try {
      console.log('Polling Livepeer API for stream status:', livepeerStreamId);
      
      // Use our edge function to check Livepeer status (avoids CORS and API key exposure)
      const { data, error } = await supabase.functions.invoke('check-livepeer-status', {
        body: { streamId: livepeerStreamId }
      });
      
      if (error) {
        console.error('Error checking Livepeer status:', error);
        return;
      }

      console.log('Livepeer status check result:', data);
      
      // If the response contains stream status, update immediately
      if (data && typeof data.isActive === 'boolean') {
        setStreamStatus(prev => ({
          ...prev,
          isLive: data.isActive
        }));
      }
      
      // Also fetch updated stream status from database after check
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

  // Remove old viewer tracking functions as they're now handled by useViewerTracking hook

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
    
    // Fetch initial stream status to get stream_type
    const setupPolling = async () => {
      const { data: streamData } = await supabase
        .from('streams')
        .select('is_live, viewers, last_heartbeat, stream_type')
        .eq('id', streamId)
        .single();

      if (streamData) {
        setStreamStatus({
          isLive: streamData.is_live || false,
          viewerCount: streamData.viewers || 0,
          lastHeartbeat: streamData.last_heartbeat
        });
        
        // For browser streams, poll more aggressively (every 3 seconds) to detect when WebRTC starts
        // For RTMP streams, poll less frequently (every 30 seconds)
        const pollInterval = streamData.stream_type === 'browser' ? 3000 : 30000;
        
        // Start polling Livepeer status
        const statusInterval = setInterval(() => {
          checkLivepeerStatus();
        }, pollInterval);
        
        // For browser streams, wait a bit longer for WebRTC to establish before first check
        // For RTMP streams, check immediately
        const initialCheck = setTimeout(() => {
          checkLivepeerStatus();
        }, streamData.stream_type === 'browser' ? 5000 : 1000);
        
        // Set up viewer count polling
        heartbeatInterval.current = setInterval(() => {
          fetchViewerCount();
        }, 30000);

        return () => {
          // Cleanup intervals
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
        };
      }
    };
    
    setupPolling();
  }, [streamId, livepeerStreamId]);

  return {
    isLive: streamStatus.isLive,
    viewerCount: streamStatus.viewerCount,
    isConnected: true // Always connected since we're using polling
  };
};