import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Ingredient, ScheduledEvent } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import confetti from "canvas-confetti";
import { ArrowLeft, Calendar, Utensils } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { WHEEL_COLORS } from "@/lib/constants";

interface RecipeLockInFormProps {
  ingredient: Ingredient;
  eventDate: Date;
  event?: ScheduledEvent | null;
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const RecipeLockInForm = ({
  ingredient,
  eventDate,
  event,
  userId,
  onComplete,
  onCancel,
}: RecipeLockInFormProps) => {
  const [recipeName, setRecipeName] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // URL is optional
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipeName.trim()) {
      toast.error("Please enter a recipe name");
      return;
    }

    if (recipeUrl && !validateUrl(recipeUrl)) {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsSubmitting(true);

    try {
      const eventDateStr = format(eventDate, "yyyy-MM-dd");

      // Create or update the scheduled event if needed
      let eventId = event?.id;
      if (!eventId) {
        const { data: newEvent, error: eventError } = await supabase
          .from("scheduled_events")
          .insert({
            id: uuidv4(),
            ingredient_id: ingredient.id,
            event_date: eventDateStr,
            created_by: userId,
            status: "scheduled",
          })
          .select()
          .single();

        if (eventError) throw eventError;
        eventId = newEvent.id;

        // Mark ingredient as used
        await supabase
          .from("ingredients")
          .update({
            is_used: true,
            used_by: userId,
            used_date: new Date().toISOString(),
          })
          .eq("id", ingredient.id);
      }

      // Create the recipe
      const { error: recipeError } = await supabase.from("recipes").insert({
        id: uuidv4(),
        name: recipeName.trim(),
        url: recipeUrl.trim() || null,
        notes: notes.trim() || null,
        user_id: userId,
        ingredient_id: ingredient.id,
        event_date: eventDateStr,
      });

      if (recipeError) throw recipeError;

      // Success!
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: WHEEL_COLORS,
      });

      toast.success("Recipe locked in! Can't wait to see what you make!");
      onComplete();
    } catch (error) {
      console.error("Error locking in recipe:", error);
      toast.error("Failed to lock in recipe. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Button
        variant="ghost"
        onClick={onCancel}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-purple/10 flex items-center justify-center mb-4">
            <Utensils className="h-8 w-8 text-purple" />
          </div>
          <CardTitle className="font-display text-2xl">Lock In Your Recipe</CardTitle>
          <CardDescription className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-base">
              <span className="font-semibold text-purple">{ingredient.name}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{format(eventDate, "MMMM d, yyyy")}</span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="recipeName">
                Recipe Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="recipeName"
                placeholder="e.g., Grandma's Famous Chicken Soup"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipeUrl">Recipe URL (optional)</Label>
              <Input
                id="recipeUrl"
                type="url"
                placeholder="https://example.com/recipe"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any special notes about your recipe..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-purple hover:bg-purple-dark"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Locking In..." : "Lock In Recipe"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecipeLockInForm;
