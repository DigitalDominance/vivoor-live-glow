import React from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Square } from 'lucide-react';
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
  const [hasCamera, setHasCamera] = React.useState(false);
  const [hasMicrophone, setHasMicrophone] = React.useState(false);
  const [cameraEnabled, setCameraEnabled] = React.useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = React.useState(true);
  const [isInitializing, setIsInitializing] = React.useState(false);

  // Initialize media devices
  const initializeMedia = async () => {
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

      mediaStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Check which devices are available
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasCamera(videoTracks.length > 0);
      setHasMicrophone(audioTracks.length > 0);
      
      toast.success('Camera and microphone ready!');
    } catch (error) {
      console.error('Failed to initialize media:', error);
      toast.error('Failed to access camera/microphone. Please check permissions.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Toggle camera
  const toggleCamera = () => {
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
    if (!mediaStreamRef.current) {
      toast.error('Please initialize camera and microphone first');
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
        toast.success('Browser stream started!');
        onStreamStart?.();
      };
      
      mediaRecorder.onstop = () => {
        setIsStreaming(false);
        toast.info('Browser stream stopped');
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
      {/* Video Preview */}
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
        
        {/* Stream Status Overlay */}
        {isStreaming && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        {/* Device Controls */}
        <div className="flex items-center gap-2">
          {!hasCamera && !hasMicrophone ? (
            <Button
              onClick={initializeMedia}
              disabled={isInitializing}
              variant="outline"
              size="sm"
            >
              <Camera className="size-4 mr-2" />
              {isInitializing ? 'Initializing...' : 'Setup Camera & Mic'}
            </Button>
          ) : (
            <>
              <Button
                onClick={toggleCamera}
                variant={cameraEnabled ? "outline" : "destructive"}
                size="sm"
                disabled={!hasCamera}
              >
                {cameraEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
              </Button>
              <Button
                onClick={toggleMicrophone}
                variant={microphoneEnabled ? "outline" : "destructive"}
                size="sm"
                disabled={!hasMicrophone}
              >
                {microphoneEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              </Button>
            </>
          )}
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
              Start Streaming
            </Button>
          ) : (
            <Button
              onClick={stopStream}
              variant="destructive"
            >
              <Square className="size-4 mr-2" />
              Stop Streaming
            </Button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Browser streaming uses your device's camera and microphone</p>
        <p>• Make sure to allow camera and microphone permissions when prompted</p>
        <p>• Stream quality depends on your device capabilities and internet connection</p>
      </div>
    </div>
  );
};

export default BrowserStreaming;