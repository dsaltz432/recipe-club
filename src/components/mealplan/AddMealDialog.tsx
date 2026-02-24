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
import { toast } from "sonner";
import { Check, Loader2, Search, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadRecipeFile, FileValidationError } from "@/lib/upload";

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
}: AddMealDialogProps) => {
  const [activeTab, setActiveTab] = useState<"custom" | "recipes">("custom");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeResult[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setActiveTab("custom");
    setName("");
    setUrl("");
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    setSelectedRecipes([]);
    setIsUploadingFile(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setUploadingFileName(file.name);
    try {
      const publicUrl = await uploadRecipeFile(file);
      setUrl(publicUrl);
      if (!name.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setName(baseName);
      }
      toast.success("File uploaded!");
    } catch (error) {
      if (error instanceof FileValidationError) {
        toast.error(error.message);
      } else {
        console.error("Error uploading file:", error);
        toast.error("Failed to upload file");
      }
    } finally {
      setIsUploadingFile(false);
      setUploadingFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  const handleCustomSubmit = () => {
    onAddCustomMeal(name.trim(), url.trim() || undefined, !!url.trim());
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
            Add Meal
          </DialogTitle>
          <DialogDescription>
            {`Add a meal for ${DAY_NAMES[dayOfWeek]} ${mealType}.`}
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
              <Label htmlFor="meal-url">Recipe URL or Photo/PDF</Label>
              <div className="flex gap-2">
                <Input
                  id="meal-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className={url.trim() && !isValidUrl(url) ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  className="shrink-0"
                  aria-label="Upload photo or PDF"
                >
                  {isUploadingFile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      <span className="text-xs truncate max-w-[100px]">{uploadingFileName}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
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
