import { useState } from "react";

export const HalloweenOverlay = () => {
  // Position ghosts on left and right sides only
  const [ghosts] = useState(() => 
    Array.from({ length: 6 }, (_, i) => {
      const isLeft = i % 2 === 0;
      return {
        id: i,
        left: isLeft ? `${Math.random() * 20}%` : `${80 + Math.random() * 20}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${15 + Math.random() * 10}s`
      };
    })
  );

  // Position pumpkins on left and right sides only
  const [pumpkins] = useState(() =>
    Array.from({ length: 8 }, (_, i) => {
      const isLeft = i % 2 === 0;
      return {
        id: i,
        left: isLeft ? `${Math.random() * 20}%` : `${80 + Math.random() * 20}%`,
        top: `${Math.random() * 80 + 10}%`,
        size: `${Math.random() * 30 + 30}px`,
        rotation: `${Math.random() * 30 - 15}deg`
      };
    })
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Fog/Smoke at bottom - left side */}
      <div className="absolute bottom-0 left-0 w-1/4 h-48 bg-gradient-to-t from-purple-700/40 via-purple-600/20 to-transparent animate-pulse" style={{ animationDuration: "4s" }} />
      
      {/* Fog/Smoke at bottom - right side */}
      <div className="absolute bottom-0 right-0 w-1/4 h-48 bg-gradient-to-t from-purple-700/40 via-purple-600/20 to-transparent animate-pulse" style={{ animationDuration: "4s", animationDelay: "2s" }} />
      
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
