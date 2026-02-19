import { useState, useEffect, useRef } from "react";
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
import { Check, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipeResult {
  id: string;
  name: string;
  url: string | null;
  event_id: string | null;
}

interface AddMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayOfWeek: number;
  mealType: string;
  onAddCustomMeal: (name: string, url?: string) => void;
  onAddRecipeMeal: (recipes: Array<{ id: string; name: string; url?: string }>) => void;
  editingItemName?: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const isValidUrl = (value: string) => {
  return value.trim().startsWith("http://") || value.trim().startsWith("https://");
};

const AddMealDialog = ({
  open,
  onOpenChange,
  dayOfWeek,
  mealType,
  onAddCustomMeal,
  onAddRecipeMeal,
  editingItemName,
}: AddMealDialogProps) => {
  const [activeTab, setActiveTab] = useState<"custom" | "recipes">("custom");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = () => {
    setActiveTab("custom");
    setName("");
    setUrl("");
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    setSelectedRecipes([]);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, name, url, event_id")
        .ilike("name", `%${searchQuery.trim()}%`)
        .limit(10);

      if (!error && data) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(debounceRef.current!);
    };
  }, [searchQuery]);

  const handleCustomSubmit = () => {
    onAddCustomMeal(name.trim(), url.trim() || undefined);
    handleClose();
  };

  const toggleRecipeSelection = (recipe: RecipeResult) => {
    setSelectedRecipes((prev) => {
      const isSelected = prev.some((r) => r.id === recipe.id);
      if (isSelected) {
        return prev.filter((r) => r.id !== recipe.id);
      }
      return [...prev, recipe];
    });
  };

  const handleRecipesSubmit = () => {
    onAddRecipeMeal(
      selectedRecipes.map((r) => ({
        id: r.id,
        name: r.name,
        url: r.url || undefined,
      }))
    );
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editingItemName ? "Edit Meal" : "Add Meal"}
          </DialogTitle>
          <DialogDescription>
            {editingItemName
              ? `Replace "${editingItemName}" for ${DAY_NAMES[dayOfWeek]} ${mealType}.`
              : `Add a meal for ${DAY_NAMES[dayOfWeek]} ${mealType}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
          <button
            className={cn(
              "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
              activeTab === "custom" && "bg-background text-foreground shadow-sm"
            )}
            onClick={() => setActiveTab("custom")}
          >
            Custom Meal
          </button>
          <button
            className={cn(
              "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
              activeTab === "recipes" && "bg-background text-foreground shadow-sm"
            )}
            onClick={() => setActiveTab("recipes")}
          >
            From Recipes
          </button>
        </div>

        {activeTab === "custom" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="meal-name">Meal Name *</Label>
              <Input
                id="meal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter meal name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meal-url">Recipe URL (optional)</Label>
              <Input
                id="meal-url"
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

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleClose()}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCustomSubmit}
                disabled={!name.trim() || (!!url.trim() && !isValidUrl(url))}
                className="bg-purple hover:bg-purple-dark"
              >
                Add to Plan
              </Button>
            </div>
          </div>
        )}

        {activeTab === "recipes" && (
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
                placeholder="Search recipes..."
                className="pl-9"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Searching...</span>
                </div>
              )}

              {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recipes found
                </p>
              )}

              {!isSearching && searchResults.map((recipe) => {
                const isSelected = selectedRecipes.some((r) => r.id === recipe.id);
                return (
                  <button
                    key={recipe.id}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md transition-colors",
                      isSelected ? "bg-purple/10" : "hover:bg-muted"
                    )}
                    onClick={() => toggleRecipeSelection(recipe)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {isSelected && <Check className="h-4 w-4 text-purple shrink-0" />}
                        <span className="text-sm font-medium truncate">{recipe.name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground ml-2 shrink-0">
                        {recipe.event_id ? "Club" : "Personal"}
                      </span>
                    </div>
                  </button>
                );
              })}

              {!isSearching && !searchQuery.trim() && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Type to search your recipes
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleClose()}>
                Cancel
              </Button>
              <Button
                onClick={handleRecipesSubmit}
                disabled={selectedRecipes.length === 0}
                className="bg-purple hover:bg-purple-dark"
              >
                {selectedRecipes.length === 0
                  ? "Add to Plan"
                  : `Add ${selectedRecipes.length} to Plan`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddMealDialog;
