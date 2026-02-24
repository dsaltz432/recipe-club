import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddPersonalRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onRecipeAdded: () => void;
}

const AddPersonalRecipeDialog = ({
  open,
  onOpenChange,
  userId,
  onRecipeAdded,
}: AddPersonalRecipeDialogProps) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidUrl = (value: string) => {
    return value.trim().startsWith("http://") || value.trim().startsWith("https://");
  };

  const handleSubmit = async () => {
    if (url.trim() && !isValidUrl(url)) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("recipes").insert({
        name: name.trim(),
        url: url.trim() || null,
        created_by: userId,
        event_id: null,
        ingredient_id: null,
      });

      if (error) throw error;

      toast.success("Personal recipe added!");
      setName("");
      setUrl("");
      onOpenChange(false);
      onRecipeAdded();
    } catch (error) {
      console.error("Error adding personal recipe:", error);
      toast.error("Failed to add recipe");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setName("");
        setUrl("");
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Add Personal Recipe
          </DialogTitle>
          <DialogDescription>
            Add a recipe to your personal collection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="personal-recipe-name">Recipe Name *</Label>
            <Input
              id="personal-recipe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter recipe name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personal-recipe-url">Recipe URL (optional)</Label>
            <Input
              id="personal-recipe-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className={url.trim() && !isValidUrl(url) ? "border-red-500" : ""}
            />
            {url.trim() && !isValidUrl(url) && (
              <p className="text-sm text-red-500">
                URL must start with http:// or https://
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="bg-purple hover:bg-purple-dark"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Recipe"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddPersonalRecipeDialog;
