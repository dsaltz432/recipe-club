import { useEffect } from "react";
import confetti from "canvas-confetti";

const COLORS = ["#9b87f5", "#F97316", "#4CAF50", "#3B82F6", "#EC4899", "#FFE66D", "#FF6B6B"];

export function ConfettiRain() {
  useEffect(() => {
    const interval = setInterval(() => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.5 },
        colors: COLORS,
        gravity: 0.8,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.5 },
        colors: COLORS,
        gravity: 0.8,
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return null;
}
