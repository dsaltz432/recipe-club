import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SaveRecipeButtonProps {
  recipeId: string;
  userId: string;
  isSaved: boolean;
  onToggle: (recipeId: string, saved: boolean) => void;
}

const SaveRecipeButton = ({ recipeId, userId, isSaved, onToggle }: SaveRecipeButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      if (isSaved) {
        const { error } = await supabase
          .from("saved_recipes")
          .delete()
          .eq("user_id", userId)
          .eq("recipe_id", recipeId);

        if (error) throw error;
        onToggle(recipeId, false);
        toast.success("Recipe removed from collection");
      } else {
        const { error } = await supabase
          .from("saved_recipes")
          .insert({ user_id: userId, recipe_id: recipeId });

        if (error) throw error;
        onToggle(recipeId, true);
        toast.success("Recipe saved to collection");
      }
    } catch (error) {
      console.error("Error toggling saved recipe:", error);
      toast.error("Failed to update saved recipe");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className="p-1 h-auto"
      title={isSaved ? "Remove from collection" : "Save to collection"}
    >
      <Bookmark
        className={`h-4 w-4 ${isSaved ? "fill-purple text-purple" : "text-muted-foreground"}`}
      />
    </Button>
  );
};

export default SaveRecipeButton;
