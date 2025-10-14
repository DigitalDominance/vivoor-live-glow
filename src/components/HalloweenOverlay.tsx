import { useState } from "react";
import kasperGhost from "@/assets/kasper-ghost.png";

export const HalloweenOverlay = () => {
  // Position ghosts, zombies, and cobwebs on left and right sides - randomly mixed
  const [ghosts] = useState(() => 
    Array.from({ length: 12 }, (_, i) => {
      const isLeft = Math.random() > 0.5;
      const characters = ['ghost', '🧟', '🕸️'];
      return {
        id: i,
        left: isLeft ? `${Math.random() * 20}%` : `${80 + Math.random() * 20}%`,
        delay: `${Math.random() * 2}s`,
        duration: `${6 + Math.random() * 4}s`,
        character: characters[Math.floor(Math.random() * characters.length)]
      };
    })
  );

  // Position pumpkins spread out across entire width
  const [pumpkins] = useState(() =>
    Array.from({ length: 6 }, (_, i) => {
      return {
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 90 + 5}%`,
        size: `${Math.random() * 30 + 30}px`,
        rotation: `${Math.random() * 30 - 15}deg`
      };
    })
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* White Smoke at bottom - left side */}
      <div 
        className="absolute bottom-0 left-0 w-1/3 h-64 opacity-60"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.3) 30%, transparent 70%)',
          filter: 'blur(30px)',
          animation: 'smoke-drift 8s ease-in-out infinite'
        }}
      />
      
      {/* White Smoke at bottom - right side */}
      <div 
        className="absolute bottom-0 right-0 w-1/3 h-64 opacity-60"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.3) 30%, transparent 70%)',
          filter: 'blur(30px)',
          animation: 'smoke-drift 8s ease-in-out infinite',
          animationDelay: '4s'
        }}
      />

      {/* White Smoke at middle - left side */}
      <div 
        className="absolute top-1/2 left-0 w-1/4 h-48 opacity-50"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.2) 40%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'smoke-drift 10s ease-in-out infinite',
          animationDelay: '2s'
        }}
      />

      {/* White Smoke at middle - right side */}
      <div 
        className="absolute top-1/2 right-0 w-1/4 h-48 opacity-50"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.2) 40%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'smoke-drift 10s ease-in-out infinite',
          animationDelay: '6s'
        }}
      />

      {/* White Smoke at top - left side */}
      <div 
        className="absolute top-0 left-0 w-1/4 h-56 opacity-45"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.2) 40%, transparent 70%)',
          filter: 'blur(35px)',
          animation: 'smoke-drift 12s ease-in-out infinite',
          animationDelay: '1s'
        }}
      />

      {/* White Smoke at top - right side */}
      <div 
        className="absolute top-0 right-0 w-1/4 h-56 opacity-45"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.2) 40%, transparent 70%)',
          filter: 'blur(35px)',
          animation: 'smoke-drift 12s ease-in-out infinite',
          animationDelay: '5s'
        }}
      />
      
      {/* Floating Ghosts, Zombies, and Cobwebs */}
      {ghosts.map((ghost) => (
        <div
          key={ghost.id}
          className="absolute opacity-30 hover:opacity-50 transition-opacity"
          style={{
            left: ghost.left,
            animation: `float-ghost ${ghost.duration} linear infinite`,
            animationDelay: ghost.delay,
            top: "-100px",
            width: ghost.character === 'ghost' ? '40px' : 'auto',
            fontSize: ghost.character !== 'ghost' ? '2rem' : undefined
          }}
        >
          {ghost.character === 'ghost' ? (
            <img src={kasperGhost} alt="ghost" className="w-full h-auto" />
          ) : (
            ghost.character
          )}
        </div>
      ))}

      {/* Floating Pumpkins */}
      {pumpkins.map((pumpkin, i) => (
        <div
          key={pumpkin.id}
          className="absolute opacity-35 hover:opacity-55 transition-opacity"
          style={{
            left: pumpkin.left,
            fontSize: pumpkin.size,
            animation: `float-pumpkin ${12 + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
            top: pumpkin.top
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
        
        @keyframes float-pumpkin {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-30px) rotate(5deg);
          }
          50% {
            transform: translateY(-15px) rotate(-5deg);
          }
          75% {
            transform: translateY(-40px) rotate(3deg);
          }
        }
        
        @keyframes smoke-drift {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0.6;
          }
          25% {
            transform: translateY(-40px) translateX(5px);
            opacity: 0.7;
          }
          50% {
            transform: translateY(-60px) translateX(10px);
            opacity: 0.5;
          }
          75% {
            transform: translateY(-40px) translateX(5px);
            opacity: 0.6;
          }
          100% {
            transform: translateY(0) translateX(0);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
};
