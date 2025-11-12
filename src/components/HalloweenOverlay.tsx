import { useState } from "react";
import vivoorGhost from "@/assets/vivoor-ghost.png";
import { useHalloween } from "@/context/HalloweenContext";
import { VolumetricFog } from "./VolumetricFog";

export const HalloweenOverlay = () => {
  const { isHalloweenMode } = useHalloween();

  if (!isHalloweenMode) return null;
  // Position turkeys, leaves, and corn on left and right sides - more continuous
  const [fallingSides] = useState(() => 
    Array.from({ length: 8 }, (_, i) => {
      const isLeft = Math.random() > 0.5;
      const characters = ['🦃', '🍂', '🌽'];
      return {
        id: i,
        left: isLeft ? `${Math.random() * 20}%` : `${80 + Math.random() * 20}%`,
        delay: `${i * 1.5}s`,
        duration: `${8 + Math.random() * 4}s`,
        character: characters[Math.floor(Math.random() * characters.length)]
      };
    })
  );

  // Position pumpkin pies falling from top - only on sides, more continuous
  const [pies] = useState(() =>
    Array.from({ length: 4 }, (_, i) => {
      const isLeft = Math.random() > 0.5;
      return {
        id: i,
        left: isLeft ? `${Math.random() * 20}%` : `${80 + Math.random() * 20}%`,
        delay: `${i * 3}s`,
        duration: `${10 + Math.random() * 4}s`,
        size: `${Math.random() * 20 + 35}px`
      };
    })
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Volumetric Fog with Light Shafts */}
      <VolumetricFog />
      
      {/* Floating Turkeys, Leaves, and Corn */}
      {fallingSides.map((item) => (
        <div
          key={item.id}
          className="absolute opacity-30 hover:opacity-50 transition-opacity"
          style={{
            left: item.left,
            animation: `float-ghost ${item.duration} linear infinite`,
            animationDelay: item.delay,
            top: "-100px",
            fontSize: '2rem'
          }}
        >
          {item.character}
        </div>
      ))}

      {/* Floating Pumpkin Pies */}
      {pies.map((pie) => (
        <div
          key={pie.id}
          className="absolute opacity-35 hover:opacity-55 transition-opacity"
          style={{
            left: pie.left,
            fontSize: pie.size,
            animation: `float-ghost ${pie.duration} linear infinite`,
            animationDelay: pie.delay,
            top: "-100px"
          }}
        >
          🥧
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
