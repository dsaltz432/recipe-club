import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CookModeCompleteProps {
  recipeNames: Map<string, string>;
  onRate?: () => void;
  onClose: () => void;
}

const CookModeComplete = ({ recipeNames, onRate, onClose }: CookModeCompleteProps) => {
  useEffect(() => {
    // Fire confetti if canvas-confetti is available
    import("canvas-confetti").then((module) => {
      const confetti = module.default;
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });
    }).catch(() => {
      // canvas-confetti not available — skip silently
    });
  }, []);

  const names = Array.from(recipeNames.values());

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
      <CheckCircle2 className="h-20 w-20 text-green-400" aria-hidden="true" />
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-white">You did it!</h2>
        {names.length > 0 && (
          <p className="text-slate-400 text-sm">
            {names.join(" & ")}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {onRate && (
          <Button
            onClick={onRate}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white"
            aria-label="Rate this recipe"
          >
            Rate This Recipe
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onClose}
          className="w-full border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
          aria-label="Close cook mode"
        >
          Close
        </Button>
      </div>
    </div>
  );
};

export default CookModeComplete;
