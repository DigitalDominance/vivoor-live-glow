import { useState, useEffect, useCallback } from 'react';

interface StreamReadinessResult {
  isReady: boolean;
  status: 'checking' | 'ready' | 'timeout' | 'error';
  error?: string;
}

/**
 * Hook to poll HLS manifest until stream is ready
 * Used primarily for browser streams which have a delay in HLS transcoding
 */
export const useStreamReadiness = (
  playbackUrl: string | null | undefined,
  streamingMode: string | null | undefined,
  enabled: boolean = true
): StreamReadinessResult => {
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'timeout' | 'error'>('checking');
  const [error, setError] = useState<string | undefined>();

  const checkManifestReadiness = useCallback(async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) return false;

      // For extra safety, fetch the manifest and check for segments
      const manifestResponse = await fetch(url);
      const manifestText = await manifestResponse.text();
      
      // Check if manifest contains actual .ts segments (not just headers)
      const hasSegments = manifestText.includes('.ts') || manifestText.includes('.m4s');
      console.log('🎬 Manifest check:', { hasSegments, manifestLength: manifestText.length });
      
      return hasSegments;
    } catch (err) {
      console.warn('🎬 Manifest check failed:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !playbackUrl) {
      setIsReady(true);
      setStatus('ready');
      return;
    }

    // RTMP streams are ready immediately
    if (streamingMode !== 'browser') {
      setIsReady(true);
      setStatus('ready');
      return;
    }

    console.log('🎬 Starting stream readiness check for browser stream:', playbackUrl);
    setStatus('checking');
    setIsReady(false);

    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max wait
    const pollInterval = 2000; // Check every 2 seconds

    const poll = async () => {
      attempts++;
      console.log(`🎬 Polling attempt ${attempts}/${maxAttempts}`);

      const ready = await checkManifestReadiness(playbackUrl);
      
      if (ready) {
        console.log('🎬 Stream is ready!');
        setIsReady(true);
        setStatus('ready');
        return true;
      }

      if (attempts >= maxAttempts) {
        console.warn('🎬 Stream readiness check timed out');
        setStatus('timeout');
        setError('Stream is taking longer than expected to start. Please refresh.');
        // Still set ready to true so player attempts to load
        setIsReady(true);
        return true;
      }

      return false;
    };

    // Initial check
    poll().then(done => {
      if (done) return;

      // Continue polling
      const intervalId = setInterval(async () => {
        const done = await poll();
        if (done) {
          clearInterval(intervalId);
        }
      }, pollInterval);

      return () => clearInterval(intervalId);
    });

  }, [playbackUrl, streamingMode, enabled, checkManifestReadiness]);

  return { isReady, status, error };
};
