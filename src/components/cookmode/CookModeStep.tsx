import { Scissors, Flame, Timer, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CookModeStep as CookModeStepType } from "@/types";
import type { RecipeColor } from "@/lib/cookModeColors";

interface CookModeStepProps {
  step: CookModeStepType;
  color: RecipeColor;
  isActive?: boolean;
}

const CATEGORY_ICONS = {
  prep: Scissors,
  active: Flame,
  passive: Timer,
  finish: CheckCircle2,
} as const;

const CookModeStep = ({ step, color, isActive = false }: CookModeStepProps) => {
  const CategoryIcon = step.category ? CATEGORY_ICONS[step.category] : null;

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 sm:p-5 transition-all",
        color.border,
        isActive ? color.bg : "bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        {CategoryIcon && (
          <div className={cn("flex-shrink-0 mt-0.5", color.text)}>
            <CategoryIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2",
              color.bg,
              color.text
            )}
          >
            {step.recipeName}
          </span>
          <p className="text-lg sm:text-xl leading-relaxed text-foreground">
            {step.instruction}
          </p>
          {step.timing && (
            <p className={cn("mt-2 text-sm font-medium", color.text)}>
              {step.timing}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookModeStep;
