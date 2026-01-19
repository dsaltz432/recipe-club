import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Ingredient } from "@/types";
import { DEFAULT_INGREDIENTS, MIN_INGREDIENTS_TO_SPIN } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Lightbulb, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { getSuggestedIngredients } from "@/lib/ingredientSuggestions";
import { getIngredientColor } from "@/lib/ingredientColors";

interface IngredientBankProps {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  userId: string;
  isAdmin?: boolean;
}

const IngredientBank = ({
  ingredients,
  setIngredients,
  userId,
  isAdmin = false,
}: IngredientBankProps) => {
  const [newIngredient, setNewIngredient] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Load all ingredients from Supabase (both in bank and historical)
  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const { data, error } = await supabase
          .from("ingredients")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const mappedIngredients = data.map((i) => ({
            id: i.id,
            name: i.name,
            usedCount: i.used_count,
            lastUsedBy: i.last_used_by || undefined,
            lastUsedDate: i.last_used_date || undefined,
            createdBy: i.created_by || undefined,
            inBank: i.in_bank,
            color: i.color || getIngredientColor(i.name),
          }));
          setAllIngredients(mappedIngredients);
          setIngredients(mappedIngredients);
        } else {
          // Initialize with default ingredients
          const defaultIngredients: Ingredient[] = DEFAULT_INGREDIENTS.map(
            (name) => ({
              id: uuidv4(),
              name,
              usedCount: 0,
              inBank: true,
              color: getIngredientColor(name),
            })
          );
          setAllIngredients(defaultIngredients);
          setIngredients(defaultIngredients);

          // Save defaults to database
          await Promise.all(
            defaultIngredients.map((i) =>
              supabase.from("ingredients").insert({
                id: i.id,
                name: i.name,
                used_count: 0,
                in_bank: true,
                created_by: userId,
                color: i.color,
              })
            )
          );
        }
      } catch (error) {
        console.error("Error loading ingredients:", error);
        // Fall back to default ingredients if there's an error
        const fallbackIngredients = DEFAULT_INGREDIENTS.map((name) => ({
          id: uuidv4(),
          name,
          usedCount: 0,
          inBank: true,
          color: getIngredientColor(name),
        }));
        setAllIngredients(fallbackIngredients);
        setIngredients(fallbackIngredients);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      loadIngredients();
    }
  }, [userId, setIngredients]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close if click is outside the autocomplete area
      // The ref is always valid when autocomplete is interactive (same conditional block as input)
      const isOutside = !autocompleteRef.current?.contains(event.target as Node);
      if (isOutside) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter for ingredients currently in the bank
  const bankIngredients = ingredients.filter((i) => i.inBank);
  const isFull = bankIngredients.length >= MIN_INGREDIENTS_TO_SPIN;

  // Get autocomplete suggestions based on input
  const getAutocompleteSuggestions = () => {
    if (!newIngredient.trim()) return [];

    return allIngredients.filter((i) =>
      i.name.toLowerCase().includes(newIngredient.toLowerCase())
    );
  };

  const autocompleteSuggestions = getAutocompleteSuggestions();

  // Visual styling based on usage count
  const getUsageStyle = (usedCount: number) => {
    if (usedCount === 0) return "bg-white border-border hover:border-purple/50";
    if (usedCount === 1) return "bg-purple/5 border-purple/20 hover:border-purple/40";
    if (usedCount === 2) return "bg-purple/10 border-purple/30 hover:border-purple/50";
    return "bg-purple/20 border-purple/40 hover:border-purple/60";
  };

  // Usage badge
  const getUsageBadge = (usedCount: number) => {
    if (usedCount === 0) return null;
    return (
      <span className="text-xs text-purple/70 ml-2">
        Used {usedCount}x
      </span>
    );
  };

  const addIngredient = async (ingredientToAdd?: Ingredient) => {
    const trimmedName = ingredientToAdd?.name || newIngredient.trim();

    if (!trimmedName) return;

    // Note: isFull check is handled by the render conditional - add section is hidden when full

    // Check if it's an existing ingredient being re-added to the bank
    if (typeof ingredientToAdd === "object" && ingredientToAdd !== null) {
      // Re-add existing ingredient to bank
      try {
        const { error } = await supabase
          .from("ingredients")
          .update({ in_bank: true })
          .eq("id", ingredientToAdd.id);

        if (error) throw error;

        // Update local state
        const updateIngredient = (prev: Ingredient[]) =>
          prev.map((i) =>
            i.id === ingredientToAdd.id ? { ...i, inBank: true } : i
          );

        setIngredients(updateIngredient);
        setAllIngredients(updateIngredient);
        setNewIngredient("");
        setShowAutocomplete(false);
        toast.success(`Added "${ingredientToAdd.name}" back to your ingredient bank!`);
      } catch (error) {
        console.error("Error adding ingredient to bank:", error);
        toast.error("Failed to add ingredient. Please try again.");
      }
      return;
    }

    // Check for duplicates in bank (case-insensitive)
    const existsInBank = bankIngredients.some(
      (i) => i.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existsInBank) {
      toast.error("This ingredient is already in your bank!");
      return;
    }

    // Check if ingredient exists but not in bank
    const existingIngredient = allIngredients.find(
      (i) => i.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingIngredient) {
      // Re-add to bank
      await addIngredient(existingIngredient);
      return;
    }

    // Create new ingredient
    const ingredientColor = getIngredientColor(trimmedName);
    const newItem: Ingredient = {
      id: uuidv4(),
      name: trimmedName,
      usedCount: 0,
      inBank: true,
      createdBy: userId,
      color: ingredientColor,
    };

    try {
      const { error } = await supabase.from("ingredients").insert({
        id: newItem.id,
        name: newItem.name,
        used_count: 0,
        in_bank: true,
        created_by: userId,
        color: ingredientColor,
      });

      if (error) throw error;

      setIngredients((prev) => [...prev, newItem]);
      setAllIngredients((prev) => [...prev, newItem]);
      setNewIngredient("");
      setShowAutocomplete(false);
      toast.success(`Added "${trimmedName}" to your ingredient bank!`);
    } catch (error) {
      console.error("Error adding ingredient:", error);
      toast.error("Failed to add ingredient. Please try again.");
    }
  };

  const removeFromBank = async (id: string) => {
    // Note: UI only renders remove button for existing ingredients, so ingredient is guaranteed to exist
    const ingredient = ingredients.find((i) => i.id === id)!;

    try {
      // Set in_bank to false instead of deleting
      const { error } = await supabase
        .from("ingredients")
        .update({ in_bank: false })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      const updateIngredient = (prev: Ingredient[]) =>
        prev.map((i) => (i.id === id ? { ...i, inBank: false } : i));

      setIngredients(updateIngredient);
      setAllIngredients(updateIngredient);
      toast.success(`Removed "${ingredient.name}" from your ingredient bank.`);
    } catch (error) {
      console.error("Error removing ingredient from bank:", error);
      toast.error("Failed to remove ingredient. Please try again.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addIngredient();
    }
  };

  const generateSuggestions = () => {
    const existingNames = allIngredients.map((i) => i.name);
    const newSuggestions = getSuggestedIngredients(existingNames);
    setSuggestions(newSuggestions);
  };

  const addSuggestion = async (name: string) => {
    // Note: isFull check is handled by the render conditional - suggestions section is hidden when full

    const ingredientColor = getIngredientColor(name);
    const newItem: Ingredient = {
      id: uuidv4(),
      name,
      usedCount: 0,
      inBank: true,
      createdBy: userId,
      color: ingredientColor,
    };

    try {
      const { error } = await supabase.from("ingredients").insert({
        id: newItem.id,
        name: newItem.name,
        used_count: 0,
        in_bank: true,
        created_by: userId,
        color: ingredientColor,
      });

      if (error) throw error;

      setIngredients((prev) => [...prev, newItem]);
      setAllIngredients((prev) => [...prev, newItem]);
      setSuggestions((prev) => prev.filter((s) => s !== name));
      toast.success(`Added "${name}" to your ingredient bank!`);
    } catch (error) {
      console.error("Error adding ingredient:", error);
      toast.error("Failed to add ingredient. Please try again.");
    }
  };

  const progress = Math.min(
    (bankIngredients.length / MIN_INGREDIENTS_TO_SPIN) * 100,
    100
  );

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/90 backdrop-blur-sm border-2 border-purple/10 shadow-md">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="font-display text-lg sm:text-xl text-gray-900">Ingredient Bank</CardTitle>
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
            <span>
              <strong className="text-purple">{bankIngredients.length}</strong> / {MIN_INGREDIENTS_TO_SPIN} ingredients
            </span>
            <span className={bankIngredients.length >= MIN_INGREDIENTS_TO_SPIN ? "text-green font-medium" : ""}>
              {bankIngredients.length >= MIN_INGREDIENTS_TO_SPIN
                ? "Ready to spin!"
                : `Need ${MIN_INGREDIENTS_TO_SPIN - bankIngredients.length} more`}
            </span>
          </div>
          <Progress value={progress} className="h-2 bg-purple/10" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
        {/* Add Ingredient - Admin only */}
        {isAdmin && !isFull && (
          <div className="space-y-3">
            <div className="relative" ref={autocompleteRef}>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a new ingredient..."
                  value={newIngredient}
                  onChange={(e) => {
                    setNewIngredient(e.target.value);
                    setShowAutocomplete(true);
                  }}
                  onFocus={() => setShowAutocomplete(true)}
                  onKeyPress={handleKeyPress}
                />
                <Button
                  onClick={() => addIngredient()}
                  size="icon"
                  className="bg-purple hover:bg-purple-dark shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Autocomplete dropdown */}
              {showAutocomplete && newIngredient.trim() && (
                <div className="absolute top-full left-0 right-12 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                  {autocompleteSuggestions.map((ingredient) => {
                    const isInBank = ingredient.inBank;
                    return (
                      <button
                        key={ingredient.id}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                          isInBank ? "text-gray-400" : ""
                        }`}
                        onClick={() => !isInBank && addIngredient(ingredient)}
                        disabled={isInBank}
                      >
                        <span>{ingredient.name}</span>
                        <span className="text-xs">
                          {isInBank ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <Check className="h-3 w-3" /> In bank
                            </span>
                          ) : ingredient.usedCount > 0 ? (
                            <span className="text-amber-600">
                              Used {ingredient.usedCount}x · Add to bank
                            </span>
                          ) : (
                            <span className="text-gray-400">Add to bank</span>
                          )}
                        </span>
                      </button>
                    );
                  })}

                  {/* Option to create new ingredient */}
                  {!autocompleteSuggestions.some(
                    (i) => i.name.toLowerCase() === newIngredient.toLowerCase()
                  ) && (
                    <button
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-purple border-t"
                      onClick={() => addIngredient()}
                    >
                      <Plus className="h-4 w-4" />
                      Create "{newIngredient}"
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Suggestions */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateSuggestions}
                className="text-purple border-purple/30 hover:bg-purple/10"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Suggest Ingredients
              </Button>

              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => addSuggestion(suggestion)}
                      className="px-3 py-1.5 text-sm bg-purple/10 hover:bg-purple/20 text-purple rounded-full transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ingredient List */}
        <ScrollArea className="h-80">
          <div className="space-y-2 pr-4">
            {bankIngredients.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No ingredients found
              </p>
            ) : (
              bankIngredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${getUsageStyle(ingredient.usedCount)}`}
                >
                  <div className="flex items-center">
                    <span className="font-medium">{ingredient.name}</span>
                    {getUsageBadge(ingredient.usedCount)}
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromBank(ingredient.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default IngredientBank;
