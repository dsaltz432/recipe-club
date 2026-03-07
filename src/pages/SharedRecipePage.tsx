import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, BookOpen, Loader2, ChefHat, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { signInWithGoogle } from "@/lib/auth";
import { isDevMode } from "@/lib/devMode";
import type { GroceryCategory } from "@/types";
import RecipeIngredientList from "@/components/recipes/RecipeIngredientList";
import {
  getLightBackgroundColor,
  getBorderColor,
  getDarkerTextColor,
  getIngredientColor,
} from "@/lib/ingredientColors";

interface SharedRecipe {
  id: string;
  name: string;
  url?: string;
  createdBy?: string;
  createdByName?: string;
  createdByAvatar?: string;
  ingredientName?: string;
  ingredientColor?: string;
}

const SharedRecipePage = () => {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<SharedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [alreadyInCollection, setAlreadyInCollection] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  useEffect(() => {
    // Initial check
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
      setIsAuthLoading(false);
    });

    // Also subscribe so we catch the session being established after OAuth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!recipeId) return;

    const loadRecipe = async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select(`
          id, name, url, created_by,
          profiles:created_by (name, avatar_url),
          ingredients (name, color)
        `)
        .eq("id", recipeId)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        const creator = data.profiles as { name: string | null; avatar_url: string | null } | null;
        const ingredient = data.ingredients as { name: string; color: string | null } | null;
        const ingredientColor =
          ingredient?.color || (ingredient?.name ? getIngredientColor(ingredient.name) : undefined);

        setRecipe({
          id: data.id,
          name: data.name,
          url: data.url || undefined,
          createdBy: data.created_by || undefined,
          createdByName: creator?.name || undefined,
          createdByAvatar: creator?.avatar_url || undefined,
          ingredientName: ingredient?.name,
          ingredientColor,
        });
      }
      setIsLoading(false);
    };

    loadRecipe();
  }, [recipeId]);

  useEffect(() => {
    if (!currentUserId || !recipe || currentUserId === recipe.createdBy) return;
    supabase
      .from("recipes")
      .select("*", { count: "exact", head: true })
      .eq("created_by", currentUserId)
      .ilike("name", recipe.name)
      .then(({ count }) => {
        if (count && count > 0) setAlreadyInCollection(true);
      });
  }, [currentUserId, recipe]);

  const handleSignIn = async () => {
    if (isDevMode()) {
      sessionStorage.setItem("postLoginRedirect", window.location.pathname);
      navigate("/");
      return;
    }
    // On prod: go straight to Google OAuth, redirect back to this page after auth
    await signInWithGoogle(false, window.location.origin + window.location.pathname);
  };

  const handleAddClick = async () => {
    if (!currentUserId || !recipe) return;
    const { count } = await supabase
      .from("recipes")
      .select("*", { count: "exact", head: true })
      .eq("created_by", currentUserId)
      .ilike("name", recipe.name);
    if (count && count > 0) {
      setShowDuplicateWarning(true);
    } else {
      await handleAddToCollection();
    }
  };

  const handleAddToCollection = async () => {
    if (!currentUserId || !recipe) return;
    setIsAdding(true);
    try {
      const { data: newRecipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({ name: recipe.name, url: recipe.url || null, created_by: currentUserId })
        .select("id")
        .single();

      if (recipeError) throw recipeError;

      // Copy parsed ingredients to the new recipe
      const { data: ingredients } = await supabase
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipe.id)
        .order("sort_order");

      if (ingredients && ingredients.length > 0) {
        await supabase.from("recipe_ingredients").insert(
          ingredients.map((ing, idx) => ({
            recipe_id: newRecipe.id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            category: ing.category as GroceryCategory,
            sort_order: idx,
          }))
        );
      }

      setAlreadyInCollection(true);
      toast.success("Recipe added to your collection!");
    } catch (error) {
      console.error("Error adding recipe:", error);
      toast.error("Failed to add recipe");
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple" />
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Recipe not found</h1>
        <p className="text-muted-foreground text-center">
          This recipe link may be invalid or the recipe has been removed.
        </p>
        <Link to="/">
          <Button variant="outline">Go to Recipe Club</Button>
        </Link>
      </div>
    );
  }

  const bgColor = recipe.ingredientColor ? getLightBackgroundColor(recipe.ingredientColor) : undefined;
  const borderColor = recipe.ingredientColor ? getBorderColor(recipe.ingredientColor) : undefined;
  const themeColor = recipe.ingredientColor ? getDarkerTextColor(recipe.ingredientColor) : "#9b87f5";

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      {/* Minimal header */}
      <header className="px-6 py-4 flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-purple" />
        <span className="font-display font-semibold text-sm text-purple tracking-tight">Recipe Club</span>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-12 pt-2">
        {/* Single unified card */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg border"
          style={{ borderColor: borderColor || "rgba(155,135,245,0.25)" }}
        >
          {/* Colored accent bar */}
          <div className="h-1.5" style={{ backgroundColor: themeColor }} />

          {/* Recipe hero section */}
          <div className="px-6 pt-6 pb-5" style={{ backgroundColor: bgColor || "white" }}>
            {/* "X shared this with you" attribution */}
            {recipe.createdByName && currentUserId !== recipe.createdBy && (
              <div className="flex items-center gap-2 mb-4">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={recipe.createdByAvatar} />
                  <AvatarFallback style={{ backgroundColor: themeColor, color: "white", fontSize: "9px" }}>
                    {recipe.createdByName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium" style={{ color: themeColor }}>{recipe.createdByName}</span>
                  {" "}shared a recipe with you
                </span>
              </div>
            )}

            {/* Recipe name + external link */}
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">{recipe.name}</h1>
              {recipe.url && (
                <a
                  href={recipe.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-black/5 shrink-0 mt-0.5"
                  aria-label="Open original recipe"
                >
                  <ExternalLink className="h-4 w-4" style={{ color: themeColor }} />
                </a>
              )}
            </div>

          </div>

          {/* CTA section */}
          <div
            className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-b"
            style={{ borderColor: borderColor || "rgba(155,135,245,0.15)", backgroundColor: "white" }}
          >
            {isAuthLoading ? (
              <div className="w-full flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !currentUserId ? (
              <>
                <p className="text-sm text-muted-foreground">Save this recipe to your collection.</p>
                <Button className="bg-purple hover:bg-purple-dark shrink-0 w-full sm:w-auto" onClick={handleSignIn}>
                  Sign in to Recipe Club
                </Button>
              </>
            ) : (currentUserId === recipe.createdBy || alreadyInCollection) ? (
              <div className="w-full flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Saved in your collection</span>
                </div>
                <Link to="/dashboard/recipes" className="shrink-0">
                  <Button variant="outline" className="w-full sm:w-auto">Go to My Recipes</Button>
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Want to cook this? Save it to your collection.</p>
                <Button
                  onClick={handleAddClick}
                  disabled={isAdding}
                  className="bg-purple hover:bg-purple-dark shrink-0 w-full sm:w-auto"
                >
                  {isAdding ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</>
                  ) : (
                    "Add to My Recipes"
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Ingredients section */}
          <div className="px-6 py-5" style={{ backgroundColor: bgColor || "white" }}>
            <h2
              className="text-[11px] font-semibold uppercase tracking-widest mb-4"
              style={{ color: themeColor }}
            >
              Ingredients
            </h2>
            <RecipeIngredientList recipeId={recipe.id} userId="" editable={false} />
          </div>
        </div>
      </main>

      <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recipe already in your collection</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a recipe called &quot;{recipe?.name}&quot;. Add it anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple hover:bg-purple-dark"
              onClick={() => {
                setShowDuplicateWarning(false);
                handleAddToCollection();
              }}
            >
              Add Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SharedRecipePage;
