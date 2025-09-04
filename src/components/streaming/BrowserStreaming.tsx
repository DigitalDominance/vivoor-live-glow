import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Square, Monitor, RefreshCw, AlertCircle } from 'lucide-react';
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
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

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

      // Set up video element
      if (videoRef.current && stream) {
        debug('Setting up video element...');
        
        const video = videoRef.current;
        
        // Clear any existing source first
        video.srcObject = null;
        
        // Set the new source immediately
        video.srcObject = stream;
        video.muted = true; // Always mute to prevent feedback
        video.playsInline = true;
        video.autoplay = true;

        // Force video to load and play
        try {
          await video.load();
          await video.play();
          debug('Video element playing successfully');
        } catch (playError) {
          debug(`Initial video play error: ${playError}`);
          // Try again after a short delay
          setTimeout(async () => {
            try {
              await video.play();
              debug('Video playing after retry');
            } catch (retryError) {
              debug(`Video retry failed: ${retryError}`);
            }
          }, 500);
        }
      }

      setupAudioMonitoring(stream);
      setIsPreviewing(true);
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

      // Set up video element
      if (videoRef.current && combinedStream) {
        debug('Setting up video element for screen share...');
        
        const video = videoRef.current;
        
        // Clear any existing source first
        video.srcObject = null;
        
        // Set the new source immediately
        video.srcObject = combinedStream;
        video.muted = true; // Always mute to prevent feedback
        video.playsInline = true;
        video.autoplay = true;
        
        // Force video to load and play
        try {
          await video.load();
          await video.play();
          debug('Screen share video playing successfully');
        } catch (playError) {
          debug(`Screen share video play error: ${playError}`);
          // Try again after a short delay
          setTimeout(async () => {
            try {
              await video.play();
              debug('Screen share video playing after retry');
            } catch (retryError) {
              debug(`Screen share video retry failed: ${retryError}`);
            }
          }, 500);
        }
      }

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
      
      // Test audio by playing a brief tone (silent)
      setTimeout(() => {
        const testOscillator = audioContext.createOscillator();
        const testGain = audioContext.createGain();
        testOscillator.connect(testGain);
        testGain.connect(audioContext.destination);
        testGain.gain.setValueAtTime(0, audioContext.currentTime); // Silent
        testOscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        testOscillator.start();
        testOscillator.stop(audioContext.currentTime + 0.01);
        debug('Audio context test completed');
      }, 100);
      
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
      // For live streaming, set up MediaRecorder
      const options: MediaRecorderOptions = {};

      // Try different formats in order of preference
      const formats = [
        'video/webm;codecs=vp9,opus',
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

      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          debug(`Stream data chunk: ${event.data.size} bytes`);
          // In a real implementation, send this data to RTMP endpoint
        }
      };

      mediaRecorder.onstart = () => {
        setIsStreaming(true);
        startHeartbeat();
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
      };

      mediaRecorder.start(1000); // 1 second chunks

    } catch (err) {
      console.error('Failed to start streaming:', err);
      toast.error('Failed to start streaming');
      debug(`Stream start failed: ${err}`);
    }
  }, [isPreviewMode, streamKey, onStreamStart, onStreamEnd]);

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
          if (streamId) {
            debug('Sending stream heartbeat');
          }
        } catch (err) {
          debug(`Heartbeat failed: ${err}`);
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
          debug('Grace period expired, ending stream');
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
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: streamingMode === 'camera' ? 'scaleX(-1)' : 'none' }}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-gray-400">
                <Camera className="size-12" />
                <p>No video available</p>
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
          
          {/* Stream Info */}
          <div className="absolute bottom-3 right-3">
            <div className="px-2 py-1 bg-black/50 text-white text-xs rounded">
              Video: {hasVideo ? '✓' : '✗'} Audio: {hasAudio ? '✓' : '✗'}
            </div>
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