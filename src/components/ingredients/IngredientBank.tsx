import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Ingredient } from "@/types";
import { DEFAULT_INGREDIENTS, MIN_INGREDIENTS_TO_SPIN } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Search } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface IngredientBankProps {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  userId: string;
}

const IngredientBank = ({
  ingredients,
  setIngredients,
  userId,
}: IngredientBankProps) => {
  const [newIngredient, setNewIngredient] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load ingredients from Supabase
  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const { data, error } = await supabase
          .from("ingredients")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setIngredients(
            data.map((i) => ({
              id: i.id,
              name: i.name,
              isUsed: i.is_used,
              usedBy: i.used_by || undefined,
              usedDate: i.used_date || undefined,
              createdBy: i.created_by || undefined,
            }))
          );
        } else {
          // Initialize with default ingredients
          const defaultIngredients: Ingredient[] = DEFAULT_INGREDIENTS.map(
            (name) => ({
              id: uuidv4(),
              name,
              isUsed: false,
            })
          );
          setIngredients(defaultIngredients);

          // Save defaults to database
          await Promise.all(
            defaultIngredients.map((i) =>
              supabase.from("ingredients").insert({
                id: i.id,
                name: i.name,
                is_used: false,
                created_by: userId,
              })
            )
          );
        }
      } catch (error) {
        console.error("Error loading ingredients:", error);
        // Fall back to default ingredients if there's an error
        setIngredients(
          DEFAULT_INGREDIENTS.map((name) => ({
            id: uuidv4(),
            name,
            isUsed: false,
          }))
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      loadIngredients();
    }
  }, [userId, setIngredients]);

  const availableIngredients = ingredients.filter((i) => !i.isUsed);
  const isFull = availableIngredients.length >= MIN_INGREDIENTS_TO_SPIN;

  const addIngredient = async () => {
    const trimmedName = newIngredient.trim();
    if (!trimmedName) return;

    // Check if already at capacity
    if (isFull) {
      toast.error("Ingredient bank is full! Remove an ingredient to add a new one.");
      return;
    }

    // Check for duplicates (case-insensitive)
    const exists = ingredients.some(
      (i) => i.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (exists) {
      toast.error("This ingredient already exists!");
      return;
    }

    const newItem: Ingredient = {
      id: uuidv4(),
      name: trimmedName,
      isUsed: false,
      createdBy: userId,
    };

    try {
      const { error } = await supabase.from("ingredients").insert({
        id: newItem.id,
        name: newItem.name,
        is_used: false,
        created_by: userId,
      });

      if (error) throw error;

      setIngredients((prev) => [...prev, newItem]);
      setNewIngredient("");
      toast.success(`Added "${trimmedName}" to your ingredient bank!`);
    } catch (error) {
      console.error("Error adding ingredient:", error);
      toast.error("Failed to add ingredient. Please try again.");
    }
  };

  const removeIngredient = async (id: string) => {
    const ingredient = ingredients.find((i) => i.id === id);
    if (!ingredient) return;

    if (ingredient.isUsed) {
      toast.error("Cannot remove an ingredient that's being used in an event!");
      return;
    }

    try {
      const { error } = await supabase.from("ingredients").delete().eq("id", id);

      if (error) throw error;

      setIngredients((prev) => prev.filter((i) => i.id !== id));
      toast.success(`Removed "${ingredient.name}" from your ingredient bank.`);
    } catch (error) {
      console.error("Error removing ingredient:", error);
      toast.error("Failed to remove ingredient. Please try again.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addIngredient();
    }
  };

  const filteredIngredients = ingredients.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const progress = Math.min(
    (availableIngredients.length / MIN_INGREDIENTS_TO_SPIN) * 100,
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
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Ingredient Bank</CardTitle>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {availableIngredients.length} / {MIN_INGREDIENTS_TO_SPIN} ingredients
            </span>
            <span>
              {availableIngredients.length >= MIN_INGREDIENTS_TO_SPIN
                ? "Ready to spin!"
                : `Need ${MIN_INGREDIENTS_TO_SPIN - availableIngredients.length} more`}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Ingredient */}
        {!isFull && (
          <div className="flex gap-2">
            <Input
              placeholder="Add a new ingredient..."
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button
              onClick={addIngredient}
              size="icon"
              className="bg-purple hover:bg-purple-dark shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Ingredient List */}
        <ScrollArea className="h-64">
          <div className="space-y-2 pr-4">
            {filteredIngredients.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No ingredients found
              </p>
            ) : (
              filteredIngredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    ingredient.isUsed
                      ? "bg-muted/50 border-muted"
                      : "bg-white border-border hover:border-purple/50"
                  }`}
                >
                  <span
                    className={`font-medium ${
                      ingredient.isUsed ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {ingredient.name}
                  </span>
                  {!ingredient.isUsed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeIngredient(ingredient.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {ingredient.isUsed && (
                    <span className="text-xs text-muted-foreground">In use</span>
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
