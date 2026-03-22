import { useState } from "react";

const DISASTERS = [
  {
    title: "Chaos Casserole",
    desc: "Peanut butter + cold pizza + sriracha + mystery sauce. Bake at 420°F until chaos ensues.",
  },
  {
    title: "Joel's Surprise Soup",
    desc: "Hot sauce + ice cream + raw broccoli + tears. Simmer until questionable. Serves 0.",
  },
  {
    title: "Everything Bagel Stir-Fry",
    desc: "5 bagels + soy sauce + marshmallows. Stir very frantically for 2 minutes. Regret immediately.",
  },
  {
    title: "Midnight Fridge Raid Pasta",
    desc: "Whatever's in the fridge + cream cheese + that hot sauce from 2019. Boil aggressively.",
  },
  {
    title: "Deconstructed Sandwich",
    desc: "All sandwich ingredients placed separately on a plate. Present confidently. Charge restaurant prices.",
  },
  {
    title: "Cereal Curry",
    desc: "Frosted Flakes + curry powder + coconut milk. They said it couldn't be done. They were right.",
  },
  {
    title: "The 'I Forgot To Shop' Scramble",
    desc: "3 mystery condiments + 1 egg + the first spice that falls out. Season with despair.",
  },
  {
    title: "Artisanal Sadness Bowl",
    desc: "Leftover takeout + shredded parmesan + a single herb. Serve lukewarm with a straight face.",
  },
  {
    title: "The Reverse Sandwich",
    desc: "Bread on the inside. Fillings on the outside. No explanation given. No questions taken.",
  },
  {
    title: "Truffle-Infused Instant Ramen",
    desc: "Instant ramen + 1 drop truffle oil + caviar you definitely have. Call it fine dining.",
  },
];

export function RecipeRoulette() {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<(typeof DISASTERS)[number] | null>(null);
  const [rotation, setRotation] = useState(0);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const newRotation = rotation + 900 + Math.floor(Math.random() * 540);
    setRotation(newRotation);
    setTimeout(() => {
      setResult(DISASTERS[Math.floor(Math.random() * DISASTERS.length)]);
      setSpinning(false);
    }, 1400);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-sm font-bold opacity-70 text-center">
        Spin for tonight's dinner disaster
      </div>
      <button
        onClick={spin}
        disabled={spinning}
        aria-label="Spin for a recipe"
        style={{
          fontSize: "3.5rem",
          background: "none",
          border: "none",
          cursor: spinning ? "wait" : "pointer",
          display: "block",
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? "transform 1.4s cubic-bezier(0.17, 0.67, 0.08, 1.0)"
            : "none",
          lineHeight: 1,
          padding: "0.5rem",
        }}
      >
        🎲
      </button>
      <p className="text-sm opacity-60 font-medium -mt-1">
        {spinning ? "Deciding your fate..." : "Click to spin!"}
      </p>

      {result && !spinning && (
        <div
          className="rounded-2xl p-4 text-center w-full"
          style={{ background: "rgba(0,0,0,0.2)" }}
        >
          <div className="font-black text-base mb-1">🍳 {result.title}</div>
          <div className="text-sm opacity-85 leading-snug">{result.desc}</div>
        </div>
      )}
    </div>
  );
}
