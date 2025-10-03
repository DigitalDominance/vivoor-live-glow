import React from 'react';
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
  onClose: () => void;
  onSelectSource: (source: 'camera' | 'screen') => void;
}

const BrowserSourceModal: React.FC<BrowserSourceModalProps> = ({
  open,
  onClose,
  onSelectSource,
}) => {
  const handleSelect = (source: 'camera' | 'screen') => {
    onSelectSource(source);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Streaming Source</DialogTitle>
          <DialogDescription>
            Select what you want to stream from your browser
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="h-32 flex flex-col items-center justify-center gap-3 hover:bg-primary/10 hover:border-primary"
            onClick={() => handleSelect('camera')}
          >
            <Camera className="w-8 h-8" />
            <div className="text-center">
              <div className="font-semibold">Camera</div>
              <div className="text-xs text-muted-foreground">Stream from webcam</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-32 flex flex-col items-center justify-center gap-3 hover:bg-primary/10 hover:border-primary"
            onClick={() => handleSelect('screen')}
          >
            <Monitor className="w-8 h-8" />
            <div className="text-center">
              <div className="font-semibold">Screen</div>
              <div className="text-xs text-muted-foreground">Share your screen</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrowserSourceModal;
