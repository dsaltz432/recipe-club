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
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Check, Clock, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import RecipeInputForm, {
  createInitialFormData,
  canSubmitRecipeForm,
  buildManualParseText,
  type RecipeFormData,
} from "@/components/recipes/RecipeInputForm";

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
  onAddCustomMeal: (name: string, url?: string, shouldParse?: boolean) => void;
  onAddRecipeMeal: (recipes: Array<{ id: string; name: string; url?: string }>) => void;
  onAddManualMeal?: (name: string, text: string) => void;
  userId?: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const AddMealDialog = ({
  open,
  onOpenChange,
  dayOfWeek,
  mealType,
  onAddCustomMeal,
  onAddRecipeMeal,
  onAddManualMeal,
  userId,
}: AddMealDialogProps) => {
  const [activeTab, setActiveTab] = useState<"custom" | "recipes">("custom");
  const [formData, setFormData] = useState<RecipeFormData>(createInitialFormData());
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeResult[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<RecipeResult[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recently used recipes whenever the dialog opens (requires userId)
  useEffect(() => {
    if (!open || !userId) return;

    let cancelled = false;
    setIsLoadingRecent(true);

    const fetchRecentRecipes = async () => {
      try {
        // meal_plan_items not yet fully typed for this join — cast to any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { data } = await db
          .from("meal_plan_items")
          .select("recipe_id, recipes(id, name, url, event_id), meal_plans!inner(user_id)")
          .eq("meal_plans.user_id", userId)
          .not("recipe_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(30); // fetch extras for client-side dedup

        if (cancelled) return;

        if (data) {
          const seen = new Set<string>();
          const deduped: RecipeResult[] = [];
          for (const row of data as Array<{
            recipe_id: string;
            recipes: { id: string; name: string; url: string | null; event_id: string | null } | null;
          }>) {
            if (row.recipe_id && !seen.has(row.recipe_id) && row.recipes) {
              seen.add(row.recipe_id);
              deduped.push({
                id: row.recipes.id,
                name: row.recipes.name,
                url: row.recipes.url,
                event_id: row.recipes.event_id,
              });
              if (deduped.length >= 6) break;
            }
          }
          setRecentRecipes(deduped);
        }
      } catch {
        // non-critical — leave list empty
      } finally {
        if (!cancelled) setIsLoadingRecent(false);
      }
    };

    fetchRecentRecipes();
    return () => { cancelled = true; };
  }, [open, userId]);

  const resetForm = () => {
    setActiveTab("custom");
    setFormData(createInitialFormData());
    setIsUploadingFile(false);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    setSelectedRecipes([]);
    setRecentRecipes([]);
    setIsLoadingRecent(false);
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
      // clearTimeout safely accepts any value; type cast avoids non-null assertion
      clearTimeout(debounceRef.current as ReturnType<typeof setTimeout>);
    };
  }, [searchQuery]);

  const handleCustomSubmit = async () => {
    if (formData.inputMode === "manual" && onAddManualMeal) {
      onAddManualMeal(formData.name.trim(), buildManualParseText(formData));
      handleClose();
    } else {
      // In url/upload mode, form validation ensures URL is always present
      onAddCustomMeal(formData.name.trim(), formData.url.trim(), true);
      handleClose();
    }
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

  const renderRecipeRow = (recipe: RecipeResult) => {
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
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:p-6 gap-3 sm:gap-4 sm:max-w-lg" hideClose>
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-display text-lg sm:text-xl">
            Add Meal
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {`Add a meal for ${DAY_NAMES[dayOfWeek]} ${mealType}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="inline-flex h-9 sm:h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
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
          <div className="space-y-3 sm:space-y-4 py-1 sm:py-2">
            <RecipeInputForm
              formData={formData}
              onFormDataChange={setFormData}
              isUploading={isUploadingFile}
              onUploadingChange={setIsUploadingFile}
              nameLabel="Meal Name *"
              namePlaceholder="Enter meal name"
              showManualMode={!!onAddManualMeal}
              manualPasteOnly
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleClose()}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCustomSubmit}
                disabled={!canSubmitRecipeForm(formData, false, true)}
                className="bg-purple hover:bg-purple-dark"
              >
                Add to Meal
              </Button>
            </div>
          </div>
        )}

        {activeTab === "recipes" && (
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                name="meal-recipe-search"
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

              {!isSearching && searchQuery.trim() && searchResults.map(renderRecipeRow)}

              {!isSearching && !searchQuery.trim() && (
                <>
                  {/* Recently used section — only shown when userId is provided */}
                  {userId && isLoadingRecent && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center gap-1.5 px-1 mb-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Recently used
                        </span>
                      </div>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="px-3 py-2 flex items-center gap-3">
                          <Skeleton className="h-4 w-4 rounded" />
                          <Skeleton className="h-4 flex-1 max-w-[160px]" />
                          <Skeleton className="h-4 w-12 rounded" />
                        </div>
                      ))}
                    </div>
                  )}

                  {userId && !isLoadingRecent && recentRecipes.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center gap-1.5 px-1 mb-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Recently used
                        </span>
                      </div>
                      {recentRecipes.map(renderRecipeRow)}
                      <p className="text-xs text-center text-muted-foreground pt-1">
                        Or search all recipes above
                      </p>
                    </div>
                  )}

                  {(!userId || (!isLoadingRecent && recentRecipes.length === 0)) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Type to search your recipes
                    </p>
                  )}
                </>
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
                  ? "Add to Meal"
                  : `Add ${selectedRecipes.length} to Meal`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddMealDialog;
