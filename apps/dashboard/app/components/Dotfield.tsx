'use client';

import { useEffect, useRef } from 'react';

export default function Dotfield({
  className = 'absolute inset-0 pointer-events-none z-0 opacity-90',
}: {
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const parent = canvas.parentElement;
    let width = (canvas.width = parent ? parent.clientWidth : window.innerWidth);
    let height = (canvas.height = parent ? parent.clientHeight : window.innerHeight);

    let mouseX = -1000;
    let mouseY = -1000;
    let targetMouseX = -1000;
    let targetMouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = e.clientX - rect.left;
      targetMouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      targetMouseX = -1000;
      targetMouseY = -1000;
    };

    const handleResize = () => {
      if (!canvas) return;
      const p = canvas.parentElement;
      width = canvas.width = p ? p.clientWidth : window.innerWidth;
      height = canvas.height = p ? p.clientHeight : window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    const spacing = 28;
    const baseDotSize = 1.2;
    const maxDistance = 140; // Interaction radius
    let time = 0;

    const render = () => {
      time += 0.015;

      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.1;
      mouseY += (targetMouseY - mouseY) * 0.1;

      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const originX = i * spacing;
          const originY = j * spacing;

          // Wave motion
          const sinVal = Math.sin(time + i * 0.15 + j * 0.15);
          let currentOpacity = 0.1 + (sinVal + 1) * 0.06; // 0.1 to 0.22 resting
          let currentSize = baseDotSize;

          let drawX = originX;
          let drawY = originY;

          // Calculate distance to cursor
          const dx = mouseX - originX;
          const dy = mouseY - originY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const factor = 1 - dist / maxDistance;

            // Subtle displacement away from cursor (nudge)
            const angle = Math.atan2(dy, dx);
            const pushDist = factor * 14;
            drawX -= Math.cos(angle) * pushDist;
            drawY -= Math.sin(angle) * pushDist;

            // Highlight opacity and size near cursor
            currentOpacity = Math.min(0.85, currentOpacity + factor * 0.65);
            currentSize = baseDotSize + factor * 1.4;

            // Draw subtle monochrome connector lines to cursor for super close dots
            if (dist < 75) {
              ctx.strokeStyle = `rgba(240, 240, 245, ${0.15 * factor})`;
              ctx.lineWidth = 0.75;
              ctx.beginPath();
              ctx.moveTo(drawX, drawY);
              ctx.lineTo(mouseX, mouseY);
              ctx.stroke();
            }
          }

          // Render dot
          ctx.fillStyle = `rgba(240, 240, 245, ${currentOpacity})`;
          ctx.beginPath();
          ctx.arc(drawX, drawY, currentSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
