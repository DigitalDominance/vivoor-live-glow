import React from "react";

const PlayerPlaceholder: React.FC = () => {
  return (
    <div className="relative rounded-xl border border-border bg-card/60 backdrop-blur-md overflow-hidden">
      <div className="aspect-video flex items-center justify-center">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)] bg-[length:200%_100%] animate-shimmer" />
        <div className="equalizer">
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </div>
      </div>
    </div>
  );
};

export default PlayerPlaceholder;
