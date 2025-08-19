// Stream cleanup utilities to handle streams incorrectly marked as live

import { supabase } from '@/integrations/supabase/client';

/**
 * Clean up streams that have been "live" for more than specified timeout
 * These are likely streams that were not properly ended
 */
export async function cleanupStaleStreams(timeoutMinutes: number = 1) {
  try {
    // Use the new monitoring function that's more comprehensive
    const { data, error } = await supabase.rpc('monitor_livepeer_streams');
    
    if (error) {
      console.error('Error monitoring Livepeer streams:', error);
      return { cleaned: 0, error };
    }

    console.log(`Successfully monitored and cleaned up ${data || 0} disconnected streams`);
    return { cleaned: data || 0 };
  } catch (error) {
    console.error('Unexpected error during stream monitoring:', error);
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
 * Auto-cleanup function that runs periodically for comprehensive stream monitoring
 */
export function startStreamCleanupTimer() {
  // Run cleanup immediately
  cleanupStaleStreams(1);
  
  // Run every 30 seconds to aggressively monitor for disconnected streams
  const intervalId = setInterval(() => {
    cleanupStaleStreams(1);
  }, 30 * 1000);
  
  return intervalId;
}