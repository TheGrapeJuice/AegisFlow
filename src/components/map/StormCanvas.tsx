import { useEffect, useRef } from 'react';

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

interface StormCanvasProps {
  stormActive: boolean;
  width: number;
  height: number;
}

const PARTICLE_COUNT = 150;
const WIND_ANGLE = 0.35; // radians from vertical (~20°)
const BASE_SPEED = 7;

function createDrop(width: number, height: number): RainDrop {
  return {
    x: Math.random() * (width + 100) - 50,
    y: Math.random() * height - height,
    speed: BASE_SPEED + Math.random() * 4,
    length: 12 + Math.random() * 8,
    opacity: 0.2 + Math.random() * 0.5,
  };
}

export function StormCanvas({ stormActive, width, height }: StormCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<RainDrop[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!stormActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // Initialize drops
    dropsRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createDrop(canvas.width, canvas.height)
    );

    const dx = Math.sin(WIND_ANGLE); // x-component of fall direction
    const dy = Math.cos(WIND_ANGLE); // y-component of fall direction

    function tick() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.strokeStyle = '#a8c8e8';
      ctx.lineWidth = 1;

      for (const drop of dropsRef.current) {
        ctx.globalAlpha = drop.opacity;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(
          drop.x + dx * drop.length,
          drop.y + dy * drop.length
        );
        ctx.stroke();

        // Move drop
        drop.x += dx * drop.speed;
        drop.y += dy * drop.speed;

        // Reset if off screen
        if (drop.y > canvas.height + 20 || drop.x > canvas.width + 50) {
          drop.x = Math.random() * canvas.width - 50;
          drop.y = -drop.length;
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [stormActive]);

  if (!stormActive) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
}
