import React from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Square, Monitor, MonitorSpeaker } from 'lucide-react';
import { toast } from 'sonner';

interface BrowserStreamingProps {
  streamKey: string;
  ingestUrl: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
}

const BrowserStreaming: React.FC<BrowserStreamingProps> = ({
  streamKey,
  ingestUrl,
  onStreamStart,
  onStreamEnd
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const websocketRef = React.useRef<WebSocket | null>(null);
  
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [streamingMode, setStreamingMode] = React.useState<'camera' | 'screen'>('camera');
  const [hasCamera, setHasCamera] = React.useState(false);
  const [hasMicrophone, setHasMicrophone] = React.useState(false);
  const [cameraEnabled, setCameraEnabled] = React.useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = React.useState(true);
  const [isInitializing, setIsInitializing] = React.useState(false);
  const [audioLevel, setAudioLevel] = React.useState(0);

  // Initialize camera media
  const initializeCamera = async () => {
    try {
      setIsInitializing(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      mediaStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Check which devices are available
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasCamera(videoTracks.length > 0);
      setHasMicrophone(audioTracks.length > 0);
      setStreamingMode('camera');
      setIsPreviewing(true);
      
      // Set up audio level monitoring
      setupAudioMonitoring(stream);
      
      toast.success('Camera and microphone ready!');
    } catch (error) {
      console.error('Failed to initialize camera:', error);
      toast.error('Failed to access camera/microphone. Please check permissions.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Initialize screen sharing
  const initializeScreen = async () => {
    try {
      setIsInitializing(true);
      
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true // Include system audio if available
      });

      // Also get microphone for commentary
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (micError) {
        console.warn('Could not access microphone:', micError);
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Combine screen and microphone streams
      const combinedStream = new MediaStream();
      
      // Add screen video
      screenStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
      
      // Add system audio from screen if available
      screenStream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
      
      // Add microphone audio if available
      if (micStream) {
        micStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }

      mediaStreamRef.current = combinedStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = combinedStream;
      }

      setHasCamera(true); // Screen sharing counts as "camera"
      setHasMicrophone(combinedStream.getAudioTracks().length > 0);
      setStreamingMode('screen');
      setIsPreviewing(true);
      
      // Set up audio level monitoring
      setupAudioMonitoring(combinedStream);
      
      // Handle screen share ending
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        setIsPreviewing(false);
        stopStream();
        toast.info('Screen sharing ended');
      });
      
      toast.success('Screen sharing ready!');
    } catch (error) {
      console.error('Failed to initialize screen sharing:', error);
      toast.error('Failed to start screen sharing. Please check permissions.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Set up audio level monitoring
  const setupAudioMonitoring = (stream: MediaStream) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (!isPreviewing && !isStreaming) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        
        requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (error) {
      console.warn('Audio monitoring not available:', error);
    }
  };

  // Stop preview
  const stopPreview = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsPreviewing(false);
    setHasCamera(false);
    setHasMicrophone(false);
    setAudioLevel(0);
  };

  // Toggle camera/video
  const toggleVideo = () => {
    if (!mediaStreamRef.current) return;
    
    const videoTracks = mediaStreamRef.current.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !cameraEnabled;
    });
    setCameraEnabled(!cameraEnabled);
  };

  // Toggle microphone
  const toggleMicrophone = () => {
    if (!mediaStreamRef.current) return;
    
    const audioTracks = mediaStreamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !microphoneEnabled;
    });
    setMicrophoneEnabled(!microphoneEnabled);
  };

  // Start streaming
  const startStream = async () => {
    if (!mediaStreamRef.current || !isPreviewing) {
      toast.error('Please start preview first');
      return;
    }

    try {
      // For now, we'll use a simple approach - in a real implementation,
      // you'd want to use WebRTC or FFmpeg.wasm to encode and send to RTMP
      
      // Create a MediaRecorder to capture the stream
      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          // In a real implementation, you'd send these chunks to your RTMP endpoint
          // For now, we'll just simulate streaming
          console.log('Streaming data chunk:', event.data.size, 'bytes');
        }
      };
      
      mediaRecorder.onstart = () => {
        setIsStreaming(true);
        toast.success('Stream started! You are now live!');
        onStreamStart?.();
      };
      
      mediaRecorder.onstop = () => {
        setIsStreaming(false);
        toast.info('Stream stopped');
        onStreamEnd?.();
      };
      
      // Start recording in chunks
      mediaRecorder.start(1000); // 1 second chunks
      
    } catch (error) {
      console.error('Failed to start streaming:', error);
      toast.error('Failed to start streaming');
    }
  };

  // Stop streaming
  const stopStream = () => {
    if (mediaRecorderRef.current && isStreaming) {
      mediaRecorderRef.current.stop();
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Stream Setup - Only show if not previewing */}
      {!isPreviewing && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={initializeCamera}
            disabled={isInitializing}
            variant="outline"
            className="h-24 flex flex-col items-center gap-2"
          >
            <Camera className="size-8" />
            <div className="text-center">
              <div className="font-medium">Camera Stream</div>
              <div className="text-xs text-muted-foreground">
                {isInitializing ? 'Starting...' : 'Stream with webcam'}
              </div>
            </div>
          </Button>
          
          <Button
            onClick={initializeScreen}
            disabled={isInitializing}
            variant="outline"
            className="h-24 flex flex-col items-center gap-2"
          >
            <Monitor className="size-8" />
            <div className="text-center">
              <div className="font-medium">Screen Share</div>
              <div className="text-xs text-muted-foreground">
                {isInitializing ? 'Starting...' : 'Stream your screen'}
              </div>
            </div>
          </Button>
        </div>
      )}

      {/* Video Preview */}
      {isPreviewing && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-card/60 backdrop-blur-md">
          <div className="aspect-video bg-background flex items-center justify-center">
            {hasCamera ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Camera className="size-12" />
                <p>Camera not available</p>
              </div>
            )}
          </div>
          
          {/* Preview Mode Overlay */}
          {!isStreaming && (
            <div className="absolute top-3 left-3">
              <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                PREVIEW
              </span>
            </div>
          )}
          
          {/* Live Stream Overlay */}
          {isStreaming && (
            <div className="absolute top-3 left-3">
              <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
          )}
          
          {/* Stream Mode Indicator */}
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 bg-black/50 text-white text-xs rounded">
              {streamingMode === 'camera' ? 'Camera' : 'Screen Share'}
            </span>
          </div>
          
          {/* Audio Level Indicator */}
          {hasMicrophone && microphoneEnabled && (
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
          {/* Device Controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleVideo}
              variant={cameraEnabled ? "outline" : "destructive"}
              size="sm"
              disabled={!hasCamera}
              title={cameraEnabled ? 'Disable video' : 'Enable video'}
            >
              {cameraEnabled ? 
                (streamingMode === 'camera' ? <Video className="size-4" /> : <Monitor className="size-4" />) : 
                <VideoOff className="size-4" />
              }
            </Button>
            <Button
              onClick={toggleMicrophone}
              variant={microphoneEnabled ? "outline" : "destructive"}
              size="sm"
              disabled={!hasMicrophone}
              title={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {microphoneEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            </Button>
            <Button
              onClick={stopPreview}
              variant="outline"
              size="sm"
              title="Stop preview and choose different source"
            >
              Stop Preview
            </Button>
          </div>

          {/* Stream Control */}
          <div className="flex items-center gap-2">
            {!isStreaming ? (
              <Button
                onClick={startStream}
                disabled={!hasCamera && !hasMicrophone}
                variant="default"
                className="bg-red-500 hover:bg-red-600"
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
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Choose between camera streaming or screen sharing</p>
        <p>• Preview mode lets you test your audio and video before going live</p>
        <p>• Audio level indicator shows your microphone activity</p>
        <p>• Make sure to allow camera/microphone or screen sharing permissions when prompted</p>
      </div>
    </div>
  );
};

export default BrowserStreaming;