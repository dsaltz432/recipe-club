import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Plus, BookOpen } from "lucide-react";
import type { Recipe, Ingredient, RecipeContribution } from "@/types";
import RecipeCard from "./RecipeCard";
import AddRecipeForm from "./AddRecipeForm";

interface RecipeHubProps {
  userId: string;
  isAdmin?: boolean;
}

interface RecipeWithContributions extends Recipe {
  contributions: RecipeContribution[];
  ingredientName?: string;
}

const RecipeHub = ({ userId, isAdmin = false }: RecipeHubProps) => {
  const [recipes, setRecipes] = useState<RecipeWithContributions[]>([]);
  const [usedIngredients, setUsedIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ingredientFilter, setIngredientFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadRecipes = async () => {
    try {
      // Load all recipes
      const { data: recipesData, error: recipesError } = await supabase
        .from("recipes")
        .select("*")
        .order("created_at", { ascending: false });

      if (recipesError) throw recipesError;

      // Load all contributions with event and ingredient data
      const { data: contributionsData, error: contributionsError } = await supabase
        .from("recipe_contributions")
        .select(`
          *,
          profiles (name, avatar_url),
          scheduled_events (
            id,
            event_date,
            ingredient_id,
            ingredients (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (contributionsError) throw contributionsError;

      // Group contributions by recipe
      const contributionsByRecipe = new Map<string, RecipeContribution[]>();

      contributionsData?.forEach((c) => {
        const recipeId = c.recipe_id;
        if (!contributionsByRecipe.has(recipeId)) {
          contributionsByRecipe.set(recipeId, []);
        }
        contributionsByRecipe.get(recipeId)!.push({
          id: c.id,
          recipeId: c.recipe_id,
          userId: c.user_id || "",
          eventId: c.event_id || "",
          notes: c.notes || undefined,
          photos: c.photos || undefined,
          createdAt: c.created_at,
          userName: c.profiles?.name || "Unknown",
          userAvatar: c.profiles?.avatar_url || undefined,
          eventDate: c.scheduled_events?.event_date || undefined,
          ingredientName: c.scheduled_events?.ingredients?.name || undefined,
        });
      });

      // Build recipe list with contributions
      const recipesWithContributions: RecipeWithContributions[] = (recipesData || []).map((r) => {
        const contributions = contributionsByRecipe.get(r.id) || [];
        // Get the ingredient name from the first contribution (if any)
        const ingredientName = contributions[0]?.ingredientName;

        return {
          id: r.id,
          name: r.name,
          url: r.url || undefined,
          createdBy: r.created_by || undefined,
          createdAt: r.created_at,
          contributions,
          ingredientName,
          contributionCount: contributions.length,
          contributors: [...new Set(contributions.map((c) => c.userName))],
        };
      });

      // Only show recipes that have at least one contribution
      const recipesWithAtLeastOneContribution = recipesWithContributions.filter(
        (r) => r.contributions.length > 0
      );

      setRecipes(recipesWithAtLeastOneContribution);
    } catch (error) {
      console.error("Error loading recipes:", error);
      toast.error("Failed to load recipes");
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsedIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from("ingredients")
        .select("*")
        .gt("used_count", 0)
        .order("name");

      if (error) throw error;

      if (data) {
        setUsedIngredients(
          data.map((i) => ({
            id: i.id,
            name: i.name,
            usedCount: i.used_count,
            inBank: i.in_bank,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading ingredients:", error);
    }
  };

  useEffect(() => {
    loadRecipes();
    loadUsedIngredients();
  }, []);

  const handleRecipeAdded = () => {
    loadRecipes();
    setShowAddForm(false);
  };

  // Filter recipes based on search and ingredient
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      searchTerm === "" ||
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.contributions.some(
        (c) => c.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesIngredient =
      ingredientFilter === "all" ||
      recipe.contributions.some(
        (c) => c.ingredientName?.toLowerCase() === usedIngredients.find(
          (i) => i.id === ingredientFilter
        )?.name.toLowerCase()
      );

    return matchesSearch && matchesIngredient;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Add */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Ingredient Filter */}
          <Select value={ingredientFilter} onValueChange={setIngredientFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Ingredients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ingredients</SelectItem>
              {usedIngredients.map((ingredient) => (
                <SelectItem key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isAdmin && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-purple hover:bg-purple-dark"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Recipe
          </Button>
        )}
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchTerm || ingredientFilter !== "all"
                ? "No recipes found matching your search."
                : "No recipes yet. Add your first recipe!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} userId={userId} />
          ))}
        </div>
      )}

      {/* Add Recipe Form Dialog */}
      <AddRecipeForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        userId={userId}
        onRecipeAdded={handleRecipeAdded}
      />
    </div>
  );
};

export default RecipeHub;
