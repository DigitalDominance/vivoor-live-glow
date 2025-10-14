import { useEffect, useRef } from 'react';

export const VolumetricFog = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Light shaft particles - reduced and more diffuse on sides
    const lightShafts: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      opacity: number;
      speed: number;
      angle: number;
    }> = [];

    // Create light shafts on sides - fewer and wider for softer effect
    for (let i = 0; i < 6; i++) {
      const isLeft = Math.random() > 0.5;
      lightShafts.push({
        x: isLeft ? Math.random() * 180 : window.innerWidth - Math.random() * 180,
        y: -Math.random() * 300,
        width: 150 + Math.random() * 100,
        height: window.innerHeight + 300,
        opacity: 0.04 + Math.random() * 0.04,
        speed: 0.3 + Math.random() * 0.4,
        angle: (Math.random() - 0.5) * 20,
      });
    }

    // Fog particles - focused more on center
    const fogParticles: Array<{
      x: number;
      y: number;
      size: number;
      opacity: number;
      speedX: number;
      speedY: number;
    }> = [];

    for (let i = 0; i < 60; i++) {
      fogParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: 150 + Math.random() * 250,
        opacity: 0.05 + Math.random() * 0.06,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: 0.4 + Math.random() * 0.6,
      });
    }

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw light shafts with more blur
      lightShafts.forEach((shaft) => {
        ctx.save();
        ctx.translate(shaft.x, shaft.y);
        ctx.rotate((shaft.angle * Math.PI) / 180);

        // Create gradient for light shaft with softer edges
        const gradient = ctx.createLinearGradient(0, 0, 0, shaft.height);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${shaft.opacity * 0.3})`);
        gradient.addColorStop(0.2, `rgba(255, 255, 255, ${shaft.opacity * 0.6})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, ${shaft.opacity * 0.4})`);
        gradient.addColorStop(0.8, `rgba(255, 255, 255, ${shaft.opacity * 0.2})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        // Add radial gradient for softer horizontal edges
        const radialGradient = ctx.createRadialGradient(
          0, shaft.height / 2, 0,
          0, shaft.height / 2, shaft.width / 2
        );
        radialGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        radialGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.5)');
        radialGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.globalAlpha = shaft.opacity;
        ctx.fillStyle = gradient;
        ctx.fillRect(-shaft.width / 2, 0, shaft.width, shaft.height);
        ctx.restore();

        // Animate light shaft
        shaft.y += shaft.speed;
        if (shaft.y > window.innerHeight + 100) {
          shaft.y = -300;
        }

        // Pulse opacity
        shaft.opacity = 0.04 + Math.sin(Date.now() * 0.001 + shaft.x) * 0.02;
      });

      // Draw fog particles
      fogParticles.forEach((particle) => {
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${particle.opacity})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, ${particle.opacity * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(
          particle.x - particle.size,
          particle.y - particle.size,
          particle.size * 2,
          particle.size * 2
        );

        // Animate fog particle
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Wrap around
        if (particle.y > window.innerHeight + particle.size) {
          particle.y = -particle.size;
          particle.x = Math.random() * window.innerWidth;
        }
        if (particle.x < -particle.size) particle.x = window.innerWidth + particle.size;
        if (particle.x > window.innerWidth + particle.size) particle.x = -particle.size;
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ opacity: 0.25, filter: 'blur(1px)' }}
    />
  );
};
