import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Secure hook to get viewer count for a stream
 * Uses the secure get_stream_viewer_count function that only returns counts, no personal data
 */
export function useSecureViewerCount(streamId: string | null) {
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!streamId) {
      setViewerCount(0);
      return;
    }

    let isMounted = true;

    const fetchViewerCount = async () => {
      if (!isMounted) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_stream_viewer_count', {
          stream_id_param: streamId
        });

        if (error) {
          console.error('Error fetching viewer count:', error);
          return;
        }

        if (isMounted) {
          setViewerCount(data || 0);
        }
      } catch (error) {
        console.error('Error fetching viewer count:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchViewerCount();

    // Update every 10 seconds for more responsive viewer count
    const interval = setInterval(fetchViewerCount, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [streamId]);

  return { viewerCount, loading };
}