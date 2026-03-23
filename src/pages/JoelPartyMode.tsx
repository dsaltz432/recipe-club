import { useState, useEffect, useRef } from "react";
import { ChefHatCursor } from "@/components/joel/ChefHatCursor";
import { ConfettiRain } from "@/components/joel/ConfettiRain";
import { IngredientClicker } from "@/components/joel/IngredientClicker";
import { RecipeRoulette } from "@/components/joel/RecipeRoulette";
import { FoodCrossword } from "@/components/joel/FoodCrossword";
import { MeatballShellGame } from "@/components/joel/MeatballShellGame";

const SONGS = [
  "/songs/Abballati.mp3",
  "/songs/Louis Prima - Che La Luna (Official Lyric Video).mp3",
  "/songs/Patrizio Buanne - That's Amore.mp3",
  "/songs/La Casa De Papel - Bella Ciao [Lyrics] (Money Heist).mp3",
];

const COLOR_THEMES = [
  { bg: "#FF6B6B", text: "#1a1a2e", card: "rgba(255,255,255,0.22)" },
  { bg: "#4ECDC4", text: "#1a1a2e", card: "rgba(0,0,0,0.15)" },
  { bg: "#667EEA", text: "#ffffff", card: "rgba(255,255,255,0.18)" },
  { bg: "#F7971E", text: "#1a1a2e", card: "rgba(0,0,0,0.15)" },
  { bg: "#A8E6CF", text: "#1a1a2e", card: "rgba(0,0,0,0.13)" },
  { bg: "#FF9A9E", text: "#1a1a2e", card: "rgba(255,255,255,0.25)" },
  { bg: "#00B09B", text: "#ffffff", card: "rgba(255,255,255,0.2)" },
  { bg: "#FCE38A", text: "#1a1a2e", card: "rgba(0,0,0,0.14)" },
  { bg: "#764BA2", text: "#ffffff", card: "rgba(255,255,255,0.18)" },
  { bg: "#f953c6", text: "#ffffff", card: "rgba(255,255,255,0.2)" },
];

const LEADERBOARD = [
  { rank: "🥇", name: "Joel (The GOAT)", score: "999,999", note: "obv" },
  { rank: "🥈", name: "The Other Joel", score: "47", note: "close" },
  { rank: "🥉", name: "A Golden Retriever", score: "23", note: "good boy" },
  { rank: "4.", name: "The Toaster", score: "8", note: "suspicious" },
  { rank: "5.", name: "This Recipe App", score: "2", note: "trying its best" },
];

function ToggleButton({
  active,
  onClick,
  children,
  cardBg,
  textColor,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  cardBg: string;
  textColor: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(255,255,255,0.9)" : cardBg,
        color: active ? "#1a1a2e" : textColor,
        border: `2px solid ${active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)"}`,
        borderRadius: "9999px",
        padding: "0.4rem 1rem",
        fontWeight: 700,
        fontSize: "0.85rem",
        cursor: "pointer",
        transition: "all 0.2s ease",
        opacity: active ? 1 : 0.75,
      }}
    >
      {children}
    </button>
  );
}

export default function JoelPartyMode() {
  const [confetti, setConfetti] = useState(true);
  const [chefHat, setChefHat] = useState(true);
  const [colorCycle, setColorCycle] = useState(true);
  const [themeIndex, setThemeIndex] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [songIndex, setSongIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const theme = COLOR_THEMES[themeIndex];

  useEffect(() => {
    if (!colorCycle) return;
    const interval = setInterval(() => {
      setThemeIndex((i) => (i + 1) % COLOR_THEMES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [colorCycle]);

  // Auto-start on first user interaction (browsers block autoplay before that)
  useEffect(() => {
    const startOnFirstInteraction = () => {
      if (!audioRef.current) return;
      audioRef.current.play().catch(() => {});
      setMusicPlaying(true);
      window.removeEventListener("click", startOnFirstInteraction);
      window.removeEventListener("keydown", startOnFirstInteraction);
      window.removeEventListener("touchstart", startOnFirstInteraction);
    };
    window.addEventListener("click", startOnFirstInteraction);
    window.addEventListener("keydown", startOnFirstInteraction);
    window.addEventListener("touchstart", startOnFirstInteraction);
    return () => {
      window.removeEventListener("click", startOnFirstInteraction);
      window.removeEventListener("keydown", startOnFirstInteraction);
      window.removeEventListener("touchstart", startOnFirstInteraction);
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.src = SONGS[songIndex];
    if (musicPlaying) {
      audioRef.current.play().catch(() => {});
    }
  }, [songIndex]);

  const changeMusic = () => {
    setSongIndex((i) => (i + 1) % SONGS.length);
    if (!musicPlaying) {
      setMusicPlaying(true);
      audioRef.current?.play().catch(() => {});
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        transition: "background 1.2s ease, color 0.6s ease",
        fontFamily: "'Playfair Display', serif",
      }}
    >
      {confetti && <ConfettiRain />}
      {chefHat && <ChefHatCursor />}
      <audio ref={audioRef} src={SONGS[0]} loop />

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div style={{ fontSize: "3rem", lineHeight: 1.1, marginBottom: "0.25rem" }}>
            🎉🎉🎉
          </div>
          <h1
            style={{
              fontSize: "clamp(2rem, 8vw, 3.5rem)",
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            JOEL'S PARTY ZONE
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "1rem",
              opacity: 0.75,
              fontStyle: "italic",
            }}
          >
            welcome, friend 🫶
          </p>
        </div>

        {/* Chaos controls */}
        <div
          className="rounded-2xl p-4 mb-6 text-center"
          style={{ background: theme.card, backdropFilter: "blur(4px)" }}
        >
          <div className="font-bold mb-3 text-sm uppercase tracking-widest opacity-70">
            Chaos Controls
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <ToggleButton
              active={confetti}
              onClick={() => setConfetti((v) => !v)}
              cardBg={theme.card}
              textColor={theme.text}
            >
              {confetti ? "🎊 Confetti ON" : "🎊 Confetti OFF"}
            </ToggleButton>
            <ToggleButton
              active={chefHat}
              onClick={() => setChefHat((v) => !v)}
              cardBg={theme.card}
              textColor={theme.text}
            >
              {chefHat ? "👨‍🍳 Chef Hat ON" : "👨‍🍳 Chef Hat OFF"}
            </ToggleButton>
            <ToggleButton
              active={colorCycle}
              onClick={() => setColorCycle((v) => !v)}
              cardBg={theme.card}
              textColor={theme.text}
            >
              {colorCycle ? "🌈 Colors ON" : "🌈 Colors OFF"}
            </ToggleButton>
            <ToggleButton
              active={true}
              onClick={changeMusic}
              cardBg={theme.card}
              textColor={theme.text}
            >
              🎵 Music OFF
            </ToggleButton>
          </div>
        </div>

        {/* Mini Games */}
        <h2
          className="font-black mb-3"
          style={{ fontSize: "1.4rem", letterSpacing: "-0.01em" }}
        >
          🕹️ Mini Games
        </h2>
        <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2">
          {/* Ingredient Clicker */}
          <div
            className="rounded-2xl p-4"
            style={{ background: theme.card }}
          >
            <div className="font-black text-base mb-3">🍽️ Ingredient Clicker</div>
            <IngredientClicker />
          </div>

          {/* Recipe Roulette */}
          <div
            className="rounded-2xl p-4"
            style={{ background: theme.card }}
          >
            <div className="font-black text-base mb-3">🎲 Recipe Roulette</div>
            <RecipeRoulette />
          </div>

          {/* Meatball Shell Game */}
          <div
            className="rounded-2xl p-4 sm:col-span-2"
            style={{ background: theme.card }}
          >
            <div className="font-black text-base mb-3">🍝 Find the Meatball</div>
            <MeatballShellGame />
          </div>
        </div>

        {/* Crossword */}
        <h2
          className="font-black mb-3"
          style={{ fontSize: "1.4rem", letterSpacing: "-0.01em" }}
        >
          📰 Food Crossword
        </h2>
        <div
          className="rounded-2xl p-4 mb-6"
          style={{ background: theme.card }}
        >
          <FoodCrossword />
        </div>

        {/* Leaderboard */}
        <h2
          className="font-black mb-3"
          style={{ fontSize: "1.4rem", letterSpacing: "-0.01em" }}
        >
          🏆 All-Time Leaderboard
        </h2>
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ background: theme.card }}
        >
          {LEADERBOARD.map((entry, i) => (
            <div
              key={entry.name}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderBottom:
                  i < LEADERBOARD.length - 1
                    ? `1px solid rgba(0,0,0,0.1)`
                    : undefined,
              }}
            >
              <span style={{ fontSize: "1.1rem", minWidth: "2rem" }}>{entry.rank}</span>
              <span className="font-bold flex-1">{entry.name}</span>
              <span className="font-black tabular-nums">{entry.score}</span>
              <span className="text-xs opacity-50 italic">{entry.note}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-sm" style={{ opacity: 0.5 }}>
          made with ❤️ for joel · recipe club party edition
        </div>
      </div>
    </div>
  );
}
