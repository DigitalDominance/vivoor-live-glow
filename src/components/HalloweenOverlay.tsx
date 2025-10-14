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
      
      {/* Floating Ghosts and Zombies */}
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
          {ghost.id % 2 === 0 ? '👻' : '🧟'}
        </div>
      ))}

      {/* Floating Pumpkins */}
      {pumpkins.map((pumpkin, i) => (
        <div
          key={pumpkin.id}
          className="absolute opacity-60 hover:opacity-90 transition-opacity"
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
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
};
