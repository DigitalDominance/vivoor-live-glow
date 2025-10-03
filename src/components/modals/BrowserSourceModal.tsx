import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Monitor } from 'lucide-react';

interface BrowserSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSourceSelect: (source: 'camera' | 'screen') => void;
}

export const BrowserSourceModal: React.FC<BrowserSourceModalProps> = ({
  open,
  onOpenChange,
  onSourceSelect,
}) => {
  const [selectedSource, setSelectedSource] = useState<'camera' | 'screen'>('camera');

  const handleContinue = () => {
    onSourceSelect(selectedSource);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black/90 backdrop-blur-xl border border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Choose Your Video Source
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Select how you want to stream in your browser
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <button
            onClick={() => setSelectedSource('camera')}
            className={`w-full p-6 rounded-xl border-2 transition-all duration-300 ${
              selectedSource === 'camera'
                ? 'border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/20'
                : 'border-white/20 bg-white/5 hover:border-cyan-400/50 hover:bg-cyan-500/10'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${
                selectedSource === 'camera' 
                  ? 'bg-cyan-500/30' 
                  : 'bg-white/10'
              }`}>
                <Camera className={`w-8 h-8 ${
                  selectedSource === 'camera' 
                    ? 'text-cyan-400' 
                    : 'text-gray-400'
                }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-lg mb-1">Camera & Microphone</div>
                <div className="text-sm text-gray-400">
                  Stream using your webcam and microphone
                </div>
              </div>
              {selectedSource === 'camera' && (
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
              )}
            </div>
          </button>

          <button
            onClick={() => setSelectedSource('screen')}
            className={`w-full p-6 rounded-xl border-2 transition-all duration-300 ${
              selectedSource === 'screen'
                ? 'border-purple-400 bg-purple-500/20 shadow-lg shadow-purple-500/20'
                : 'border-white/20 bg-white/5 hover:border-purple-400/50 hover:bg-purple-500/10'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${
                selectedSource === 'screen' 
                  ? 'bg-purple-500/30' 
                  : 'bg-white/10'
              }`}>
                <Monitor className={`w-8 h-8 ${
                  selectedSource === 'screen' 
                    ? 'text-purple-400' 
                    : 'text-gray-400'
                }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-lg mb-1">Screen Share</div>
                <div className="text-sm text-gray-400">
                  Share your screen, window, or browser tab
                </div>
              </div>
              {selectedSource === 'screen' && (
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse" />
              )}
            </div>
          </button>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            className="flex-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold"
          >
            Continue with {selectedSource === 'camera' ? 'Camera' : 'Screen Share'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
