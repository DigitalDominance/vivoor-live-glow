import { useState } from "react";
import kasperGhost from "@/assets/kasper-ghost.png";
import { useHalloween } from "@/context/HalloweenContext";

export const HalloweenOverlay = () => {
  const { isHalloweenMode } = useHalloween();

  if (!isHalloweenMode) return null;
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

  // Position pumpkins falling from top
  const [pumpkins] = useState(() =>
    Array.from({ length: 6 }, (_, i) => {
      return {
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 3}s`,
        duration: `${8 + Math.random() * 4}s`,
        size: `${Math.random() * 20 + 35}px`
      };
    })
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Flowing Smoke Particles - Left Side */}
      <div 
        className="absolute top-0 left-[3%] w-3 h-full opacity-70"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%)',
          filter: 'blur(20px)',
          animation: 'smoke-flow-up 6s linear infinite'
        }}
      />
      <div 
        className="absolute top-0 left-[8%] w-4 h-full opacity-65"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
          filter: 'blur(25px)',
          animation: 'smoke-flow-up 8s linear infinite',
          animationDelay: '2s'
        }}
      />
      <div 
        className="absolute top-0 left-[13%] w-3 h-full opacity-60"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
          filter: 'blur(22px)',
          animation: 'smoke-flow-up 7s linear infinite',
          animationDelay: '4s'
        }}
      />
      <div 
        className="absolute top-0 left-[5%] w-2 h-full opacity-55"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
          filter: 'blur(18px)',
          animation: 'smoke-flow-up 9s linear infinite',
          animationDelay: '1s'
        }}
      />
      <div 
        className="absolute top-0 left-[11%] w-3 h-full opacity-65"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%)',
          filter: 'blur(23px)',
          animation: 'smoke-flow-up 7.5s linear infinite',
          animationDelay: '3.5s'
        }}
      />

      {/* Flowing Smoke Particles - Right Side */}
      <div 
        className="absolute top-0 right-[3%] w-3 h-full opacity-70"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%)',
          filter: 'blur(20px)',
          animation: 'smoke-flow-up 6s linear infinite',
          animationDelay: '1s'
        }}
      />
      <div 
        className="absolute top-0 right-[8%] w-4 h-full opacity-65"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
          filter: 'blur(25px)',
          animation: 'smoke-flow-up 8s linear infinite',
          animationDelay: '3s'
        }}
      />
      <div 
        className="absolute top-0 right-[13%] w-3 h-full opacity-60"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
          filter: 'blur(22px)',
          animation: 'smoke-flow-up 7s linear infinite',
          animationDelay: '5s'
        }}
      />
      <div 
        className="absolute top-0 right-[5%] w-2 h-full opacity-55"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
          filter: 'blur(18px)',
          animation: 'smoke-flow-up 9s linear infinite',
          animationDelay: '2.5s'
        }}
      />
      <div 
        className="absolute top-0 right-[11%] w-3 h-full opacity-65"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%)',
          filter: 'blur(23px)',
          animation: 'smoke-flow-up 7.5s linear infinite',
          animationDelay: '4.5s'
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
      {pumpkins.map((pumpkin) => (
        <div
          key={pumpkin.id}
          className="absolute opacity-35 hover:opacity-55 transition-opacity"
          style={{
            left: pumpkin.left,
            fontSize: pumpkin.size,
            animation: `float-ghost ${pumpkin.duration} linear infinite`,
            animationDelay: pumpkin.delay,
            top: "-100px"
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
        
        @keyframes smoke-flow-up {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(100vh) translateX(30px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
