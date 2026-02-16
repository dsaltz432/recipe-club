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
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, BookOpen, Plus } from "lucide-react";
import type { Recipe, Ingredient, RecipeNote, RecipeRatingsSummary } from "@/types";
import RecipeCard from "./RecipeCard";
import AddPersonalRecipeDialog from "./AddPersonalRecipeDialog";
import SharedWithMeSection from "./SharedWithMeSection";
import { getIngredientColor } from "@/lib/ingredientColors";

export interface RecipeWithNotes extends Recipe {
  notes: RecipeNote[];
  ingredientName?: string;
  ingredientColor?: string;
  ratingSummary?: RecipeRatingsSummary;
  isPersonal?: boolean;
  isSaved?: boolean;
}

type RecipeSubTab = "club" | "personal" | "shared";

interface RecipeHubProps {
  userId?: string;
  userEmail?: string;
  accessType?: "club" | "share_only";
}

const RecipeHub = ({ userId, userEmail, accessType = "club" }: RecipeHubProps) => {
  const [recipes, setRecipes] = useState<RecipeWithNotes[]>([]);
  const [usedIngredients, setUsedIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ingredientFilter, setIngredientFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [subTab, setSubTab] = useState<RecipeSubTab>(accessType === "share_only" ? "shared" : "club");
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(new Set());
  const [showAddPersonal, setShowAddPersonal] = useState(false);

  const loadSavedRecipeIds = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("saved_recipes")
        .select("recipe_id")
        .eq("user_id", userId);

      if (error) throw error;
      setSavedRecipeIds(new Set((data || []).map((r) => r.recipe_id)));
    } catch (error) {
      console.error("Error loading saved recipes:", error);
    }
  };

  const loadRecipes = async () => {
    try {
      if (subTab === "club") {
        await loadClubRecipes();
      } else {
        await loadPersonalRecipes();
      }
    } catch (error) {
      console.error("Error loading recipes:", error);
      toast.error("Failed to load recipes");
    } finally {
      setIsLoading(false);
    }
  };

  const loadClubRecipes = async () => {
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

    // Load notes and ratings in parallel (both depend on recipe IDs)
    const recipeIds = recipesData?.map((r) => r.id) || [];

    const [notesResult, ratingsResult] = await Promise.all([
      supabase
        .from("recipe_notes")
        .select(`
          *,
          profiles (name, avatar_url)
        `)
        .in("recipe_id", recipeIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("recipe_ratings")
        .select("recipe_id, overall_rating, would_cook_again, profiles:user_id (name)")
        .in("recipe_id", recipeIds)
    ]);

    if (notesResult.error) throw notesResult.error;
    if (ratingsResult.error) throw ratingsResult.error;

    const notesData = notesResult.data;
    const ratingsData = ratingsResult.data;

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
    const ratingsByRecipe = buildRatingSummaries(ratingsData || []);

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
        isPersonal: false,
        isSaved: savedRecipeIds.has(r.id),
      };
    });

    setRecipes(recipesWithNotes);
  };

  const loadPersonalRecipes = async () => {
    if (!userId) {
      setRecipes([]);
      return;
    }

    // Load personal recipes (created by user without event) + saved club recipes
    const [personalResult, savedResult] = await Promise.all([
      supabase
        .from("recipes")
        .select(`
          *,
          profiles:created_by (name, avatar_url)
        `)
        .is("event_id", null)
        .eq("created_by", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("saved_recipes")
        .select(`
          recipe_id,
          recipes (
            *,
            ingredients (name, color),
            profiles:created_by (name, avatar_url)
          )
        `)
        .eq("user_id", userId),
    ]);

    if (personalResult.error) throw personalResult.error;
    if (savedResult.error) throw savedResult.error;

    const allRecipeIds: string[] = [];

    // Build personal recipes
    const personalRecipes: RecipeWithNotes[] = (personalResult.data || []).map((r) => {
      const creatorProfile = r.profiles as { name: string | null; avatar_url: string | null } | null;
      allRecipeIds.push(r.id);
      return {
        id: r.id,
        name: r.name,
        url: r.url || undefined,
        eventId: undefined,
        ingredientId: undefined,
        createdBy: r.created_by || undefined,
        createdAt: r.created_at,
        createdByName: creatorProfile?.name || undefined,
        createdByAvatar: creatorProfile?.avatar_url || undefined,
        notes: [],
        isPersonal: true,
        isSaved: false,
      };
    });

    // Build saved club recipes (dedup against personal)
    const personalIds = new Set(personalRecipes.map((r) => r.id));
    const savedRecipes: RecipeWithNotes[] = [];

    (savedResult.data || []).forEach((sr) => {
      const r = sr.recipes as unknown as {
        id: string;
        name: string;
        url: string | null;
        event_id: string | null;
        ingredient_id: string | null;
        created_by: string | null;
        created_at: string;
        ingredients: { name: string; color: string | null } | null;
        profiles: { name: string | null; avatar_url: string | null } | null;
      };
      if (!r || personalIds.has(r.id)) return;

      const ingredientName = r.ingredients?.name;
      const ingredientColor = r.ingredients?.color || (ingredientName ? getIngredientColor(ingredientName) : undefined);
      allRecipeIds.push(r.id);

      savedRecipes.push({
        id: r.id,
        name: r.name,
        url: r.url || undefined,
        eventId: r.event_id || undefined,
        ingredientId: r.ingredient_id || undefined,
        createdBy: r.created_by || undefined,
        createdAt: r.created_at,
        createdByName: r.profiles?.name || undefined,
        createdByAvatar: r.profiles?.avatar_url || undefined,
        notes: [],
        ingredientName,
        ingredientColor,
        isPersonal: false,
        isSaved: true,
      });
    });

    // Load notes for all recipes
    if (allRecipeIds.length > 0) {
      const { data: notesData } = await supabase
        .from("recipe_notes")
        .select(`*, profiles (name, avatar_url)`)
        .in("recipe_id", allRecipeIds);

      if (notesData) {
        const notesByRecipe = new Map<string, RecipeNote[]>();
        notesData.forEach((n) => {
          if (!notesByRecipe.has(n.recipe_id)) {
            notesByRecipe.set(n.recipe_id, []);
          }
          notesByRecipe.get(n.recipe_id)!.push({
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

        [...personalRecipes, ...savedRecipes].forEach((recipe) => {
          recipe.notes = notesByRecipe.get(recipe.id) || [];
          recipe.notesCount = recipe.notes.length;
          recipe.contributors = [...new Set(recipe.notes.map((n) => n.userName!))];
        });
      }
    }

    setRecipes([...personalRecipes, ...savedRecipes]);
  };

  const buildRatingSummaries = (
    ratingsData: Array<{
      recipe_id: string;
      overall_rating: number;
      would_cook_again: boolean;
      profiles: { name: string | null } | null;
    }>
  ) => {
    const ratingsByRecipe = new Map<string, RecipeRatingsSummary>();

    ratingsData.forEach((rating) => {
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

    return ratingsByRecipe;
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
    loadSavedRecipeIds();
    loadUsedIngredients();
  }, [userId]);

  useEffect(() => {
    setIsLoading(true);
    loadRecipes();
  }, [subTab, savedRecipeIds]);

  const handleSaveToggle = (recipeId: string, saved: boolean) => {
    setSavedRecipeIds((prev) => {
      const next = new Set(prev);
      if (saved) {
        next.add(recipeId);
      } else {
        next.delete(recipeId);
      }
      return next;
    });
  };

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
      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
        {accessType !== "share_only" && (
          <>
            <Button
              variant={subTab === "club" ? "default" : "outline"}
              size="sm"
              onClick={() => setSubTab("club")}
              className={subTab === "club" ? "bg-purple hover:bg-purple-dark" : ""}
            >
              Club Recipes
            </Button>
            <Button
              variant={subTab === "personal" ? "default" : "outline"}
              size="sm"
              onClick={() => setSubTab("personal")}
              className={subTab === "personal" ? "bg-purple hover:bg-purple-dark" : ""}
            >
              My Recipes
            </Button>
          </>
        )}
        {userEmail && (
          <Button
            variant={subTab === "shared" ? "default" : "outline"}
            size="sm"
            onClick={() => setSubTab("shared")}
            className={subTab === "shared" ? "bg-purple hover:bg-purple-dark" : ""}
          >
            Shared with Me
          </Button>
        )}
      </div>

      {/* Shared with Me tab */}
      {subTab === "shared" && userEmail && (
        <SharedWithMeSection userEmail={userEmail} />
      )}

      {/* Club / Personal tab content */}
      {subTab !== "shared" && (
        <>
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

              {/* Ingredient Filter (only for club tab) */}
              {subTab === "club" && (
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
              )}
            </div>

            {/* Add Personal Recipe button */}
            {subTab === "personal" && userId && (
              <Button
                onClick={() => setShowAddPersonal(true)}
                className="bg-purple hover:bg-purple-dark"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
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
                    : subTab === "personal"
                    ? "No personal recipes yet. Add one or save a club recipe!"
                    : "No recipes yet. Recipes are added through events."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  userId={userId}
                  isSaved={savedRecipeIds.has(recipe.id)}
                  onSaveToggle={handleSaveToggle}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Personal Recipe Dialog */}
      {userId && (
        <AddPersonalRecipeDialog
          open={showAddPersonal}
          onOpenChange={setShowAddPersonal}
          userId={userId}
          onRecipeAdded={() => {
            setIsLoading(true);
            loadRecipes();
          }}
        />
      )}
    </div>
  );
};

export default RecipeHub;
