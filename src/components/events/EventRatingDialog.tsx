import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { EventRecipeWithNotes } from "@/types";

interface EventRatingDialogProps {
  event: {
    eventId: string;
    eventDate: string;
    ingredientName?: string;
  };
  recipes: EventRecipeWithNotes[];
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
  /** "completing" = admin completing event, "rating" = member adding ratings to completed event */
  mode?: "completing" | "rating";
}

interface RatingData {
  wouldCookAgain: boolean | null;
  rating: number | null;
  noteText: string;
}

const EventRatingDialog = ({
  event,
  recipes,
  userId,
  onComplete,
  onCancel,
  mode = "completing",
}: EventRatingDialogProps) => {
  const [ratings, setRatings] = useState<Map<string, RatingData>>(() => {
    const initial = new Map<string, RatingData>();
    recipes.forEach(({ recipe, notes }) => {
      const userNote = notes.find((n) => n.userId === userId);
      initial.set(recipe.id, {
        wouldCookAgain: null,
        rating: null,
        noteText: userNote?.notes ?? "",
      });
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(mode === "rating");

  // Load existing user ratings when in "rating" mode
  useEffect(() => {
    if (mode !== "rating" || !userId) return;

    const loadExistingRatings = async () => {
      try {
        const recipeIds = recipes.map(r => r.recipe.id);
        if (recipeIds.length === 0) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("recipe_ratings")
          .select("recipe_id, would_cook_again, overall_rating")
          .eq("user_id", userId)
          .in("recipe_id", recipeIds);

        if (error) throw error;

        if (data && data.length > 0) {
          setRatings((prev) => {
            const updated = new Map(prev);
            data.forEach(r => {
              const current = updated.get(r.recipe_id);
              updated.set(r.recipe_id, {
                wouldCookAgain: r.would_cook_again,
                rating: r.overall_rating,
                noteText: current?.noteText ?? "",
              });
            });
            return updated;
          });
        }
      } catch (error) {
        console.error("Error loading existing ratings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingRatings();
  }, [mode, userId, recipes]);

  const handleRatingChange = (
    recipeId: string,
    field: "wouldCookAgain" | "rating",
    value: boolean | number
  ) => {
    setRatings((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(recipeId) || { wouldCookAgain: null, rating: null, noteText: "" };
      newMap.set(recipeId, { ...current, [field]: value });
      return newMap;
    });
  };

  const handleNoteChange = (recipeId: string, value: string) => {
    setRatings((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(recipeId) || { wouldCookAgain: null, rating: null, noteText: "" };
      newMap.set(recipeId, { ...current, noteText: value });
      return newMap;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Get ratings for recipes that were rated
      const ratingsToUpsert = Array.from(ratings.entries())
        .filter(([, r]) => r.wouldCookAgain !== null && r.rating !== null)
        .map(([recipeId, r]) => ({
          recipe_id: recipeId,
          user_id: userId,
          event_id: event.eventId,
          would_cook_again: r.wouldCookAgain as boolean,
          overall_rating: r.rating as number,
        }));

      if (ratingsToUpsert.length > 0) {
        // Use upsert to handle both new ratings and updates
        const { error } = await supabase
          .from("recipe_ratings")
          .upsert(ratingsToUpsert, { onConflict: "recipe_id,user_id,event_id" });
        if (error) throw error;
        toast.success(`Submitted ${ratingsToUpsert.length} rating${ratingsToUpsert.length !== 1 ? "s" : ""}!`);
      }

      // Save notes for any recipe with text
      for (const { recipe, notes } of recipes) {
        const ratingData = ratings.get(recipe.id);
        const noteText = ratingData?.noteText ?? "";
        const existingNote = notes.find((n) => n.userId === userId);

        if (existingNote) {
          const { error } = await supabase
            .from("recipe_notes")
            .update({ notes: noteText })
            .eq("id", existingNote.id);
          if (error) throw error;
        } else if (noteText.trim()) {
          const { error } = await supabase
            .from("recipe_notes")
            .insert({ recipe_id: recipe.id, user_id: userId, notes: noteText });
          if (error) throw error;
        }
      }

      onComplete();
    } catch (error) {
      console.error("Error submitting ratings:", error);
      toast.error("Failed to submit ratings");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if all recipes have been rated (or if there are no recipes to rate)
  const allRecipesRated = recipes.length === 0 || recipes.every(({ recipe }) => {
    const rating = ratings.get(recipe.id);
    return rating && rating.wouldCookAgain !== null && rating.rating !== null;
  });

  const unratedCount = recipes.filter(({ recipe }) => {
    const rating = ratings.get(recipe.id);
    return !rating || rating.wouldCookAgain === null || rating.rating === null;
  }).length;

  // In "rating" mode, at least one rating must be provided
  const hasAnyRating = Array.from(ratings.values()).some(
    r => r.wouldCookAgain !== null && r.rating !== null
  );

  // Determine if submit is allowed based on mode
  const canSubmit = mode === "completing" ? allRecipesRated : hasAnyRating;

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Rate the Recipes</DialogTitle>
          <DialogDescription>
            {mode === "completing"
              ? `How did you like the recipes from the ${event.ingredientName} event? Your ratings help everyone discover great recipes.`
              : `Rate the recipes from the ${event.ingredientName} event. You can update your ratings anytime.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple"></div>
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No recipes to rate for this event.
            </p>
          ) : (
            recipes.map(({ recipe }) => {
              const recipeRating = ratings.get(recipe.id) || { wouldCookAgain: null, rating: null, noteText: "" };

              return (
                <div key={recipe.id} className="p-4 border rounded-lg space-y-4">
                  <div>
                    <h4 className="font-semibold">{recipe.name}</h4>
                    {recipe.url && (
                      <a
                        href={recipe.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple hover:underline"
                      >
                        View recipe
                      </a>
                    )}
                  </div>

                  {/* Would cook again */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm">Would you make this again?</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={recipeRating.wouldCookAgain === true ? "default" : "outline"}
                        onClick={() => handleRatingChange(recipe.id, "wouldCookAgain", true)}
                        className={recipeRating.wouldCookAgain === true ? "bg-green-500 hover:bg-green-600" : ""}
                      >
                        <ThumbsUp className="h-4 w-4 mr-1" /> Yes
                      </Button>
                      <Button
                        size="sm"
                        variant={recipeRating.wouldCookAgain === false ? "default" : "outline"}
                        onClick={() => handleRatingChange(recipe.id, "wouldCookAgain", false)}
                        className={recipeRating.wouldCookAgain === false ? "bg-red-500 hover:bg-red-600" : ""}
                      >
                        <ThumbsDown className="h-4 w-4 mr-1" /> No
                      </Button>
                    </div>
                  </div>

                  {/* Star rating */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm">Overall rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRatingChange(recipe.id, "rating", star)}
                          className="p-1 hover:scale-110 transition-transform"
                          aria-label={`Rate ${star} out of 5 stars`}
                        >
                          <Star
                            className={`h-6 w-6 ${
                              (recipeRating.rating || 0) >= star
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {recipeRating.rating && (
                      <span className="text-sm text-muted-foreground">
                        {recipeRating.rating}/5
                      </span>
                    )}
                  </div>

                  {/* Note */}
                  <div className="space-y-1">
                    <span className="text-sm">Notes (optional):</span>
                    <Textarea
                      placeholder="Add your notes about this recipe..."
                      value={recipeRating.noteText}
                      onChange={(e) => handleNoteChange(recipe.id, e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {mode === "completing" && !allRecipesRated && recipes.length > 0 && (
            <p className="text-sm text-muted-foreground mr-auto">
              {unratedCount} recipe{unratedCount !== 1 ? "s" : ""} still need{unratedCount === 1 ? "s" : ""} rating
            </p>
          )}
          {mode === "rating" && !hasAnyRating && recipes.length > 0 && (
            <p className="text-sm text-muted-foreground mr-auto">
              Rate at least one recipe to submit
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || !canSubmit}
            className="bg-purple hover:bg-purple-dark"
          >
            {isSubmitting
              ? "Submitting..."
              : mode === "completing"
                ? "Submit Ratings & Complete Event"
                : "Submit Ratings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventRatingDialog;
