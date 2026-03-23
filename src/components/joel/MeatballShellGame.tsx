import { useState, useEffect } from "react";

type Phase = "ready" | "shuffling" | "pick" | "reveal";

const BOWL_SIZE = 90;
const BOWL_GAP = 20;
const SLOT_WIDTH = BOWL_SIZE + BOWL_GAP;

export function MeatballShellGame() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [slots, setSlots] = useState([0, 1, 2, 3]); // slots[i] = bowlId at visual position i
  const [meatballBowl, setMeatballBowl] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [peekBowl, setPeekBowl] = useState<number | null>(null);
  const [userPickBowl, setUserPickBowl] = useState<number | null>(null);

  const startGame = () => {
    const randomBowl = Math.floor(Math.random() * 4);
    setMeatballBowl(randomBowl);
    setSlots([0, 1, 2, 3]);
    setPhase("shuffling");
    setTimeLeft(10);
    setPeekBowl(null);
    setUserPickBowl(null);
  };

  // Countdown
  useEffect(() => {
    if (phase !== "shuffling") return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase("pick");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Swap two random bowl positions every 650ms
  useEffect(() => {
    if (phase !== "shuffling") return;
    const shuffler = setInterval(() => {
      setSlots((prev) => {
        const next = [...prev];
        const i = Math.floor(Math.random() * 4);
        let j = Math.floor(Math.random() * 3);
        if (j >= i) j++;
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    }, 380);
    return () => clearInterval(shuffler);
  }, [phase]);

  // Peek: briefly reveal the meatball bowl twice (at 2s and 6s)
  useEffect(() => {
    if (phase !== "shuffling") return;
    const doPeek = () => {
      setPeekBowl(meatballBowl);
      setTimeout(() => setPeekBowl(null), 700);
    };
    const first = setTimeout(doPeek, 2000);
    const second = setTimeout(doPeek, 6000);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [phase, meatballBowl]);

  const pickBowl = (bowlId: number) => {
    if (phase !== "pick") return;
    setUserPickBowl(bowlId);
    setPhase("reveal");
  };

  const won = userPickBowl === meatballBowl;
  const containerWidth = 4 * SLOT_WIDTH - BOWL_GAP;

  return (
    <>
      <style>{`
        @keyframes meatball-shuffle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-5px) rotate(-4deg); }
          70% { transform: translateY(-5px) rotate(4deg); }
        }
        @keyframes meatball-peek {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
      `}</style>

      <div style={{ textAlign: "center" }}>
        {phase === "ready" && (
          <>
            <p style={{ marginBottom: "1rem", fontSize: "0.82rem", opacity: 0.75, lineHeight: 1.5 }}>
              One bowl hides the meatball 🥩<br />
              It'll peek out to give you hints — then you have 10 seconds to pick!
            </p>
            <button
              onClick={startGame}
              style={{
                background: "rgba(255,255,255,0.9)",
                color: "#1a1a2e",
                border: "none",
                borderRadius: "9999px",
                padding: "0.5rem 1.25rem",
                fontWeight: 800,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              🥩 Start Game
            </button>
          </>
        )}

        {phase !== "ready" && (
          <>
            <div style={{ marginBottom: "0.6rem", minHeight: "1.8rem" }}>
              {phase === "shuffling" && (
                <span style={{ fontSize: "1.2rem", fontWeight: 900 }}>⏱️ {timeLeft}s</span>
              )}
              {phase === "pick" && (
                <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>
                  🤔 Which bowl has the meatball?
                </span>
              )}
              {phase === "reveal" && (
                <span style={{ fontSize: "1.2rem", fontWeight: 900 }}>
                  {won ? "✅ You found it!" : "❌ Wrong bowl!"}
                </span>
              )}
            </div>

            <div
              style={{
                position: "relative",
                width: containerWidth,
                height: BOWL_SIZE + 24,
                margin: "0.5rem auto 0.75rem",
              }}
            >
              {[0, 1, 2, 3].map((bowlId) => {
                const slot = slots.indexOf(bowlId);
                const x = slot * SLOT_WIDTH;
                const isPeeking = peekBowl === bowlId;
                const isUserPick = phase === "reveal" && userPickBowl === bowlId;
                const isMeatball = bowlId === meatballBowl;
                const showMeatball = isPeeking || (phase === "reveal" && isMeatball);

                return (
                  <div
                    key={bowlId}
                    onClick={() => pickBowl(bowlId)}
                    style={{
                      position: "absolute",
                      left: x,
                      top: 0,
                      width: BOWL_SIZE,
                      height: BOWL_SIZE + 24,
                      transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      cursor: phase === "pick" ? "pointer" : "default",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      borderRadius: 12,
                      background: isUserPick
                        ? won
                          ? "rgba(100,255,100,0.2)"
                          : "rgba(255,80,80,0.2)"
                        : phase === "reveal" && isMeatball && !isUserPick
                        ? "rgba(255,255,150,0.25)"
                        : phase === "pick"
                        ? "rgba(255,255,255,0.08)"
                        : "transparent",
                      border: isUserPick
                        ? `2px solid ${won ? "rgba(100,255,100,0.7)" : "rgba(255,80,80,0.7)"}`
                        : phase === "pick"
                        ? "2px solid rgba(255,255,255,0.2)"
                        : "2px solid transparent",
                      animation:
                        phase === "shuffling"
                          ? isPeeking
                            ? "meatball-peek 0.35s ease"
                            : "meatball-shuffle 0.65s ease infinite"
                          : "none",
                    }}
                  >
                    <span style={{ fontSize: "2.8rem", lineHeight: 1 }}>🍝</span>
                    <img
                      src="/meatball.png"
                      alt="meatball"
                      style={{
                        width: "1.8rem",
                        height: "1.8rem",
                        opacity: showMeatball ? 1 : 0,
                        transition: "opacity 0.15s",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {phase === "reveal" && (
              <button
                onClick={startGame}
                style={{
                  background: "rgba(255,255,255,0.9)",
                  color: "#1a1a2e",
                  border: "none",
                  borderRadius: "9999px",
                  padding: "0.4rem 1rem",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                🔄 Play Again
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
