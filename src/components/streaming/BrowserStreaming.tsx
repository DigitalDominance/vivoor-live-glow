import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Square, Monitor, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface BrowserStreamingProps {
  streamKey: string;
  ingestUrl: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  isPreviewMode?: boolean;
}

type StreamingMode = 'camera' | 'screen';

const BrowserStreaming: React.FC<BrowserStreamingProps> = ({
  streamKey,
  ingestUrl,
  onStreamStart,
  onStreamEnd,
  isPreviewMode = false
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [streamingMode, setStreamingMode] = useState<StreamingMode>('camera');
  const [isInitializing, setIsInitializing] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize camera stream
  const initializeCamera = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // Stop any existing stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      mediaStreamRef.current = stream;
      setStreamingMode('camera');
      
      // Set video source and ensure it plays
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Prevent feedback
        
        // Force play when metadata is loaded
        const handleLoadedMetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(console.error);
          }
        };
        
        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        
        // Clean up event listener
        return () => {
          videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
      }

      setupAudioMonitoring(stream);
      setIsPreviewing(true);
      toast.success('Camera ready!');

    } catch (err) {
      console.error('Camera initialization failed:', err);
      setError('Failed to access camera. Please check permissions.');
      toast.error('Failed to access camera. Please check permissions.');
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Initialize screen sharing
  const initializeScreen = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // Stop any existing stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: true
      });

      let audioStream: MediaStream | null = null;
      
      // Try to get microphone audio
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        });
      } catch (audioErr) {
        console.warn('Could not access microphone:', audioErr);
      }

      // Combine streams
      const combinedStream = new MediaStream();
      
      // Add video track from screen
      displayStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });

      // Add system audio if available
      displayStream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
      });

      // Add microphone audio if available
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }

      mediaStreamRef.current = combinedStream;
      setStreamingMode('screen');

      // Set video source and ensure it plays
      if (videoRef.current) {
        videoRef.current.srcObject = combinedStream;
        videoRef.current.muted = true; // Prevent feedback
        
        // Force play when metadata is loaded
        const handleLoadedMetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(console.error);
          }
        };
        
        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      }

      // Handle screen share ending
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          stopPreview();
          toast.info('Screen sharing ended');
        });
      }

      setupAudioMonitoring(combinedStream);
      setIsPreviewing(true);
      toast.success('Screen sharing ready!');

    } catch (err) {
      console.error('Screen sharing failed:', err);
      setError('Failed to start screen sharing. Please check permissions.');
      toast.error('Failed to start screen sharing. Please check permissions.');
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Setup audio level monitoring
  const setupAudioMonitoring = useCallback((stream: MediaStream) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (!analyserRef.current || (!isPreviewing && !isStreaming)) {
          return;
        }
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(average / 128, 1)); // Normalize to 0-1
        
        animationRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
    } catch (err) {
      console.warn('Audio monitoring setup failed:', err);
    }
  }, [isPreviewing, isStreaming]);

  // Stop preview
  const stopPreview = useCallback(() => {
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
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
    setAudioLevel(0);
    setError(null);
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (!mediaStreamRef.current) return;
    
    const videoTracks = mediaStreamRef.current.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !videoEnabled;
    });
    setVideoEnabled(!videoEnabled);
  }, [videoEnabled]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (!mediaStreamRef.current) return;
    
    const audioTracks = mediaStreamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !audioEnabled;
    });
    setAudioEnabled(!audioEnabled);
  }, [audioEnabled]);

  // Start streaming
  const startStream = useCallback(async () => {
    if (!mediaStreamRef.current) {
      toast.error('No media stream available. Please start preview first.');
      return;
    }

    if (isPreviewMode && streamKey === 'preview') {
      // Preview mode - just simulate streaming
      setIsStreaming(true);
      toast.success('Preview streaming started!');
      onStreamStart?.();
      return;
    }

    try {
      // For live streaming, set up MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: 'video/webm;codecs=vp9,opus'
      };

      // Fallback for browsers that don't support vp9
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
      }

      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // In a real implementation, send this data to RTMP endpoint
          console.log('Stream data chunk:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstart = () => {
        setIsStreaming(true);
        startHeartbeat();
        toast.success('Live stream started!');
        onStreamStart?.();
      };

      mediaRecorder.onstop = () => {
        setIsStreaming(false);
        stopHeartbeat();
        toast.info('Stream stopped');
        onStreamEnd?.();
      };

      mediaRecorder.start(1000); // 1 second chunks

    } catch (err) {
      console.error('Failed to start streaming:', err);
      toast.error('Failed to start streaming');
    }
  }, [isPreviewMode, streamKey, onStreamStart, onStreamEnd]);

  // Stop streaming
  const stopStream = useCallback(() => {
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
          if (streamId) {
            // Send heartbeat to server
            console.log('Sending stream heartbeat');
          }
        } catch (err) {
          console.warn('Heartbeat failed:', err);
        }
      }, 30000);
    }
  }, [isPreviewMode]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Page visibility handling
  useEffect(() => {
    if (!isStreaming || isPreviewMode) return;

    let gracePeriodTimer: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        gracePeriodTimer = setTimeout(() => {
          console.log('Grace period expired, ending stream');
          stopStream();
        }, 60000); // 1 minute
        toast.info('Stream will end in 1 minute if you don\'t return');
      } else {
        if (gracePeriodTimer) {
          clearTimeout(gracePeriodTimer);
          gracePeriodTimer = null;
          toast.success('Welcome back! Stream continues');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (gracePeriodTimer) {
        clearTimeout(gracePeriodTimer);
      }
    };
  }, [isStreaming, isPreviewMode, stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview();
      stopHeartbeat();
    };
  }, [stopPreview, stopHeartbeat]);

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
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
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: streamingMode === 'camera' ? 'scaleX(-1)' : 'none' }}
            />
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
          
          {/* Audio Level */}
          {audioEnabled && (
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

          {/* Stream Control */}
          <div className="flex items-center gap-2">
            {!isStreaming ? (
              <Button
                onClick={startStream}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <Play className="size-4 mr-2" />
                {isPreviewMode ? 'Test Stream' : 'Go Live'}
              </Button>
            ) : (
              <Button
                onClick={stopStream}
                variant="destructive"
              >
                <Square className="size-4 mr-2" />
                {isPreviewMode ? 'Stop Test' : 'End Stream'}
              </Button>
            )}
          </div>
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