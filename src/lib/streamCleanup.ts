// Stream cleanup utilities to handle streams incorrectly marked as live

import { supabase } from '@/integrations/supabase/client';

/**
 * Clean up streams that have been "live" for more than specified timeout
 * These are likely streams that were not properly ended
 */
export async function cleanupStaleStreams(timeoutMinutes: number = 1) {
  try {
    const { data, error } = await supabase.rpc('auto_end_disconnected_streams', { 
      timeout_minutes: timeoutMinutes 
    });
    
    if (error) {
      console.error('Error cleaning up stale streams:', error);
      return { cleaned: 0, error };
    }

    console.log(`Successfully cleaned up ${data || 0} stale streams`);
    return { cleaned: data || 0 };
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
  cleanupStaleStreams(1);
  
  // Then run every 2 minutes to check for streams disconnected for 1+ minutes
  const intervalId = setInterval(() => {
    cleanupStaleStreams(1);
  }, 2 * 60 * 1000);
  
  return intervalId;
}