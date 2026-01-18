import { useState } from "react";
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
import type { EventRecipeWithContributions } from "@/types";

interface EventRatingDialogProps {
  event: {
    eventId: string;
    eventDate: string;
    ingredientName?: string;
  };
  recipes: EventRecipeWithContributions[];
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface RatingData {
  wouldCookAgain: boolean | null;
  rating: number | null;
}

const EventRatingDialog = ({
  event,
  recipes,
  userId,
  onComplete,
  onCancel,
}: EventRatingDialogProps) => {
  const [ratings, setRatings] = useState<Map<string, RatingData>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRatingChange = (
    recipeId: string,
    field: "wouldCookAgain" | "rating",
    value: boolean | number
  ) => {
    setRatings((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(recipeId) || { wouldCookAgain: null, rating: null };
      newMap.set(recipeId, { ...current, [field]: value });
      return newMap;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Insert ratings for recipes that were rated
      const ratingsToInsert = Array.from(ratings.entries())
        .filter(([, r]) => r.wouldCookAgain !== null && r.rating !== null)
        .map(([recipeId, r]) => ({
          recipe_id: recipeId,
          user_id: userId,
          event_id: event.eventId,
          would_cook_again: r.wouldCookAgain as boolean,
          overall_rating: r.rating as number,
        }));

      if (ratingsToInsert.length > 0) {
        const { error } = await supabase
          .from("recipe_ratings")
          .insert(ratingsToInsert);
        if (error) throw error;
        toast.success(`Submitted ${ratingsToInsert.length} rating${ratingsToInsert.length !== 1 ? "s" : ""}!`);
      }

      onComplete();
    } catch (error) {
      console.error("Error submitting ratings:", error);
      toast.error("Failed to submit ratings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Complete event without ratings
    onComplete();
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Rate the Recipes</DialogTitle>
          <DialogDescription>
            How did you like the recipes from the {event.ingredientName} event? Your ratings help everyone discover great recipes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {recipes.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No recipes to rate for this event.
            </p>
          ) : (
            recipes.map(({ recipe }) => {
              const recipeRating = ratings.get(recipe.id) || { wouldCookAgain: null, rating: null };

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
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSkip} disabled={isSubmitting}>
            Skip Ratings
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-purple hover:bg-purple-dark"
          >
            {isSubmitting ? "Submitting..." : "Submit Ratings & Complete Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventRatingDialog;
