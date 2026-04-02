import { ChefHat, ExternalLink, Plus, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { MealPlanItem } from "@/types";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface MealSlotActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MealPlanItem[];
  dayOfWeek: number;
  mealType: string;
  onRemoveItem: (itemId: string) => void;
  onMarkCooked: () => void;
  onUndoCooked: () => void;
  onViewDetails: () => void;
  onAddMeal: () => void;
}

const MealSlotActionsDialog = ({
  open,
  onOpenChange,
  items,
  dayOfWeek,
  mealType,
  onRemoveItem,
  onMarkCooked,
  onUndoCooked,
  onViewDetails,
  onAddMeal,
}: MealSlotActionsDialogProps) => {
  const isAllCooked = items.length > 0 && items.every((i) => i.cookedAt);
  const mealTypeLabel = MEAL_TYPE_LABELS[mealType] ?? mealType;
  const mealCount = items.length;

  const handleAddMeal = () => {
    onOpenChange(false);
    onAddMeal();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle className="font-display text-base">
            {DAY_NAMES[dayOfWeek]} · {mealTypeLabel}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mealCount === 1 ? "1 meal planned" : `${mealCount} meals planned`}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Meal list */}
        <div className="px-2 py-2 space-y-0.5 max-h-48 overflow-y-auto">
          {items.map((item) => {
            const name = item.recipeName || item.customName || "Unnamed meal";
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.cookedAt ? (
                    <CheckCircle2
                      className="h-4 w-4 text-green-500 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <div className="h-4 w-4 shrink-0" />
                  )}
                  <span className="text-sm font-medium truncate">{name}</span>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0 rounded"
                  aria-label={`Remove ${name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Actions */}
        <div className="px-4 py-3 space-y-2">
          {isAllCooked ? (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={onUndoCooked}
            >
              <RotateCcw className="h-4 w-4" />
              Undo Cooked
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
              onClick={onMarkCooked}
            >
              <ChefHat className="h-4 w-4" />
              Mark as Cooked
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleAddMeal}
          >
            <Plus className="h-4 w-4" />
            Add Another Meal
          </Button>

          <Button
            className="w-full justify-start gap-2 bg-purple hover:bg-purple-dark"
            onClick={onViewDetails}
          >
            <ExternalLink className="h-4 w-4" />
            View Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MealSlotActionsDialog;
