// Stream cleanup utilities to handle streams incorrectly marked as live

import { supabase } from '@/integrations/supabase/client';

/**
 * Clean up streams that have been "live" for more than 6 hours
 * These are likely streams that were not properly ended
 */
export async function cleanupStaleStreams() {
  try {
    // Calculate 6 hours ago
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    
    const { data: staleStreams, error: fetchError } = await supabase
      .from('streams')
      .select('id, title, user_id, started_at')
      .eq('is_live', true)
      .lt('started_at', sixHoursAgo);
    
    if (fetchError) {
      console.error('Error fetching stale streams:', fetchError);
      return { cleaned: 0, error: fetchError };
    }

    if (!staleStreams || staleStreams.length === 0) {
      console.log('No stale streams found');
      return { cleaned: 0 };
    }

    console.log(`Found ${staleStreams.length} stale streams to clean up:`, staleStreams);

    // Mark these streams as ended
    const { error: updateError } = await supabase
      .from('streams')
      .update({ 
        is_live: false, 
        ended_at: new Date().toISOString() 
      })
      .eq('is_live', true)
      .lt('started_at', sixHoursAgo);

    if (updateError) {
      console.error('Error updating stale streams:', updateError);
      return { cleaned: 0, error: updateError };
    }

    console.log(`Successfully cleaned up ${staleStreams.length} stale streams`);
    return { cleaned: staleStreams.length };
  } catch (error) {
    console.error('Unexpected error during stream cleanup:', error);
    return { cleaned: 0, error };
  }
}

/**
 * Clean up streams for a specific user
 */
export async function cleanupUserStreams(userId: string) {
  try {
    const result = await supabase.rpc('end_user_active_streams', { 
      user_id_param: userId 
    });
    
    console.log(`Cleaned up streams for user ${userId}:`, result);
    return result;
  } catch (error) {
    console.error('Error cleaning up user streams:', error);
    throw error;
  }
}

/**
 * Auto-cleanup function that runs periodically
 */
export function startStreamCleanupTimer() {
  // Run cleanup immediately
  cleanupStaleStreams();
  
  // Then run every 30 minutes
  const intervalId = setInterval(() => {
    cleanupStaleStreams();
  }, 30 * 60 * 1000);
  
  return intervalId;
}