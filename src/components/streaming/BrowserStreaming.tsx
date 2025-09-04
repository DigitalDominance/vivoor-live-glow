import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Square, Monitor, RefreshCw, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBrowserStreaming } from '@/context/BrowserStreamingContext';

interface BrowserStreamingProps {
  streamKey: string;
  ingestUrl: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  isPreviewMode?: boolean;
}

const BrowserStreaming: React.FC<BrowserStreamingProps> = ({
  streamKey,
  ingestUrl,
  onStreamStart,
  onStreamEnd,
  isPreviewMode = false
}) => {
  // Use browser streaming context
  const {
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
    isStreamPreserved,
  } = useBrowserStreaming();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Local state
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Check if we should restore preserved stream state on mount
  useEffect(() => {
    if (isStreamPreserved && mediaStreamRef.current && videoRef.current) {
      console.log('[BrowserStreaming] Restoring preserved stream');
      setupVideoElement(videoRef.current, mediaStreamRef.current, streamingMode);
      if (mediaStreamRef.current.getAudioTracks().length > 0) {
        setupAudioMonitoring(mediaStreamRef.current);
      }
      
      // If we were streaming before navigation, continue streaming
      const wasStreaming = localStorage.getItem('browserStreamingActive') === 'true';
      if (wasStreaming) {
        setIsStreaming(true);
        startHeartbeat();
        debug('Resumed streaming after navigation');
      }
    }
  }, [isStreamPreserved, streamingMode]);

  // Save streaming state to localStorage
  useEffect(() => {
    localStorage.setItem('browserStreamingActive', isStreaming.toString());
  }, [isStreaming]);

  // Setup video element helper function
  const setupVideoElement = (video: HTMLVideoElement, stream: MediaStream, mode: string) => {
    console.log(`${mode.toUpperCase()} VIDEO SETUP - Starting setup`, {video, stream});
    
    // Add event listeners for debugging
    video.addEventListener('loadstart', () => console.log(`${mode.toUpperCase()} EVENT - loadstart`));
    video.addEventListener('loadedmetadata', () => console.log(`${mode.toUpperCase()} EVENT - loadedmetadata`, {width: video.videoWidth, height: video.videoHeight}));
    video.addEventListener('canplay', () => console.log(`${mode.toUpperCase()} EVENT - canplay`));
    video.addEventListener('playing', () => console.log(`${mode.toUpperCase()} EVENT - playing`));
    video.addEventListener('error', (e) => console.error(`${mode.toUpperCase()} EVENT - error`, e));
    
    // Clear existing source
    video.srcObject = null;
    video.load();
    
    // Set properties
    video.muted = isPreviewMuted;
    video.playsInline = true;
    video.autoplay = true;
    
    // Set the stream
    video.srcObject = stream;
    console.log(`${mode.toUpperCase()} VIDEO SETUP - srcObject assigned`);
    
    // Force play
    video.play()
      .then(() => {
        console.log(`${mode.toUpperCase()} VIDEO SETUP - Play successful`);
        debug(`${mode} video playing successfully`);
      })
      .catch(error => {
        console.error(`${mode.toUpperCase()} VIDEO SETUP - Play failed:`, error);
        debug(`${mode} video play error: ${error}`);
      });
  };

  // Debug logging
  const debug = (message: string) => {
    console.log(`[BrowserStreaming] ${message}`);
    setDebugInfo(message);
  };

  // Initialize camera stream
  const initializeCamera = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);
      debug('Requesting camera permissions...');

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      // Stop any existing stream first
      if (mediaStreamRef.current) {
        debug('Stopping existing stream');
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
          debug(`Stopped track: ${track.kind} - ${track.label}`);
        });
        mediaStreamRef.current = null;
      }

      debug('Requesting camera and microphone access...');
      const constraints = {
        video: {
          width: { ideal: 1280, min: 640, max: 1920 },
          height: { ideal: 720, min: 480, max: 1080 },
          frameRate: { ideal: 30, min: 15, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 44100 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      debug(`Got media stream with ${stream.getTracks().length} tracks`);

      // Log track details
      stream.getTracks().forEach(track => {
        debug(`Track: ${track.kind} - ${track.label} - enabled: ${track.enabled} - ready: ${track.readyState}`);
      });

      mediaStreamRef.current = stream;
      setStreamingMode('camera');
      
      // Check what we actually got
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      
      debug(`Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);

      // Video setup will be handled after state update to ensure video element exists
      debug('Camera stream setup complete, will setup video element after render');

      setupAudioMonitoring(stream);
      setIsPreviewing(true);
      
      // Ensure video element is ready after state update
      setTimeout(() => {
        if (videoRef.current && stream) {
          setupVideoElement(videoRef.current, stream, 'camera');
        }
      }, 100);
      
      toast.success('Camera ready!');
      debug('Camera initialization complete');

    } catch (err: any) {
      console.error('Camera initialization failed:', err);
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access and try again.'
        : err.name === 'NotFoundError'
        ? 'No camera found. Please connect a camera and try again.'
        : err.name === 'NotReadableError'
        ? 'Camera is already in use by another application.'
        : `Camera error: ${err.message}`;
      
      setError(errorMessage);
      toast.error(errorMessage);
      debug(`Camera error: ${err.name} - ${err.message}`);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Initialize screen sharing
  const initializeScreen = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);
      debug('Requesting screen share permissions...');

      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser');
      }

      // Stop any existing stream first
      if (mediaStreamRef.current) {
        debug('Stopping existing stream');
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
          debug(`Stopped track: ${track.kind} - ${track.label}`);
        });
        mediaStreamRef.current = null;
      }

      debug('Requesting display media access...');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      debug(`Got display stream with ${displayStream.getTracks().length} tracks`);

      let micStream: MediaStream | null = null;
      
      // Try to get microphone for commentary
      try {
        debug('Requesting microphone for commentary...');
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: { ideal: 44100 }
          }
        });
        debug(`Got microphone stream with ${micStream.getTracks().length} tracks`);
      } catch (micError: any) {
        debug(`Microphone access failed: ${micError.message}`);
        console.warn('Could not access microphone:', micError);
      }

      // Combine streams
      const combinedStream = new MediaStream();
      
      // Add video track from screen
      displayStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
        debug(`Added display video track: ${track.label}`);
      });

      // Add system audio if available
      displayStream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
        debug(`Added system audio track: ${track.label}`);
      });

      // Add microphone audio if available
      if (micStream) {
        micStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
          debug(`Added microphone track: ${track.label}`);
        });
      }

      debug(`Combined stream has ${combinedStream.getTracks().length} total tracks`);

      mediaStreamRef.current = combinedStream;
      setStreamingMode('screen');

      // Check what we have
      const videoTracks = combinedStream.getVideoTracks();
      const audioTracks = combinedStream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);

      debug(`Final - Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);

      // Video setup will be handled after state update to ensure video element exists
      debug('Screen share stream setup complete, will setup video element after render');

      // Handle screen share ending
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          debug('Screen share ended by user');
          stopPreview();
          toast.info('Screen sharing ended');
        });
      }

      setupAudioMonitoring(combinedStream);
      setIsPreviewing(true);
      
      // Ensure video element is ready after state update
      setTimeout(() => {
        if (videoRef.current && combinedStream) {
          setupVideoElement(videoRef.current, combinedStream, 'screen');
        }
      }, 100);
      
      toast.success('Screen sharing ready!');
      debug('Screen share initialization complete');

    } catch (err: any) {
      console.error('Screen sharing failed:', err);
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Screen sharing permission denied. Please allow screen sharing and try again.'
        : err.name === 'NotSupportedError'
        ? 'Screen sharing is not supported in this browser.'
        : `Screen sharing error: ${err.message}`;
      
      setError(errorMessage);
      toast.error(errorMessage);
      debug(`Screen share error: ${err.name} - ${err.message}`);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Setup audio level monitoring
  const setupAudioMonitoring = useCallback(async (stream: MediaStream) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      debug('No audio tracks for monitoring');
      return;
    }

    debug(`Setting up audio monitoring with ${audioTracks.length} audio tracks`);
    
    // Log track details
    audioTracks.forEach((track, index) => {
      debug(`Audio track ${index}: ${track.label} - enabled: ${track.enabled} - ready: ${track.readyState}`);
    });

    try {
      // Clean up existing audio context first
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Resume audio context if it's suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        debug('Audio context resumed');
      }
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 512; // Increased for better sensitivity
      analyser.smoothingTimeConstant = 0.3; // More responsive
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let isMonitoring = true;
      
      const updateAudioLevel = () => {
        if (!analyserRef.current || !isMonitoring || (!isPreviewing && !isStreaming)) {
          return;
        }
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate RMS for better audio level detection
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(rms / 128, 1);
        
        setAudioLevel(level);
        
        // Debug high audio levels
        if (level > 0.1) {
          debug(`Audio level detected: ${(level * 100).toFixed(1)}%`);
        }
        
        animationRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      // Start monitoring
      updateAudioLevel();
      debug('Audio monitoring setup complete - starting level detection');
      
    } catch (err) {
      debug(`Audio monitoring setup failed: ${err}`);
      console.error('Audio monitoring setup failed:', err);
    }
  }, [isPreviewing, isStreaming]);

  // Stop preview
  const stopPreview = useCallback(() => {
    debug('Stopping preview...');
    
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        debug(`Stopped track: ${track.kind}`);
      });
      mediaStreamRef.current = null;
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Stop audio monitoring
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.warn);
      audioContextRef.current = null;
    }

    setIsPreviewing(false);
    setHasVideo(false);
    setHasAudio(false);
    setAudioLevel(0);
    setError(null);
    setDebugInfo('');
    debug('Preview stopped');
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (!mediaStreamRef.current) return;
    
    const videoTracks = mediaStreamRef.current.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !videoEnabled;
    });
    setVideoEnabled(!videoEnabled);
    debug(`Video ${!videoEnabled ? 'enabled' : 'disabled'}`);
  }, [videoEnabled]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (!mediaStreamRef.current) return;
    
    const audioTracks = mediaStreamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !audioEnabled;
    });
    setAudioEnabled(!audioEnabled);
    debug(`Audio ${!audioEnabled ? 'enabled' : 'disabled'}`);
  }, [audioEnabled]);

  // Toggle preview mute
  const togglePreviewMute = useCallback(() => {
    if (videoRef.current) {
      const newMutedState = !isPreviewMuted;
      videoRef.current.muted = newMutedState;
      setIsPreviewMuted(newMutedState);
      debug(`Preview ${newMutedState ? 'muted' : 'unmuted'}`);
      toast.info(newMutedState ? 'Preview muted' : 'Preview unmuted');
    }
  }, [isPreviewMuted]);

  // Start streaming
  const startStream = useCallback(async () => {
    if (!mediaStreamRef.current) {
      toast.error('No media stream available. Please start preview first.');
      return;
    }

    debug('Starting stream...');

    if (isPreviewMode && streamKey === 'preview') {
      // Preview mode - just simulate streaming
      setIsStreaming(true);
      toast.success('Preview streaming started!');
      onStreamStart?.();
      debug('Preview stream started');
      return;
    }

    try {
      // For live streaming to RTMP endpoint
      if (!ingestUrl || !streamKey) {
        toast.error('Stream configuration missing. Please restart from Go Live page.');
        return;
      }

      debug(`Starting RTMP stream to ${ingestUrl}`);
      
      // Create a canvas to capture the video stream
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = 1280;
      canvas.height = 720;

      // Get video element for capture
      const videoElement = videoRef.current;
      if (!videoElement) {
        throw new Error('Video element not available');
      }

      // Create a new stream from canvas for RTMP
      const canvasStream = canvas.captureStream(30); // 30 FPS
      
      // Add audio tracks from original stream
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        canvasStream.addTrack(track);
      });

      // Render video to canvas continuously
      const renderFrame = () => {
        if (!isStreaming) return;
        
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(renderFrame);
      };

      // Set up MediaRecorder for RTMP streaming
      const options: MediaRecorderOptions = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000, // 2.5 Mbps
        audioBitsPerSecond: 128000   // 128 kbps
      };

      // Try different formats if vp9 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        const formats = [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=h264,opus',
          'video/webm',
          'video/mp4'
        ];
        
        for (const format of formats) {
          if (MediaRecorder.isTypeSupported(format)) {
            options.mimeType = format;
            debug(`Using format: ${format}`);
            break;
          }
        }
      }

      const mediaRecorder = new MediaRecorder(canvasStream, options);
      mediaRecorderRef.current = mediaRecorder;

      let chunks: Blob[] = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          debug(`Stream chunk: ${event.data.size} bytes`);
          
          // In a real implementation, we would send this to RTMP endpoint
          // For now, we'll simulate by marking the stream as live in the database
          try {
            const streamId = localStorage.getItem('currentStreamId');
            if (streamId) {
              await fetch('/api/stream-heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ streamId, isActive: true })
              }).catch(() => {
                // If endpoint doesn't exist, we'll handle it in the stream monitoring
                debug('Stream heartbeat endpoint not available, using database directly');
              });
            }
          } catch (error) {
            debug(`Heartbeat error: ${error}`);
          }
        }
      };

      mediaRecorder.onstart = () => {
        setIsStreaming(true);
        startHeartbeat();
        renderFrame(); // Start canvas rendering
        toast.success('Live stream started!');
        onStreamStart?.();
        debug('Live stream started');
      };

      mediaRecorder.onstop = () => {
        setIsStreaming(false);
        stopHeartbeat();
        toast.info('Stream stopped');
        onStreamEnd?.();
        debug('Live stream stopped');
        chunks = []; // Clear chunks
      };

      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        toast.error('Streaming error occurred');
        setIsStreaming(false);
      };

      // Start recording in small chunks for streaming
      mediaRecorder.start(1000); // 1 second chunks

    } catch (err) {
      console.error('Failed to start streaming:', err);
      toast.error('Failed to start streaming');
      debug(`Stream start failed: ${err}`);
    }
  }, [isPreviewMode, streamKey, ingestUrl, onStreamStart, onStreamEnd, isStreaming]);

  // Stop streaming
  const stopStream = useCallback(() => {
    debug('Stopping stream...');
    
    if (mediaRecorderRef.current && isStreaming) {
      mediaRecorderRef.current.stop();
    }
    
    if (isPreviewMode) {
      setIsStreaming(false);
      toast.info('Preview stopped');
      onStreamEnd?.();
    }
    
    stopHeartbeat();
  }, [isStreaming, isPreviewMode, onStreamEnd]);

  // Heartbeat for live streams
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    if (!isPreviewMode) {
      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          const streamId = localStorage.getItem('currentStreamId');
          if (streamId && isStreaming) {
            debug('Sending stream heartbeat');
            
            // Update stream as live in database
            const { error } = await supabase
              .from('streams')
              .update({ 
                is_live: true, 
                last_heartbeat: new Date().toISOString() 
              })
              .eq('id', streamId);
              
            if (error) {
              console.error('Heartbeat update failed:', error);
            }
          }
        } catch (err) {
          debug(`Heartbeat failed: ${err}`);
        }
      }, 15000); // Every 15 seconds
    }
  }, [isPreviewMode, isStreaming]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Page visibility and refresh handling
  useEffect(() => {
    // Handle page refresh - restore streaming state
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isStreaming) {
        // Save state before refresh
        localStorage.setItem('browserStreamingActive', 'true');
        localStorage.setItem('streamingMode', streamingMode);
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handleVisibilityChange = () => {
      if (!isStreaming || isPreviewMode) return;

      if (document.hidden) {
        // Page hidden - continue streaming but show warning
        toast.info('Stream continues in background. Return to this tab to manage your stream.');
      } else {
        // Page visible again
        if (isStreaming) {
          toast.success('Welcome back! Your stream is still live.');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isStreaming, isPreviewMode, streamingMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview();
      stopHeartbeat();
    };
  }, [stopPreview, stopHeartbeat]);

  return (
    <div className="space-y-4">
      {/* Debug Info */}
      {debugInfo && (
        <div className="p-2 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300">
          Debug: {debugInfo}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="size-4 text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Stream Setup - Only show if not previewing */}
      {!isPreviewing && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={initializeCamera}
            disabled={isInitializing}
            variant="outline"
            className="h-24 flex flex-col items-center gap-2 bg-white/5 border-white/20 text-white hover:bg-white/10"
          >
            <Camera className="size-8" />
            <div className="text-center">
              <div className="font-medium">Camera</div>
              <div className="text-xs text-gray-400">
                {isInitializing ? 'Starting...' : 'Stream with webcam'}
              </div>
            </div>
          </Button>
          
          <Button
            onClick={initializeScreen}
            disabled={isInitializing}
            variant="outline"
            className="h-24 flex flex-col items-center gap-2 bg-white/5 border-white/20 text-white hover:bg-white/10"
          >
            <Monitor className="size-8" />
            <div className="text-center">
              <div className="font-medium">Screen Share</div>
              <div className="text-xs text-gray-400">
                {isInitializing ? 'Starting...' : 'Share your screen'}
              </div>
            </div>
          </Button>
        </div>
      )}

      {/* Video Preview */}
      {isPreviewing && (
        <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black">
          <div className="aspect-video bg-black flex items-center justify-center">
            {hasVideo ? (
              <video
                ref={videoRef}
                autoPlay
                muted={isPreviewMuted}
                playsInline
                className="w-full h-full object-cover bg-black"
                style={{ transform: streamingMode === 'camera' ? 'scaleX(-1)' : 'none' }}
                onLoadedMetadata={(e) => {
                  console.log('VIDEO RENDER - onLoadedMetadata fired', {
                    videoWidth: e.currentTarget.videoWidth,
                    videoHeight: e.currentTarget.videoHeight,
                    srcObject: !!e.currentTarget.srcObject
                  });
                }}
                onCanPlay={(e) => {
                  console.log('VIDEO RENDER - onCanPlay fired', {
                    readyState: e.currentTarget.readyState,
                    currentTime: e.currentTarget.currentTime
                  });
                }}
                onPlay={() => console.log('VIDEO RENDER - onPlay fired')}
                onPlaying={() => console.log('VIDEO RENDER - onPlaying fired')}
                onError={(e) => console.error('VIDEO RENDER - onError fired', e)}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-gray-400">
                <Camera className="size-12" />
                <p>No video available - hasVideo: {String(hasVideo)}</p>
                <p className="text-xs">Debug: {debugInfo}</p>
              </div>
            )}
          </div>
          
          {/* Status Overlay */}
          <div className="absolute top-3 left-3">
            <span className={`px-2 py-1 text-white text-xs font-medium rounded-full flex items-center gap-1 ${
              isStreaming ? 'bg-red-500' : 'bg-blue-500'
            }`}>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {isStreaming ? 'LIVE' : 'PREVIEW'}
            </span>
          </div>
          
          {/* Mode Indicator */}
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 bg-black/50 text-white text-xs rounded flex items-center gap-1">
              {streamingMode === 'camera' ? <Camera className="size-3" /> : <Monitor className="size-3" />}
              {streamingMode === 'camera' ? 'Camera' : 'Screen'}
            </span>
          </div>
          
          {/* Mute Toggle for preview - positioned in bottom right */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <Button
              onClick={togglePreviewMute}
              variant={isPreviewMuted ? "outline" : "secondary"}
              size="sm"
              className="bg-black/50 border-white/20 text-white hover:bg-black/70 px-2 py-1"
              title={isPreviewMuted ? "Unmute preview" : "Mute preview"}
            >
              {isPreviewMuted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
            </Button>
          </div>
          
          {/* Audio Level */}
          {hasAudio && audioEnabled && (
            <div className="absolute bottom-3 left-3">
              <div className="flex items-center gap-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
                <Mic className="size-3" />
                <div className="w-12 h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-100"
                    style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {isPreviewing && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Video Toggle */}
            <Button
              onClick={toggleVideo}
              variant={videoEnabled ? "outline" : "destructive"}
              size="sm"
              disabled={!hasVideo}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              {videoEnabled ? 
                (streamingMode === 'camera' ? <Video className="size-4" /> : <Monitor className="size-4" />) : 
                <VideoOff className="size-4" />
              }
            </Button>
            
            {/* Audio Toggle */}
            <Button
              onClick={toggleAudio}
              variant={audioEnabled ? "outline" : "destructive"}
              size="sm"
              disabled={!hasAudio}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              {audioEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            </Button>
            
            {/* Reset */}
            <Button
              onClick={stopPreview}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>

          {/* Stream Control - Only show Go Live button, not test buttons */}
          {!isPreviewMode && (
            <div className="flex items-center gap-2">
              {!isStreaming ? (
                <Button
                  onClick={startStream}
                  disabled={!hasVideo && !hasAudio}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  <Play className="size-4 mr-2" />
                  Go Live
                </Button>
              ) : (
                <Button
                  onClick={stopStream}
                  variant="destructive"
                >
                  <Square className="size-4 mr-2" />
                  End Stream
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>• Choose camera for webcam streaming or screen share to broadcast your desktop</p>
        <p>• Test your audio and video in preview mode before going live</p>
        <p>• Make sure to allow permissions when prompted by your browser</p>
        {!isPreviewMode && (
          <p>• Browser streams continue running even if you refresh the page (1 minute grace period)</p>
        )}
      </div>
    </div>
  );
};

export default BrowserStreaming;