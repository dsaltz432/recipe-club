import { supabase } from "@/integrations/supabase/client";
import { getCachedAiModel } from "@/lib/userPreferences";

export type SaveRecipeEditResult =
  | { success: true; urlChanged: boolean }
  | { success: false; error: string };

/**
 * Save edits to a recipe's name and URL. Triggers re-parse if URL changed.
 * Callers handle UI concerns (toast, notifications, callbacks).
 */
export async function saveRecipeEdit(
  recipeId: string,
  name: string,
  url: string,
  previousUrl: string
): Promise<SaveRecipeEditResult> {
  try {
    const trimmedUrl = url.trim();

    // Validate URL format if provided
    if (trimmedUrl && !trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      return { success: false, error: "Please enter a valid URL starting with http:// or https://" };
    }

    const urlChanged = (previousUrl || "") !== (trimmedUrl || "");
    const trimmedName = name.trim();

    // Update recipe row
    const { error } = await supabase
      .from("recipes")
      .update({
        name: trimmedName,
        url: trimmedUrl || null,
      })
      .eq("id", recipeId);

    if (error) throw error;

    // Trigger re-parse in background if URL changed and new URL is non-empty
    if (urlChanged && trimmedUrl) {
      supabase.functions
        .invoke("parse-recipe", {
          body: { recipeId, recipeUrl: trimmedUrl, recipeName: trimmedName, model: getCachedAiModel() },
        })
        .then(({ data: parseData, error: parseError }) => {
          if (parseError || !parseData?.success) {
            console.error("Error re-parsing recipe:", parseError ?? parseData?.error);
          }
        });
    }

    return { success: true, urlChanged };
  } catch (error) {
    console.error("Error updating recipe:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update recipe",
    };
  }
}
