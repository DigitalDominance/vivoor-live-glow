import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

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
  
  // Stream management
  preserveStream: () => void;
  releaseStream: () => void;
  isStreamPreserved: boolean;
}

const BrowserStreamingContext = createContext<BrowserStreamingContextType | null>(null);

export const BrowserStreamingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mediaStreamRef = useRef<MediaStream | null>(null);
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

  const preserveStream = useCallback(() => {
    console.log('[BrowserStreamingContext] Preserving stream state across navigation');
    setIsStreamPreserved(true);
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
    
    setIsStreaming(false);
    setIsPreviewing(false);
    setHasVideo(false);
    setHasAudio(false);
    setAudioLevel(0);
    setIsStreamPreserved(false);
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
    setIsStreaming,
    setIsPreviewing,
    setStreamingMode,
    setVideoEnabled,
    setAudioEnabled,
    setAudioLevel,
    setHasVideo,
    setHasAudio,
    setIsPreviewMuted,
    preserveStream,
    releaseStream,
    isStreamPreserved,
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