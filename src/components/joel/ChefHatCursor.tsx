import { useEffect, useRef, useState } from "react";

export function ChefHatCursor() {
  const targetRef = useRef({ x: -100, y: -100 });
  const posRef = useRef({ x: -100, y: -100 });
  const [displayPos, setDisplayPos] = useState({ x: -100, y: -100 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMove);

    let animId: number;
    const animate = () => {
      posRef.current = {
        x: posRef.current.x + (targetRef.current.x - posRef.current.x) * 0.1,
        y: posRef.current.y + (targetRef.current.y - posRef.current.y) * 0.1,
      };
      setDisplayPos({ x: posRef.current.x, y: posRef.current.y });
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: displayPos.x + 12,
        top: displayPos.y - 32,
        pointerEvents: "none",
        fontSize: "2rem",
        zIndex: 9999,
        userSelect: "none",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
      }}
    >
      👨‍🍳
    </div>
  );
}
