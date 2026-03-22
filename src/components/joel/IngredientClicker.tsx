import { useState, useEffect, useRef, useCallback } from "react";

const INGREDIENTS = [
  { emoji: "🍕", name: "Pizza", points: 10 },
  { emoji: "🌮", name: "Taco", points: 15 },
  { emoji: "🍔", name: "Burger", points: 10 },
  { emoji: "🍣", name: "Sushi", points: 25 },
  { emoji: "🍜", name: "Ramen", points: 15 },
  { emoji: "🥑", name: "Avocado", points: 5 },
  { emoji: "🧀", name: "Cheese", points: 8 },
  { emoji: "🍗", name: "Chicken", points: 12 },
  { emoji: "🦞", name: "Lobster", points: 50 },
  { emoji: "🌶️", name: "Chili", points: 20 },
  { emoji: "🥦", name: "Broccoli", points: 3 },
  { emoji: "🍰", name: "Cake", points: 20 },
  { emoji: "🥚", name: "Egg", points: 7 },
  { emoji: "🍓", name: "Berry", points: 8 },
];

const GAME_DURATION = 10;
const SPAWN_INTERVAL_MS = 550;
const ITEM_LIFETIME_MS = 1800;

interface ActiveItem {
  id: number;
  ingredient: (typeof INGREDIENTS)[number];
  x: number;
  y: number;
  expiresAt: number;
}

export function IngredientClicker() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(
    () => parseInt(localStorage.getItem("joel-clicker-hs") || "0")
  );
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [items, setItems] = useState<ActiveItem[]>([]);
  const [popText, setPopText] = useState<string | null>(null);
  const [isNewHigh, setIsNewHigh] = useState(false);
  const nextId = useRef(0);
  const scoreRef = useRef(0);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setItems([]);
    setIsNewHigh(false);
    setPhase("playing");
  }, []);

  // Spawn items
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      const ingredient = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
      const newItem: ActiveItem = {
        id: nextId.current++,
        ingredient,
        x: Math.random() * 78 + 4,
        y: Math.random() * 62 + 8,
        expiresAt: Date.now() + ITEM_LIFETIME_MS,
      };
      setItems((prev) => [...prev, newItem]);
    }, SPAWN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase]);

  // Expire items
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setItems((prev) => prev.filter((item) => item.expiresAt > Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  // Countdown
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase("done");
          setItems([]);
          const finalScore = scoreRef.current;
          const prevHigh = parseInt(localStorage.getItem("joel-clicker-hs") || "0");
          if (finalScore > prevHigh) {
            localStorage.setItem("joel-clicker-hs", finalScore.toString());
            setHighScore(finalScore);
            setIsNewHigh(true);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleClick = useCallback((item: ActiveItem, e: React.MouseEvent) => {
    e.stopPropagation();
    scoreRef.current += item.ingredient.points;
    setScore(scoreRef.current);
    setPopText(`+${item.ingredient.points}`);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setTimeout(() => setPopText(null), 600);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-bold opacity-80">
        <span>🏆 Best: {highScore}</span>
        {phase === "playing" && (
          <span className="text-base">
            ⏱️ {timeLeft}s · {score} pts
          </span>
        )}
      </div>

      <div
        className="relative rounded-2xl overflow-hidden select-none"
        style={{ height: 210, background: "rgba(0,0,0,0.18)" }}
      >
        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="text-lg font-black opacity-80">Click the food before it disappears!</div>
            <button
              onClick={startGame}
              className="px-6 py-2 rounded-full font-black text-base"
              style={{ background: "rgba(255,255,255,0.92)", color: "#1a1a2e" }}
            >
              🍽️ Start!
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="text-2xl font-black">
              {isNewHigh ? "🎉 NEW HIGH SCORE!" : "⏰ Time's Up!"}
            </div>
            <div className="text-xl font-bold">{score} pts</div>
            <button
              onClick={startGame}
              className="px-5 py-2 rounded-full font-bold"
              style={{ background: "rgba(255,255,255,0.92)", color: "#1a1a2e" }}
            >
              Again!
            </button>
          </div>
        )}

        {phase === "playing" &&
          items.map((item) => {
            const ratio = (item.expiresAt - Date.now()) / ITEM_LIFETIME_MS;
            return (
              <button
                key={item.id}
                onClick={(e) => handleClick(item, e)}
                title={item.ingredient.name}
                style={{
                  position: "absolute",
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: "2rem",
                  opacity: Math.max(0.25, ratio),
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                {item.ingredient.emoji}
              </button>
            );
          })}

        {popText && (
          <div
            className="absolute top-2 left-1/2 font-black text-lg pointer-events-none"
            style={{
              transform: "translateX(-50%)",
              color: "#FFE66D",
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}
          >
            {popText}
          </div>
        )}
      </div>
    </div>
  );
}
