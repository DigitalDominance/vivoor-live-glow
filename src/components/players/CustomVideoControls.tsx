import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Maximize, Users, Scissors, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  showClipping = true
}) => {
  const formatTime = (seconds: number) => {
    return new Date(seconds * 1000).toISOString().substring(11, 19);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4"
    >
      <div className="flex items-center justify-between">
        {/* Left controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPlayPause}
            className="group relative h-12 w-12 rounded-full bg-gradient-to-r from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 backdrop-blur-sm border border-white/20 hover:from-brand-cyan/30 hover:via-brand-iris/30 hover:to-brand-pink/30 transition-all duration-300"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <Pause className="h-5 w-5 text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <Play className="h-5 w-5 text-white ml-0.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMute}
              className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-white" />
              ) : (
                <Volume2 className="h-4 w-4 text-white" />
              )}
            </Button>
            <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
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
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              {formatTime(elapsed)}
            </span>
            {isLive && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-white text-sm font-bold px-3 py-1 rounded-full bg-gradient-to-r from-red-500 to-red-600 border border-red-400/50"
              >
                LIVE
              </motion.span>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Viewer count */}
          <div className="flex items-center gap-2 text-white text-sm px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
            <Users className="h-4 w-4" />
            <span className="font-medium">{viewers}</span>
          </div>

          {/* Clip button */}
          {showClipping && isLive && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCreateClip}
              className="group h-10 w-10 rounded-full bg-gradient-to-r from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 backdrop-blur-sm border border-white/20 hover:from-brand-cyan/30 hover:via-brand-iris/30 hover:to-brand-pink/30 transition-all duration-300"
              title="Create Clip"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
              <Scissors className="h-4 w-4 text-white" />
            </Button>
          )}

          {/* Fullscreen button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onFullscreen}
            className="group h-10 w-10 rounded-full bg-gradient-to-r from-brand-cyan/20 via-brand-iris/20 to-brand-pink/20 backdrop-blur-sm border border-white/20 hover:from-brand-cyan/30 hover:via-brand-iris/30 hover:to-brand-pink/30 transition-all duration-300"
            title="Fullscreen"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
            <Maximize className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default CustomVideoControls;