import React from "react";
import "./background-v2.css";

/*
  BackgroundV2
  - Neutral canvas (uses theme background variables)
  - Orbital gradient rings (SVG) rotating very slowly
  - Sparse particle field drifting
  - Occasional aurora puffs clipped to partial viewport
  - Pointer-events: none; disabled/toned down when prefers-reduced-motion
*/

const BackgroundV2: React.FC = () => {
  // Responsive particle count based on screen size
  const getParticleCount = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 480) return 15; // Small mobile
      if (window.innerWidth < 768) return 20; // Mobile
      return 28; // Desktop
    }
    return 28;
  };

  const [particleCount, setParticleCount] = React.useState(getParticleCount);

  React.useEffect(() => {
    const handleResize = () => setParticleCount(getParticleCount());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const particles = Array.from({ length: particleCount }).map((_, i) => ({
    id: i,
    // Distribute particles around the viewport
    top: `${(i * 37) % 95 + 2}%`,
    left: `${(i * 53) % 95 + 2}%`,
    size: 3 + ((i * 7) % 10),
    delay: (i % 12) * 3,
  }));

  return (
    <div className="v2-bg-container" aria-hidden>
      {/* Orbital Rings */}
      <svg className="ring ring-1" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="v2-ring-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={`hsl(var(--brand-cyan))`} />
            <stop offset="50%" stopColor={`hsl(var(--brand-iris))`} />
            <stop offset="100%" stopColor={`hsl(var(--brand-pink))`} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="38" stroke="url(#v2-ring-gradient-1)" strokeWidth="0.4" fill="none" />
      </svg>

      <svg className="ring ring-2" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="v2-ring-gradient-2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={`hsl(var(--brand-pink))`} />
            <stop offset="50%" stopColor={`hsl(var(--brand-cyan))`} />
            <stop offset="100%" stopColor={`hsl(var(--brand-iris))`} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="30" stroke="url(#v2-ring-gradient-2)" strokeWidth="0.35" fill="none" />
      </svg>

      {/* Aurora puffs (clipped, partial viewport) */}
      <div className="aurora-puff puff-a" />
      <div className="aurora-puff puff-b" />

      {/* Sparse particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className={`particle particle-${(p.id % 3) + 1}`}
          style={{ top: p.top, left: p.left, width: p.size, height: p.size, animationDelay: `${p.delay}s` }}
        />
      ))}
    </div>
  );
};

export default BackgroundV2;
