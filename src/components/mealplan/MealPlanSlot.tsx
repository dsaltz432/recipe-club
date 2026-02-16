import { Button } from "@/components/ui/button";
import { Plus, X, ExternalLink } from "lucide-react";
import type { MealPlanItem } from "@/types";

interface MealPlanSlotProps {
  item?: MealPlanItem;
  dayOfWeek: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  onAddMeal: (dayOfWeek: number, mealType: string) => void;
  onRemoveMeal: (itemId: string) => void;
}

const mealTypeLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const MealPlanSlot = ({
  item,
  dayOfWeek,
  mealType,
  onAddMeal,
  onRemoveMeal,
}: MealPlanSlotProps) => {
  if (!item) {
    return (
      <Button
        variant="ghost"
        className="w-full h-full min-h-[60px] border border-dashed border-gray-200 text-muted-foreground hover:border-purple/50 hover:text-purple"
        onClick={() => onAddMeal(dayOfWeek, mealType)}
      >
        <Plus className="h-3 w-3 mr-1" />
        <span className="text-xs">{mealTypeLabels[mealType]}</span>
      </Button>
    );
  }

  const name = item.recipeName || item.customName || "Unnamed meal";
  const url = item.recipeUrl || item.customUrl;

  return (
    <div className="relative group w-full min-h-[60px] p-2 bg-purple/5 rounded-lg border border-purple/20">
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{name}</p>
          <span className="text-[10px] text-muted-foreground">{mealTypeLabels[mealType]}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-purple">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            onClick={() => onRemoveMeal(item.id)}
            className="text-muted-foreground hover:text-red-500"
            title="Remove meal"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MealPlanSlot;
