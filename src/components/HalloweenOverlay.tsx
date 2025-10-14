import { useEffect, useState } from "react";

export const HalloweenOverlay = () => {
  const [ghosts] = useState(() => 
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 90 + 5}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${15 + Math.random() * 10}s`
    }))
  );

  const [pumpkins] = useState(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 90 + 5}%`,
      top: `${Math.random() * 80 + 10}%`,
      size: `${Math.random() * 30 + 30}px`,
      rotation: `${Math.random() * 30 - 15}deg`
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Fog/Smoke at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-purple-900/20 via-purple-800/10 to-transparent animate-pulse" style={{ animationDuration: "3s" }} />
      
      {/* Floating Ghosts */}
      {ghosts.map((ghost) => (
        <div
          key={ghost.id}
          className="absolute text-4xl opacity-70 hover:opacity-100 transition-opacity"
          style={{
            left: ghost.left,
            animation: `float-ghost ${ghost.duration} ease-in-out infinite`,
            animationDelay: ghost.delay,
            top: "-100px"
          }}
        >
          👻
        </div>
      ))}

      {/* Scattered Pumpkins */}
      {pumpkins.map((pumpkin) => (
        <div
          key={pumpkin.id}
          className="absolute animate-pulse opacity-40 hover:opacity-80 transition-opacity"
          style={{
            left: pumpkin.left,
            top: pumpkin.top,
            fontSize: pumpkin.size,
            transform: `rotate(${pumpkin.rotation})`,
            animationDuration: "4s"
          }}
        >
          🎃
        </div>
      ))}

      <style>{`
        @keyframes float-ghost {
          0%, 100% {
            transform: translateY(-100px) translateX(0);
          }
          25% {
            transform: translateY(20vh) translateX(-30px);
          }
          50% {
            transform: translateY(50vh) translateX(30px);
          }
          75% {
            transform: translateY(80vh) translateX(-20px);
          }
          100% {
            transform: translateY(110vh) translateX(0);
          }
        }
      `}</style>
    </div>
  );
};
