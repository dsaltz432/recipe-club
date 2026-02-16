import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { UserPreferences } from "@/types";

interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  preferences: UserPreferences | null;
  onSaved: (prefs: UserPreferences) => void;
}

const DIETARY_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free",
  "Nut-Free", "Keto", "Paleo", "Low-Carb",
];

const CUISINE_OPTIONS = [
  "Italian", "Mexican", "Asian", "Indian",
  "Mediterranean", "American", "French", "Japanese",
  "Thai", "Middle Eastern",
];

const PreferencesDialog = ({
  open,
  onOpenChange,
  userId,
  preferences,
  onSaved,
}: PreferencesDialogProps) => {
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>([]);
  const [dislikedInput, setDislikedInput] = useState("");
  const [dislikedIngredients, setDislikedIngredients] = useState<string[]>([]);
  const [householdSize, setHouseholdSize] = useState(2);
  const [cookingSkill, setCookingSkill] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [maxCookTime, setMaxCookTime] = useState(60);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (preferences) {
      setDietaryRestrictions(preferences.dietaryRestrictions);
      setCuisinePreferences(preferences.cuisinePreferences);
      setDislikedIngredients(preferences.dislikedIngredients);
      setHouseholdSize(preferences.householdSize);
      setCookingSkill(preferences.cookingSkill);
      setMaxCookTime(preferences.maxCookTimeMinutes);
    }
  }, [preferences]);

  const toggleDietary = (item: string) => {
    setDietaryRestrictions((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  };

  const toggleCuisine = (item: string) => {
    setCuisinePreferences((prev) =>
      prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]
    );
  };

  const addDisliked = () => {
    const trimmed = dislikedInput.trim();
    if (trimmed && !dislikedIngredients.includes(trimmed)) {
      setDislikedIngredients((prev) => [...prev, trimmed]);
      setDislikedInput("");
    }
  };

  const removeDisliked = (item: string) => {
    setDislikedIngredients((prev) => prev.filter((d) => d !== item));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const prefsData = {
        user_id: userId,
        dietary_restrictions: dietaryRestrictions,
        cuisine_preferences: cuisinePreferences,
        disliked_ingredients: dislikedIngredients,
        household_size: householdSize,
        cooking_skill: cookingSkill,
        max_cook_time_minutes: maxCookTime,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("user_preferences")
        .upsert(prefsData, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;

      const saved: UserPreferences = {
        id: data.id,
        userId: data.user_id,
        dietaryRestrictions: data.dietary_restrictions,
        cuisinePreferences: data.cuisine_preferences,
        dislikedIngredients: data.disliked_ingredients,
        householdSize: data.household_size,
        cookingSkill: data.cooking_skill as "beginner" | "intermediate" | "advanced",
        maxCookTimeMinutes: data.max_cook_time_minutes,
        updatedAt: data.updated_at,
      };

      onSaved(saved);
      toast.success("Preferences saved!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Meal Preferences</DialogTitle>
          <DialogDescription>
            Set your preferences for AI-powered meal suggestions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label>Dietary Restrictions</Label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((option) => (
                <Badge
                  key={option}
                  variant={dietaryRestrictions.includes(option) ? "default" : "outline"}
                  className={`cursor-pointer ${dietaryRestrictions.includes(option) ? "bg-purple" : ""}`}
                  onClick={() => toggleDietary(option)}
                >
                  {option}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cuisine Preferences</Label>
            <div className="flex flex-wrap gap-2">
              {CUISINE_OPTIONS.map((option) => (
                <Badge
                  key={option}
                  variant={cuisinePreferences.includes(option) ? "default" : "outline"}
                  className={`cursor-pointer ${cuisinePreferences.includes(option) ? "bg-orange" : ""}`}
                  onClick={() => toggleCuisine(option)}
                >
                  {option}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Disliked Ingredients</Label>
            <div className="flex gap-2">
              <Input
                value={dislikedInput}
                onChange={(e) => setDislikedInput(e.target.value)}
                placeholder="e.g., cilantro"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDisliked();
                  }
                }}
              />
              <Button variant="outline" onClick={addDisliked} type="button">
                Add
              </Button>
            </div>
            {dislikedIngredients.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {dislikedIngredients.map((item) => (
                  <Badge key={item} variant="secondary" className="gap-1">
                    {item}
                    <button onClick={() => removeDisliked(item)} className="hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="household-size">Household Size</Label>
              <Input
                id="household-size"
                type="number"
                min={1}
                max={20}
                value={householdSize}
                onChange={(e) => setHouseholdSize(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-cook-time">Max Cook Time (min)</Label>
              <Input
                id="max-cook-time"
                type="number"
                min={10}
                max={480}
                value={maxCookTime}
                onChange={(e) => setMaxCookTime(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cooking Skill</Label>
            <Select value={cookingSkill} onValueChange={(v) => setCookingSkill(v as "beginner" | "intermediate" | "advanced")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-purple hover:bg-purple-dark">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesDialog;
