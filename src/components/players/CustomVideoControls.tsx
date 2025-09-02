import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Maximize, Users, Scissors, Volume2, VolumeX, Settings, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CustomVideoControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onFullscreen: () => void;
  onCreateClip: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  elapsed: number;
  viewers: number;
  isLive: boolean;
  showClipping?: boolean;
  qualityLevels?: Array<{label: string, value: number}>;
  currentQuality?: number;
  onQualityChange?: (quality: number) => void;
}

const CustomVideoControls: React.FC<CustomVideoControlsProps> = ({
  isPlaying,
  onPlayPause,
  onFullscreen,
  onCreateClip,
  volume,
  onVolumeChange,
  isMuted,
  onToggleMute,
  elapsed,
  viewers,
  isLive,
  showClipping = true,
  qualityLevels,
  currentQuality,
  onQualityChange
}) => {
  const [qualityPopoverOpen, setQualityPopoverOpen] = useState(false);
  const formatTime = (seconds: number) => {
    return new Date(seconds * 1000).toISOString().substring(11, 19);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 md:p-4"
    >
      <div className="flex items-center justify-between">
        {/* Left controls */}
        <div className="flex items-center gap-1 md:gap-3">

          {/* Volume control */}
          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMute}
              className="h-5 w-5 md:h-8 md:w-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              {isMuted ? (
                <VolumeX className="h-2.5 w-2.5 md:h-4 md:w-4 text-white" />
              ) : (
                <Volume2 className="h-2.5 w-2.5 md:h-4 md:w-4 text-white" />
              )}
            </Button>
            <div 
              className="w-8 md:w-16 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, x / rect.width));
                onVolumeChange(percentage);
              }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-brand-cyan to-brand-iris rounded-full"
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${isMuted ? 0 : volume * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>

          {/* Time display */}
          <div className="flex items-center gap-1">
            <span className="text-white text-[10px] md:text-sm font-medium px-1 md:px-3 py-0.5 md:py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              {formatTime(elapsed)}
            </span>
            {isLive && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-white text-[10px] md:text-sm font-bold px-1 md:px-3 py-0.5 md:py-1 rounded-full bg-gradient-to-r from-red-500 to-red-600 border border-red-400/50"
              >
                LIVE
              </motion.span>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-0.5 md:gap-3">
          {/* Viewer count */}
          <div className="flex items-center gap-0.5 md:gap-2 text-white text-[10px] md:text-sm px-1 md:px-3 py-0.5 md:py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
            <Users className="h-2.5 w-2.5 md:h-4 md:w-4" />
            <span className="font-medium">{viewers}</span>
          </div>

          {/* Clip button */}
          {showClipping && isLive && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCreateClip}
              className="group h-5 w-5 md:h-10 md:w-10 rounded-full bg-gradient-to-r from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 backdrop-blur-sm border border-white/20 hover:from-brand-cyan/30 hover:via-brand-iris/30 hover:to-brand-pink/30 transition-all duration-300"
              title="Create Clip"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
              <Scissors className="h-2.5 w-2.5 md:h-4 md:w-4 text-white" />
            </Button>
          )}

          {/* Quality selector */}
          {qualityLevels && qualityLevels.length > 1 && (
            <Popover open={qualityPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="group h-5 w-5 md:h-10 md:w-10 rounded-full bg-gradient-to-r from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 backdrop-blur-sm border border-white/20 hover:from-brand-cyan/30 hover:via-brand-iris/30 hover:to-brand-pink/30 transition-all duration-300"
                  title="Quality Settings"
                  onClick={() => setQualityPopoverOpen(!qualityPopoverOpen)}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                  <Settings className="h-2.5 w-2.5 md:h-4 md:w-4 text-white" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                side="top"
                align="end" 
                className="w-36 bg-background border border-border shadow-xl p-0"
                style={{ zIndex: 999999 }}
                sideOffset={8}
              >
                <div className="flex items-center justify-between p-2 border-b border-border">
                  <span className="text-sm font-medium">Quality</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 hover:bg-accent"
                    onClick={() => setQualityPopoverOpen(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="py-1">
                  {qualityLevels.map((level) => (
                    <div
                      key={level.value}
                      onClick={() => {
                        onQualityChange?.(level.value);
                        setQualityPopoverOpen(false);
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors ${
                        currentQuality === level.value ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{level.label}</span>
                        {currentQuality === level.value && (
                          <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-brand-cyan to-brand-iris ml-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Fullscreen button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onFullscreen}
            className="group h-5 w-5 md:h-10 md:w-10 rounded-full bg-gradient-to-r from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 backdrop-blur-sm border border-white/20 hover:from-brand-cyan/30 hover:via-brand-iris/30 hover:to-brand-pink/30 transition-all duration-300"
            title="Fullscreen"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
            <Maximize className="h-2.5 w-2.5 md:h-4 md:w-4 text-white" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default CustomVideoControls;