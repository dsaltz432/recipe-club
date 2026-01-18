import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import type { Recipe } from "@/types";

interface EventOption {
  id: string;
  eventDate: string;
  ingredientName: string;
}

interface AddRecipeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onRecipeAdded: () => void;
}

const AddRecipeForm = ({
  open,
  onOpenChange,
  userId,
  onRecipeAdded,
}: AddRecipeFormProps) => {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [recipeName, setRecipeName] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Autocomplete state
  const [existingRecipes, setExistingRecipes] = useState<Recipe[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedExistingRecipe, setSelectedExistingRecipe] = useState<Recipe | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("scheduled_events")
        .select("id, event_date, ingredients (name)")
        .in("status", ["scheduled", "completed"])
        .order("event_date", { ascending: false });

      if (error) throw error;

      if (data) {
        setEvents(
          data.map((e) => ({
            id: e.id,
            eventDate: e.event_date,
            ingredientName: e.ingredients?.name || "Unknown",
          }))
        );
      }
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadEvents();
    }
  }, [open]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load existing recipes for autocomplete
  const loadExistingRecipes = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setExistingRecipes([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .ilike("name", `%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      setExistingRecipes(
        data?.map((r) => ({
          id: r.id,
          name: r.name,
          url: r.url || undefined,
          createdBy: r.created_by || undefined,
          createdAt: r.created_at,
        })) || []
      );
    } catch (error) {
      console.error("Error loading recipes:", error);
    }
  };

  const handleRecipeNameChange = (value: string) => {
    setRecipeName(value);
    setSelectedExistingRecipe(null);
    loadExistingRecipes(value);
    setShowSuggestions(true);
  };

  const handleSelectExistingRecipe = (recipe: Recipe) => {
    setSelectedExistingRecipe(recipe);
    setRecipeName(recipe.name);
    setRecipeUrl(recipe.url || "");
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEventId || !recipeName.trim()) {
      toast.error("Please select an event and enter a recipe name");
      return;
    }

    setIsLoading(true);

    try {
      let recipeId: string;

      if (selectedExistingRecipe) {
        // Use existing recipe
        recipeId = selectedExistingRecipe.id;
      } else {
        // Create new recipe
        const { data: newRecipe, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            name: recipeName.trim(),
            url: recipeUrl.trim() || null,
            created_by: userId,
          })
          .select("id")
          .single();

        if (recipeError) throw recipeError;
        recipeId = newRecipe.id;
      }

      // Create contribution
      const { error: contributionError } = await supabase
        .from("recipe_contributions")
        .insert({
          recipe_id: recipeId,
          user_id: userId,
          event_id: selectedEventId,
        });

      if (contributionError) throw contributionError;

      toast.success("Recipe added!");
      resetForm();
      onRecipeAdded();
    } catch (error) {
      console.error("Error adding recipe:", error);
      toast.error("Failed to add recipe");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedEventId("");
    setRecipeName("");
    setRecipeUrl("");
    setSelectedExistingRecipe(null);
    setExistingRecipes([]);
    setShowSuggestions(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Always reset form on state change - ensures clean state when opening/closing
    resetForm();
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Add Recipe
          </DialogTitle>
          <DialogDescription>
            Add a recipe to one of your club events.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Selector */}
          <div className="space-y-2">
            <Label htmlFor="event">Event</Label>
            {isLoadingEvents ? (
              <div className="h-10 bg-gray-100 animate-pulse rounded-md"></div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No events available. Create an event first by spinning the wheel.
              </p>
            ) : (
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger id="event">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.ingredientName} - {format(parseISO(event.eventDate), "MMM d, yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Recipe Name with Autocomplete */}
          <div className="space-y-2 relative" ref={autocompleteRef}>
            <Label htmlFor="recipe-name">Recipe Name *</Label>
            {selectedExistingRecipe ? (
              <div className="p-3 bg-purple/5 rounded-lg">
                <p className="text-sm text-muted-foreground">Selected recipe:</p>
                <p className="font-medium">{selectedExistingRecipe.name}</p>
                {selectedExistingRecipe.url && (
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedExistingRecipe.url}
                  </p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-purple"
                  onClick={() => {
                    setSelectedExistingRecipe(null);
                    setRecipeName("");
                    setRecipeUrl("");
                  }}
                >
                  Choose different recipe
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="recipe-name"
                  value={recipeName}
                  onChange={(e) => handleRecipeNameChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Start typing to search existing recipes..."
                  required
                />
                {/* Autocomplete dropdown */}
                {showSuggestions && recipeName.trim().length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                    {existingRecipes.length > 0 && (
                      <>
                        {existingRecipes.map((recipe) => (
                          <button
                            key={recipe.id}
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-gray-50"
                            onClick={() => handleSelectExistingRecipe(recipe)}
                          >
                            <div className="font-medium">{recipe.name}</div>
                            {recipe.url && (
                              <div className="text-xs text-muted-foreground truncate">
                                {recipe.url}
                              </div>
                            )}
                          </button>
                        ))}
                      </>
                    )}
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-purple border-t"
                      onClick={() => setShowSuggestions(false)}
                    >
                      <Plus className="h-4 w-4" />
                      Create new recipe "{recipeName}"
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recipe URL */}
          {!selectedExistingRecipe && (
            <div className="space-y-2">
              <Label htmlFor="recipe-url">Recipe URL</Label>
              <Input
                id="recipe-url"
                type="url"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !selectedEventId || !recipeName.trim()}
              className="bg-purple hover:bg-purple-dark"
            >
              {isLoading ? "Adding..." : selectedExistingRecipe ? "Add Contribution" : "Add Recipe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddRecipeForm;
