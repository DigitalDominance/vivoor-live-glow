import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BrowserStreamingContextType {
  // Stream state
  mediaStreamRef: React.MutableRefObject<MediaStream | null>;
  isStreaming: boolean;
  isPreviewing: boolean;
  streamingMode: 'camera' | 'screen';
  videoEnabled: boolean;
  audioEnabled: boolean;
  audioLevel: number;
  hasVideo: boolean;
  hasAudio: boolean;
  isPreviewMuted: boolean;
  isBroadcastActive: boolean;
  
  // Actions
  setIsStreaming: (value: boolean) => void;
  setIsPreviewing: (value: boolean) => void;
  setStreamingMode: (value: 'camera' | 'screen') => void;
  setVideoEnabled: (value: boolean) => void;
  setAudioEnabled: (value: boolean) => void;
  setAudioLevel: (value: number) => void;
  setHasVideo: (value: boolean) => void;
  setHasAudio: (value: boolean) => void;
  setIsPreviewMuted: (value: boolean) => void;
  setIsBroadcastActive: (value: boolean) => void;
  
  // Stream management
  preserveStream: () => void;
  releaseStream: () => void;
  isStreamPreserved: boolean;
  
  // Heartbeat management
  startHeartbeat: (streamId: string, sessionToken: string, walletAddress: string) => void;
  stopHeartbeat: () => void;
}

const BrowserStreamingContext = createContext<BrowserStreamingContextType | null>(null);

export const BrowserStreamingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatDataRef = useRef<{ streamId: string; sessionToken: string; walletAddress: string } | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [streamingMode, setStreamingMode] = useState<'camera' | 'screen'>('camera');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);
  const [isStreamPreserved, setIsStreamPreserved] = useState(false);
  const [isBroadcastActive, setIsBroadcastActive] = useState(false);

  const preserveStream = useCallback(() => {
    console.log('[BrowserStreamingContext] Preserving stream state across navigation');
    setIsStreamPreserved(true);
  }, []);

  const startHeartbeat = useCallback((streamId: string, sessionToken: string, walletAddress: string) => {
    console.log('[BrowserStreamingContext] Starting global heartbeat for stream:', streamId);
    
    // Store heartbeat data
    heartbeatDataRef.current = { streamId, sessionToken, walletAddress };
    
    // Clear any existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    const sendHeartbeat = async () => {
      const data = heartbeatDataRef.current;
      if (!data) return;
      
      // Only send heartbeat if broadcast is actually active
      if (!isBroadcastActive) {
        console.log('[BrowserStreamingContext] Skipping heartbeat - broadcast not active');
        return;
      }
      
      try {
        console.log('[BrowserStreamingContext] Sending heartbeat (broadcast active)');
        const { error } = await supabase.rpc('update_browser_stream_heartbeat', {
          session_token_param: data.sessionToken,
          wallet_address_param: data.walletAddress,
          stream_id_param: data.streamId,
          is_live_param: true
        });
        
        if (error && error.code !== 'PGRST301' && !error.message?.includes('session')) {
          console.error('[BrowserStreamingContext] Heartbeat error:', error);
        }
      } catch (err) {
        console.error('[BrowserStreamingContext] Heartbeat exception:', err);
      }
    };
    
    // Send immediately
    sendHeartbeat();
    
    // Then send every 15 seconds
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);
  }, []);
  
  const stopHeartbeat = useCallback(async () => {
    console.log('[BrowserStreamingContext] Stopping global heartbeat');
    
    // Clear interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // Send final heartbeat to mark stream as ended
    const data = heartbeatDataRef.current;
    if (data) {
      try {
        await supabase.rpc('update_browser_stream_heartbeat', {
          session_token_param: data.sessionToken,
          wallet_address_param: data.walletAddress,
          stream_id_param: data.streamId,
          is_live_param: false
        });
      } catch (error) {
        console.error('[BrowserStreamingContext] Error marking stream as ended:', error);
      }
    }
    
    heartbeatDataRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    console.log('[BrowserStreamingContext] Releasing preserved stream');
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`[BrowserStreamingContext] Stopped track: ${track.kind} - ${track.label}`);
      });
      mediaStreamRef.current = null;
    }
    
    stopHeartbeat();
    setIsStreaming(false);
    setIsPreviewing(false);
    setHasVideo(false);
    setHasAudio(false);
    setAudioLevel(0);
    setIsStreamPreserved(false);
  }, [stopHeartbeat]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  const value: BrowserStreamingContextType = {
    mediaStreamRef,
    isStreaming,
    isPreviewing,
    streamingMode,
    videoEnabled,
    audioEnabled,
    audioLevel,
    hasVideo,
    hasAudio,
    isPreviewMuted,
    isBroadcastActive,
    setIsStreaming,
    setIsPreviewing,
    setStreamingMode,
    setVideoEnabled,
    setAudioEnabled,
    setAudioLevel,
    setHasVideo,
    setHasAudio,
    setIsPreviewMuted,
    setIsBroadcastActive,
    preserveStream,
    releaseStream,
    isStreamPreserved,
    startHeartbeat,
    stopHeartbeat,
  };

  return (
    <BrowserStreamingContext.Provider value={value}>
      {children}
    </BrowserStreamingContext.Provider>
  );
};

export const useBrowserStreaming = () => {
  const context = useContext(BrowserStreamingContext);
  if (!context) {
    throw new Error('useBrowserStreaming must be used within BrowserStreamingProvider');
  }
  return context;
};