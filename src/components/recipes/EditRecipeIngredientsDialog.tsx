import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import IngredientFormRows from "./IngredientFormRows";
import { createBlankRow } from "./ingredientRowTypes";
import type { IngredientRow } from "./ingredientRowTypes";
import { parseFractionToDecimal } from "@/lib/groceryList";
import { deleteGroceryCache } from "@/lib/groceryCache";
import type { RecipeIngredient, GroceryCategory } from "@/types";

interface EditRecipeIngredientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeName: string;
  ingredients: RecipeIngredient[];
  onSaved: () => void;
  cacheContext?: { type: "event" | "meal_plan"; id: string; userId: string };
}

function ingredientsToRows(ingredients: RecipeIngredient[]): IngredientRow[] {
  if (ingredients.length === 0) return [createBlankRow()];
  return ingredients.map((ing) => ({
    id: ing.id,
    quantity: ing.quantity != null ? String(ing.quantity) : "",
    unit: ing.unit ?? "",
    name: ing.name,
    category: ing.category,
  }));
}

function rowsToIngredientJson(rows: IngredientRow[]) {
  return rows
    .filter((r) => r.name.trim())
    .map((r, i) => ({
      name: r.name.trim(),
      quantity: parseFractionToDecimal(r.quantity) ?? 1,
      unit: r.unit.trim() || null,
      category: r.category as GroceryCategory,
      sort_order: i,
    }));
}

const EditRecipeIngredientsDialog = ({
  open,
  onOpenChange,
  recipeId,
  recipeName,
  ingredients,
  onSaved,
  cacheContext,
}: EditRecipeIngredientsDialogProps) => {
  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRows(ingredientsToRows(ingredients));
    }
  }, [open, ingredients]);

  const handleSave = async () => {
    const data = rowsToIngredientJson(rows);
    if (data.length === 0) {
      toast.error("Add at least one ingredient");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc("replace_recipe_ingredients", {
        p_recipe_id: recipeId,
        p_ingredients: data,
      });
      if (error) throw error;

      // Invalidate grocery cache if context provided
      if (cacheContext) {
        await deleteGroceryCache(cacheContext.type, cacheContext.id, cacheContext.userId);
      }

      toast.success("Ingredients updated!");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Error saving ingredients:", error);
      toast.error("Failed to save ingredients");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Edit Ingredients
          </DialogTitle>
          <DialogDescription>
            Edit ingredients for &quot;{recipeName}&quot;.
          </DialogDescription>
        </DialogHeader>

        <IngredientFormRows rows={rows} onRowsChange={setRows} />

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-purple hover:bg-purple-dark"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Ingredients"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditRecipeIngredientsDialog;
