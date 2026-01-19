import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
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
import { Search, BookOpen } from "lucide-react";
import type { Recipe, Ingredient, RecipeNote, RecipeRatingsSummary } from "@/types";
import RecipeCard from "./RecipeCard";
import { getIngredientColor } from "@/lib/ingredientColors";

interface RecipeWithNotes extends Recipe {
  notes: RecipeNote[];
  ingredientName?: string;
  ingredientColor?: string;
  ratingSummary?: RecipeRatingsSummary;
}

const RecipeHub = () => {
  const [recipes, setRecipes] = useState<RecipeWithNotes[]>([]);
  const [usedIngredients, setUsedIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ingredientFilter, setIngredientFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadRecipes = async () => {
    try {
      // Load all recipes with their ingredient info (recipes now have event_id and ingredient_id directly)
      const { data: recipesData, error: recipesError } = await supabase
        .from("recipes")
        .select(`
          *,
          ingredients (name, color),
          profiles:created_by (name, avatar_url)
        `)
        .not("event_id", "is", null)
        .order("created_at", { ascending: false });

      if (recipesError) throw recipesError;

      // Load all notes for these recipes
      const recipeIds = recipesData?.map((r) => r.id) || [];
      const { data: notesData, error: notesError } = await supabase
        .from("recipe_notes")
        .select(`
          *,
          profiles (name, avatar_url)
        `)
        .in("recipe_id", recipeIds)
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;

      // Load all ratings for these recipes with user names
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("recipe_ratings")
        .select("recipe_id, overall_rating, would_cook_again, profiles:user_id (name)")
        .in("recipe_id", recipeIds);

      if (ratingsError) throw ratingsError;

      // Group notes by recipe
      const notesByRecipe = new Map<string, RecipeNote[]>();

      notesData?.forEach((n) => {
        const recipeId = n.recipe_id;
        if (!notesByRecipe.has(recipeId)) {
          notesByRecipe.set(recipeId, []);
        }
        notesByRecipe.get(recipeId)!.push({
          id: n.id,
          recipeId: n.recipe_id,
          userId: n.user_id,
          notes: n.notes || undefined,
          photos: n.photos || undefined,
          createdAt: n.created_at,
          userName: n.profiles?.name || "Unknown",
          userAvatar: n.profiles?.avatar_url || undefined,
        });
      });

      // Calculate rating summaries by recipe
      const ratingsByRecipe = new Map<string, RecipeRatingsSummary>();

      ratingsData?.forEach((rating) => {
        const recipeId = rating.recipe_id;
        const profile = rating.profiles as { name: string | null } | null;
        const userName = profile?.name || "?";
        const initial = userName.charAt(0).toUpperCase();

        if (!ratingsByRecipe.has(recipeId)) {
          ratingsByRecipe.set(recipeId, {
            recipeId,
            averageRating: 0,
            wouldCookAgainPercent: 0,
            totalRatings: 0,
            memberRatings: [],
          });
        }
        const summary = ratingsByRecipe.get(recipeId)!;
        summary.totalRatings++;
        summary.averageRating += rating.overall_rating;
        if (rating.would_cook_again) {
          summary.wouldCookAgainPercent++;
        }
        summary.memberRatings.push({
          initial,
          wouldCookAgain: rating.would_cook_again,
        });
      });

      // Finalize averages (entries only exist if they have ratings)
      ratingsByRecipe.forEach((summary) => {
        summary.averageRating = summary.averageRating / summary.totalRatings;
        summary.wouldCookAgainPercent = Math.round(
          (summary.wouldCookAgainPercent / summary.totalRatings) * 100
        );
      });

      // Build recipe list with notes and ratings
      const recipesWithNotes: RecipeWithNotes[] = (recipesData || []).map((r) => {
        const notes = notesByRecipe.get(r.id) || [];
        const ingredientName = r.ingredients?.name;
        const ingredientColor = r.ingredients?.color || (ingredientName ? getIngredientColor(ingredientName) : undefined);
        const creatorProfile = r.profiles as { name: string | null; avatar_url: string | null } | null;
        const ratingSummary = ratingsByRecipe.get(r.id);

        return {
          id: r.id,
          name: r.name,
          url: r.url || undefined,
          eventId: r.event_id || undefined,
          ingredientId: r.ingredient_id || undefined,
          createdBy: r.created_by || undefined,
          createdAt: r.created_at,
          createdByName: creatorProfile?.name || undefined,
          createdByAvatar: creatorProfile?.avatar_url || undefined,
          notes,
          ingredientName,
          ingredientColor,
          notesCount: notes.length,
          contributors: [...new Set(notes.map((n) => n.userName!))],
          ratingSummary,
        };
      });

      setRecipes(recipesWithNotes);
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

  // Filter recipes based on search and ingredient
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      searchTerm === "" ||
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.notes.some(
        (n) => n.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesIngredient =
      ingredientFilter === "all" ||
      recipe.ingredientId === ingredientFilter;

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
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchTerm || ingredientFilter !== "all"
                ? "No recipes found matching your search."
                : "No recipes yet. Recipes are added through events."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RecipeHub;
