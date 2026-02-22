import { Check, Loader2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ParseStep {
  key: string;
  label: string;
}

interface RecipeParseProgressProps {
  steps: ParseStep[];
  currentStep: string;
}

const RecipeParseProgress = ({ steps, currentStep }: RecipeParseProgressProps) => {
  const isDone = currentStep === "done";
  const currentIdx = isDone ? steps.length : steps.findIndex(s => s.key === currentStep);
  const progressPercent = isDone ? 100 : Math.round((currentIdx / steps.length) * 100);

  return (
    <div className="space-y-5 py-6">
      <Progress value={progressPercent} className="h-2" />
      <div className="space-y-3">
        {steps.map((step, stepIdx) => {
          const isComplete = stepIdx < currentIdx;
          const isActive = step.key === currentStep;

          return (
            <div key={step.key} className="flex items-center gap-3">
              {isComplete || isDone ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : isActive ? (
                <Loader2 className="h-5 w-5 animate-spin text-purple" />
              ) : (
                <Circle className="h-5 w-5 text-gray-300" />
              )}
              <span className={cn(
                "text-sm",
                (isComplete || isDone) && "text-green-700",
                isActive && !isDone && "text-foreground font-medium",
                !isComplete && !isActive && !isDone && "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {isDone && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Check className="h-6 w-6 text-green-500" />
          <span className="text-lg font-semibold text-green-700">Recipe Added!</span>
        </div>
      )}
    </div>
  );
};

export default RecipeParseProgress;
