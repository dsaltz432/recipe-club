import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUser } from "@/lib/auth";
import type { User, Recipe, RecipeRatingsSummary } from "@/types";
import { useRecipeNotes } from "@/hooks/useRecipeNotes";
import { useGroceryList } from "@/hooks/useGroceryList";
import { supabase } from "@/integrations/supabase/client";
import { getCachedAiModel } from "@/lib/userPreferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeDetailTabs } from "@/components/shared/RecipeDetailTabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ParseProgressDialog from "@/components/mealplan/ParseProgressDialog";
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
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ChefHat,
  Calendar as CalendarIcon,
  BookOpen,
  Star,
  ShoppingCart,
} from "lucide-react";
import PhotoUpload from "@/components/recipes/PhotoUpload";
import AppHeader from "@/components/shared/AppHeader";
import EventRatingDialog from "@/components/events/EventRatingDialog";
import EventRecipesTab from "@/components/events/EventRecipesTab";
import type { EventRecipeWithRatings } from "@/components/events/EventRecipesTab";
import AddMealDialog from "@/components/mealplan/AddMealDialog";
import { saveRecipeEdit } from "@/lib/recipeActions";
import GroceryListSection from "@/components/recipes/GroceryListSection";
import PantrySection from "@/components/pantry/PantrySection";

interface PersonalEventData {
  eventId: string;
  eventDate: string;
  ingredientName?: string;
  status: "scheduled" | "completed";
  createdBy?: string;
  recipesWithNotes: EventRecipeWithRatings[];
}

const PersonalMealDetailPage = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [event, setEvent] = useState<PersonalEventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Add Meal dialog state
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);

  // Parse progress state
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "failed">("idle");
  const [pendingParseRecipeId, setPendingParseRecipeId] = useState<string | null>(null);
  const [pendingParseName, setPendingParseName] = useState<string>("");
  const [pendingParseUrl, setPendingParseUrl] = useState<string>("");
  const [parseStep, setParseStep] = useState<"saving" | "parsing" | "loading" | "done">("saving");

  // Edit Recipe state
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);
  const [editRecipeName, setEditRecipeName] = useState("");
  const [editRecipeUrl, setEditRecipeUrl] = useState("");
  const [isEditingRecipe, setIsEditingRecipe] = useState(false);

  // Note CRUD (shared hook)
  const {
    noteToEdit,
    setNoteToEdit,
    recipeForNewNote,
    setRecipeForNewNote,
    editNotes,
    setEditNotes,
    editPhotos,
    setEditPhotos,
    isUpdatingNote,
    noteToDelete,
    setNoteToDelete,
    deletingNoteId,
    handleEditNoteClick,
    handleAddNotesClick,
    handleSaveNote,
    handleDeleteClick,
    handleConfirmDelete,
  } = useRecipeNotes({
    userId: user?.id,
    onNoteChanged: () => loadEventData(),
  });

  // Delete recipe state
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);

  // Rating dialog state
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratingRecipes, setRatingRecipes] = useState<EventRecipeWithRatings[] | null>(null);

  // Cooked state
  const [mealItems, setMealItems] = useState<Array<{ id: string; recipe_id: string; cooked_at: string | null; day_of_week: number; meal_type: string; plan_id: string }>>([]);

  // Notes expansion state
  const [expandedRecipeNotes, setExpandedRecipeNotes] = useState<Set<string>>(new Set());

  // Grocery list hook
  const groceryRecipeIds = useMemo(
    () => event?.recipesWithNotes.map((r) => r.recipe.id) ?? [],
    [event?.recipesWithNotes]
  );
  const groceryRecipes = useMemo(
    () => event?.recipesWithNotes.map((r) => r.recipe) ?? [],
    [event?.recipesWithNotes]
  );

  const grocery = useGroceryList({
    contextType: "event",
    contextId: eventId,
    userId: user?.id,
    recipeIds: groceryRecipeIds,
    recipes: groceryRecipes,
    enabled: !!event,
    supportsGeneralItems: true,
  });

  const handlePantryChange = () => {
    grocery.refreshGroceries();
  };

  const toggleRecipeNotes = (recipeId: string) => {
    setExpandedRecipeNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId);
      } else {
        newSet.add(recipeId);
      }
      return newSet;
    });
  };

  const isCooked = mealItems.length > 0 && mealItems.every((item) => item.cooked_at);

  const loadEventData = async () => {
    if (!eventId) return;

    try {
      const { data: eventData, error: eventError } = await supabase
        .from("scheduled_events")
        .select("*")
        .eq("id", eventId)
        .eq("type", "personal")
        .single();

      if (eventError || !eventData) {
        setNotFound(true);
        return;
      }

      // Load meal plan items linked to this event to find associated recipes
      const { data: mealItemsData } = await supabase
        .from("meal_plan_items")
        .select("*")
        // event_id column added by migration; use .or() to bypass generated types
        .or(`event_id.eq.${eventId}`);

      const mealItemsList = (mealItemsData || []).map((m) => {
        const row = m as Record<string, unknown>;
        return {
          id: row.id as string,
          recipe_id: row.recipe_id as string,
          cooked_at: row.cooked_at as string | null,
          day_of_week: row.day_of_week as number,
          meal_type: row.meal_type as string,
          plan_id: row.plan_id as string,
        };
      });
      setMealItems(mealItemsList);

      const linkedRecipeIds = mealItemsList
        .map((m) => m.recipe_id)
        .filter((id): id is string => !!id);

      // Load recipes: directly linked to this event OR referenced by meal plan items
      let orFilter = `event_id.eq.${eventId}`;
      if (linkedRecipeIds.length > 0) {
        orFilter += `,id.in.(${linkedRecipeIds.join(",")})`;
      }

      const { data: recipesData, error: recipesError } = await supabase
        .from("recipes")
        .select("*, profiles:created_by (name, avatar_url)")
        .or(orFilter)
        .order("created_at", { ascending: true });

      if (recipesError) throw recipesError;

      // Load notes for all recipes
      const recipeIds = recipesData?.map((r) => r.id) || [];
      let notesData: Array<{
        id: string;
        recipe_id: string;
        user_id: string;
        notes: string | null;
        photos: string[] | null;
        created_at: string;
        profiles: { name: string | null; avatar_url: string | null } | null;
      }> = [];

      if (recipeIds.length > 0) {
        const { data, error: notesError } = await supabase
          .from("recipe_notes")
          .select("*, profiles (name, avatar_url)")
          .in("recipe_id", recipeIds);

        if (notesError) throw notesError;
        notesData = data || [];
      }

      // Load ratings
      let ratingsData: Array<{
        recipe_id: string;
        overall_rating: number;
        would_cook_again: boolean;
        profiles: { name: string | null } | null;
      }> = [];

      if (recipeIds.length > 0) {
        const { data, error: ratingsError } = await supabase
          .from("recipe_ratings")
          .select("recipe_id, overall_rating, would_cook_again, profiles:user_id (name)")
          .in("recipe_id", recipeIds);

        if (ratingsError) throw ratingsError;
        ratingsData = data || [];
      }

      // Calculate rating summaries
      const ratingsByRecipe = new Map<string, RecipeRatingsSummary>();
      ratingsData.forEach((rating) => {
        const rid = rating.recipe_id;
        const userName = rating.profiles?.name || "?";
        const initial = userName.charAt(0).toUpperCase();

        if (!ratingsByRecipe.has(rid)) {
          ratingsByRecipe.set(rid, {
            recipeId: rid,
            averageRating: 0,
            wouldCookAgainPercent: 0,
            totalRatings: 0,
            memberRatings: [],
          });
        }
        const summary = ratingsByRecipe.get(rid)!;
        summary.totalRatings++;
        summary.averageRating += rating.overall_rating;
        if (rating.would_cook_again) {
          summary.wouldCookAgainPercent++;
        }
        summary.memberRatings.push({ initial, wouldCookAgain: rating.would_cook_again });
      });

      ratingsByRecipe.forEach((summary) => {
        if (summary.totalRatings > 0) {
          summary.averageRating = summary.averageRating / summary.totalRatings;
          summary.wouldCookAgainPercent = Math.round(
            (summary.wouldCookAgainPercent / summary.totalRatings) * 100
          );
        }
      });

      const recipesWithNotes: EventRecipeWithRatings[] = (recipesData || []).map((recipe) => {
        const recipeNotes = notesData
          .filter((n) => n.recipe_id === recipe.id)
          .map((n) => ({
            id: n.id,
            recipeId: n.recipe_id,
            userId: n.user_id,
            notes: n.notes || undefined,
            photos: n.photos || undefined,
            createdAt: n.created_at,
            userName: n.profiles?.name || "Unknown",
            userAvatar: n.profiles?.avatar_url || undefined,
          }));

        const creatorProfile = recipe.profiles as { name: string | null; avatar_url: string | null } | null;
        const ratingSummary = ratingsByRecipe.get(recipe.id);

        return {
          recipe: {
            id: recipe.id,
            name: recipe.name,
            url: recipe.url || undefined,
            eventId: recipe.event_id || undefined,
            createdBy: recipe.created_by || undefined,
            createdAt: recipe.created_at,
            createdByName: creatorProfile?.name || undefined,
            createdByAvatar: creatorProfile?.avatar_url || undefined,
          },
          notes: recipeNotes,
          ratingSummary,
        };
      });

      const mealName = recipesWithNotes.length > 0
        ? recipesWithNotes.map(r => r.recipe.name).join(", ")
        : "Personal Meal";

      setEvent({
        eventId: eventData.id,
        eventDate: eventData.event_date,
        ingredientName: mealName,
        status: eventData.status as "scheduled" | "completed",
        createdBy: eventData.created_by || undefined,
        recipesWithNotes,
      });
    } catch (error) {
      console.error("Error loading personal event:", error);
      setNotFound(true);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      await loadEventData();
      setIsLoading(false);
    };

    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Derive dayOfWeek and mealType from the first meal_plan_item (all items in this event share the same slot)
  const slotDayOfWeek = mealItems.length > 0 ? mealItems[0].day_of_week : 0;
  const slotMealType = mealItems.length > 0 ? mealItems[0].meal_type : "dinner";
  const slotPlanId = mealItems.length > 0 ? mealItems[0].plan_id : null;

  const handleAddCustomMeal = async (name: string, url?: string, shouldParse?: boolean) => {
    if (!user?.id || !event) return;

    try {
      // Create recipe linked to this event
      const { data: insertedRecipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          name,
          url: url || null,
          event_id: event.eventId,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (recipeError) throw recipeError;

      // Create a meal_plan_item linking to this event
      if (slotPlanId) {
        const { data: newItem } = await supabase
          .from("meal_plan_items")
          .insert({
            plan_id: slotPlanId,
            day_of_week: slotDayOfWeek,
            meal_type: slotMealType,
            recipe_id: insertedRecipe.id,
            sort_order: mealItems.length,
          })
          .select("id")
          .single();

        // Link item to event (event_id column not in generated types)
        if (newItem) {
          await supabase
            .from("meal_plan_items")
            .update({ event_id: event.eventId } as Record<string, unknown>)
            .eq("id", newItem.id);
        }
      }

      if (shouldParse && url) {
        setPendingParseRecipeId(insertedRecipe.id);
        setPendingParseName(name);
        setPendingParseUrl(url);
        setParseStatus("parsing");
      } else {
        toast.success("Recipe added!");
      }

      loadEventData();
      grocery.refreshGroceries();
    } catch (error) {
      console.error("Error adding custom meal:", error);
      toast.error("Failed to add meal");
    }
  };

  const handleAddRecipeMeal = async (recipes: Array<{ id: string; name: string; url?: string }>) => {
    if (!user?.id || !event) return;

    try {
      for (const recipe of recipes) {
        // Link existing recipe to this event
        await supabase
          .from("recipes")
          .update({ event_id: event.eventId })
          .eq("id", recipe.id);

        // Create a meal_plan_item linking to this event
        if (slotPlanId) {
          const { data: newItem } = await supabase
            .from("meal_plan_items")
            .insert({
              plan_id: slotPlanId,
              day_of_week: slotDayOfWeek,
              meal_type: slotMealType,
              recipe_id: recipe.id,
              sort_order: mealItems.length,
            })
            .select("id")
            .single();

          // Link item to event (event_id column not in generated types)
          if (newItem) {
            await supabase
              .from("meal_plan_items")
              .update({ event_id: event.eventId } as Record<string, unknown>)
              .eq("id", newItem.id);
          }
        }
      }

      toast.success(`Added ${recipes.length} recipe${recipes.length !== 1 ? "s" : ""} to meal`);
      loadEventData();
      grocery.refreshGroceries();
    } catch (error) {
      console.error("Error adding recipes to meal:", error);
      toast.error("Failed to add recipes");
    }
  };

  const handleAddManualMeal = async (name: string, text: string) => {
    if (!user?.id || !event) return;

    let insertedRecipeId: string | null = null;

    try {
      const { data: insertedRecipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          name,
          url: null,
          event_id: event.eventId,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (recipeError) throw recipeError;
      insertedRecipeId = insertedRecipe.id;

      // Create meal_plan_item
      if (slotPlanId) {
        const { data: newItem } = await supabase
          .from("meal_plan_items")
          .insert({
            plan_id: slotPlanId,
            day_of_week: slotDayOfWeek,
            meal_type: slotMealType,
            recipe_id: insertedRecipe.id,
            sort_order: mealItems.length,
          })
          .select("id")
          .single();

        if (newItem) {
          await supabase
            .from("meal_plan_items")
            .update({ event_id: event.eventId } as Record<string, unknown>)
            .eq("id", newItem.id);
        }
      }

      // Parse ingredients via unified parse-recipe (handles DB saves internally)
      if (text.trim()) {
        const { data, error } = await supabase.functions.invoke("parse-recipe", {
          body: { recipeId: insertedRecipe.id, recipeName: name, text, model: getCachedAiModel() },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error ?? "Failed to parse ingredients");
      }

      toast.success("Recipe added!");
      loadEventData();
      grocery.refreshGroceries();
    } catch (error) {
      if (insertedRecipeId) {
        await supabase.from("meal_plan_items").delete().eq("recipe_id", insertedRecipeId);
        await supabase.from("recipes").delete().eq("id", insertedRecipeId);
      }
      console.error("Error adding manual meal:", error);
      toast.error("Failed to add meal");
    }
  };

  // Execute parse when parseStatus transitions to "parsing"
  useEffect(() => {
    if (parseStatus !== "parsing" || !pendingParseRecipeId) return;

    const doParse = async () => {
      try {
        setParseStep("saving");
        await new Promise(resolve => setTimeout(resolve, 200));

        setParseStep("parsing");
        const { data: parseData, error } = await supabase.functions.invoke("parse-recipe", {
          body: {
            recipeId: pendingParseRecipeId,
            recipeUrl: pendingParseUrl,
            recipeName: pendingParseName,
            model: getCachedAiModel(),
          },
        });
        if (error) throw error;
        if (!parseData?.success) throw new Error(parseData?.error ?? "Failed to parse recipe");

        setParseStep("loading");
        loadEventData();
        grocery.refreshGroceries();

        setParseStep("done");
        await new Promise(resolve => setTimeout(resolve, 2500));

        setParseStatus("idle");
        setPendingParseRecipeId(null);
        setPendingParseName("");
        setPendingParseUrl("");
        setParseStep("saving");
        toast.success("Recipe parsed successfully!");
      } catch (error) {
        console.error("Error parsing recipe:", error);
        setParseStatus("failed");
      }
    };

    doParse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseStatus, pendingParseRecipeId]);

  const handleParseRetry = () => {
    setParseStep("saving");
    setParseStatus("parsing");
  };

  const handleParseKeep = () => {
    setParseStatus("idle");
    setPendingParseRecipeId(null);
    setPendingParseName("");
    setPendingParseUrl("");
    setParseStep("saving");
    toast.success("Recipe saved without parsing");
  };

  const handleParseDiscard = async () => {
    if (pendingParseRecipeId) {
      await supabase.from("meal_plan_items").delete().eq("recipe_id", pendingParseRecipeId);
      await supabase.from("recipes").delete().eq("id", pendingParseRecipeId);
      loadEventData();
    }
    setParseStatus("idle");
    setPendingParseRecipeId(null);
    setPendingParseName("");
    setPendingParseUrl("");
    setParseStep("saving");
    toast.success("Recipe discarded");
  };

  const handleEditRecipeClick = (recipe: Recipe) => {
    setRecipeToEdit(recipe);
    setEditRecipeName(recipe.name);
    setEditRecipeUrl(recipe.url || "");
  };

  const handleSaveRecipeEdit = async () => {
    if (!recipeToEdit || !editRecipeName.trim()) {
      toast.error("Please enter a recipe name");
      return;
    }

    setIsEditingRecipe(true);
    try {
      const result = await saveRecipeEdit(
        recipeToEdit.id,
        editRecipeName,
        editRecipeUrl,
        recipeToEdit.url || ""
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Recipe updated!");
      setRecipeToEdit(null);
      loadEventData();
    } catch (error) {
      console.error("Error updating recipe:", error);
      toast.error("Failed to update recipe");
    } finally {
      setIsEditingRecipe(false);
    }
  };

  const handleDeleteRecipeClick = (recipe: Recipe) => {
    setRecipeToDelete(recipe);
  };

  const handleConfirmDeleteRecipe = async () => {
    if (!recipeToDelete) return;
    try {
      // Delete the meal_plan_item that links to this recipe (not the recipe itself)
      await supabase
        .from("meal_plan_items")
        .delete()
        .eq("recipe_id", recipeToDelete.id);

      // Unlink the recipe from this event so it stays in "My Recipes"
      const { error } = await supabase
        .from("recipes")
        .update({ event_id: null })
        .eq("id", recipeToDelete.id);
      if (error) throw error;
      setRecipeToDelete(null);
      toast.success("Recipe removed from meal");
      loadEventData();
    } catch (error) {
      console.error("Error removing recipe from meal:", error);
      toast.error("Failed to remove recipe");
      setRecipeToDelete(null);
    }
  };

  const handleRateRecipe = (recipeWithRatings: EventRecipeWithRatings) => {
    setRatingRecipes([recipeWithRatings]);
    setShowRatingDialog(true);
  };

  const handleRatingsSubmitted = async () => {
    const count = ratingRecipes?.length ?? 0;
    const label = count === 1 ? "Recipe rated" : "Recipes rated";
    setShowRatingDialog(false);
    setRatingRecipes(null);
    // Auto-mark meal as cooked after rating
    if (!isCooked && mealItems.length > 0) {
      try {
        const { error } = await supabase
          .from("meal_plan_items")
          .update({ cooked_at: new Date().toISOString() } as Record<string, unknown>)
          .or(`event_id.eq.${eventId}`);

        if (error) throw error;
        setMealItems((prev) => prev.map((item) => ({ ...item, cooked_at: new Date().toISOString() })));
        toast.success(`${label}!`);
      } catch (error) {
        console.error("Error marking as cooked after rating:", error);
        toast.success(`${label}!`);
      }
    } else {
      toast.success(`${label}!`);
    }
    loadEventData();
  };

  const totalRecipes = event?.recipesWithNotes.length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30">
        <div className="container mx-auto px-4 py-6 space-y-4">
          <div className="rounded-lg border bg-white/80 p-6 space-y-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/meals")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Meals
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ChefHat className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Meal Not Found</h2>
              <p className="text-muted-foreground text-center">
                This meal event doesn't exist or has been removed.
              </p>
              <Button className="mt-4" onClick={() => navigate("/dashboard/meals")}>
                Go to Meals
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30">
      <AppHeader
        user={user}
        back={{
          label: "Meals",
          onClick: () => window.history.state?.idx > 0 ? navigate(-1) : navigate("/dashboard/meals"),
        }}
        title={
          <div className="flex items-center gap-2 min-w-0">
            <ChefHat className="h-5 w-5 shrink-0 text-purple" />
            <h1 className="font-display text-base sm:text-xl md:text-2xl font-bold truncate text-purple">
              Meal Details
            </h1>
          </div>
        }
      />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl space-y-4 sm:space-y-6">
        {/* Event Info */}
        <Card className="backdrop-blur-sm border-2 shadow-md bg-white/90 border-purple/10">
          <CardContent className="py-3 sm:py-6 px-3 sm:px-6">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-muted-foreground">
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-purple/5">
                  <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple" />
                  <span className="font-medium">
                    {event && format(parseISO(event.eventDate), "EEE, MMM d, yyyy")}
                  </span>
                </div>
                <span className="text-xs text-white px-2 py-0.5 rounded-full font-medium bg-purple/60">
                  Personal
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>
                    <strong className="text-orange">{totalRecipes}</strong> recipe{totalRecipes !== 1 ? "s" : ""}
                  </span>
                </div>
                {mealItems.length > 0 && totalRecipes > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRatingDialog(true)}
                    className="text-xs border-purple/30 text-purple hover:bg-purple/5 px-2 sm:px-3"
                  >
                    <Star className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Rate Recipes</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <RecipeDetailTabs
          recipesContent={
            <EventRecipesTab
              recipesWithNotes={event?.recipesWithNotes || []}
              user={user}
              userIsAdmin={true}
              expandedRecipeNotes={expandedRecipeNotes}
              deletingNoteId={deletingNoteId}
              onToggleRecipeNotes={toggleRecipeNotes}
              onAddRecipeClick={() => setShowAddMealDialog(true)}
              onEditRecipeClick={handleEditRecipeClick}
              onAddNotesClick={handleAddNotesClick}
              onEditNoteClick={handleEditNoteClick}
              onDeleteNoteClick={handleDeleteClick}
              onDeleteRecipeClick={handleDeleteRecipeClick}
              onRateRecipe={handleRateRecipe}
              userId={user?.id}
              onIngredientsChange={() => grocery.markIngredientChange()}
              cacheContext={{ type: "event", id: eventId ?? "", userId: user?.id ?? "" }}
              pantryItems={grocery.pantryItems}
            />
          }
          groceryContent={
            event && event.recipesWithNotes.length > 0 ? (
              <GroceryListSection
                recipes={event.recipesWithNotes.map((r) => r.recipe)}
                recipeIngredients={grocery.recipeIngredients}
                recipeContentMap={grocery.recipeContentMap}
                onParseRecipe={grocery.handleParseRecipe}
                eventName={event.ingredientName || "Meal"}
                isLoading={grocery.isLoading}
                pantryItems={grocery.pantryItems}
                smartGroceryItems={grocery.smartGroceryItems}
                isCombining={grocery.isCombining}
                combineError={grocery.combineError}
                perRecipeItems={grocery.perRecipeItems}
                checkedItems={grocery.checkedItems}
                onToggleChecked={grocery.handleToggleChecked}
                onEditItemText={grocery.handleEditItemText}
                onRemoveItem={grocery.handleRemoveItem}
                onAddItemsToRecipe={grocery.handleAddItemsToRecipe}
                hasPendingChanges={grocery.hasPendingChanges}
                onRecombine={grocery.triggerRecombine}
                generalItems={grocery.generalItems}
                onAddGeneralItemDirect={grocery.handleAddGeneralItemDirect}
                onBulkParseGroceryText={grocery.handleBulkParseGroceryText}
                isAddingGeneral={grocery.isAddingGeneral}
                onAddingGeneralChange={grocery.setIsAddingGeneral}
              />
            ) : (
              <Card className="bg-white/90 backdrop-blur-sm border-2 border-dashed border-purple/20">
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center text-sm sm:text-base">
                    Add recipes first to generate a grocery list.
                  </p>
                </CardContent>
              </Card>
            )
          }
          pantryContent={<PantrySection userId={user?.id} onPantryChange={handlePantryChange} />}
        />
      </main>

      {/* Add Meal Dialog */}
      <AddMealDialog
        open={showAddMealDialog}
        onOpenChange={(open) => { if (!open) setShowAddMealDialog(false); }}
        dayOfWeek={slotDayOfWeek}
        mealType={slotMealType}
        onAddCustomMeal={handleAddCustomMeal}
        onAddRecipeMeal={handleAddRecipeMeal}
        onAddManualMeal={handleAddManualMeal}
      />

      {/* Parse progress dialog */}
      <ParseProgressDialog
        parseStatus={parseStatus}
        parseStep={parseStep}
        recipeName={pendingParseName}
        onDiscard={handleParseDiscard}
        onKeep={handleParseKeep}
        onRetry={handleParseRetry}
      />

      {/* Edit Recipe Dialog */}
      <Dialog
        open={!!recipeToEdit}
        onOpenChange={(open) => {
          if (!open) setRecipeToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Recipe</DialogTitle>
            <DialogDescription>Update the recipe details.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-recipe-name">Recipe Name *</Label>
              <Input
                id="edit-recipe-name"
                value={editRecipeName}
                onChange={(e) => setEditRecipeName(e.target.value)}
                placeholder="Recipe name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-recipe-url">Recipe URL</Label>
              <Input
                id="edit-recipe-url"
                type="url"
                value={editRecipeUrl}
                onChange={(e) => setEditRecipeUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRecipeToEdit(null)} disabled={isEditingRecipe}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRecipeEdit}
              disabled={isEditingRecipe || !editRecipeName.trim()}
              className="bg-purple hover:bg-purple-dark"
            >
              {isEditingRecipe ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Note Dialog */}
      <Dialog
        open={!!noteToEdit || !!recipeForNewNote}
        onOpenChange={(open) => {
          if (!open) {
            setNoteToEdit(null);
            setRecipeForNewNote(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {noteToEdit ? "Edit Notes" : "Add Notes"}
            </DialogTitle>
            <DialogDescription>
              {recipeForNewNote
                ? `Add your notes and photos for "${recipeForNewNote.name}"`
                : "Update your notes and photos."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes / Variations</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Any special tips or variations?"
                rows={3}
              />
            </div>
            <PhotoUpload photos={editPhotos} onPhotosChange={setEditPhotos} />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNoteToEdit(null);
                setRecipeForNewNote(null);
              }}
              disabled={isUpdatingNote}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              disabled={isUpdatingNote}
              className="bg-purple hover:bg-purple-dark"
            >
              {isUpdatingNote ? "Saving..." : recipeForNewNote ? "Add Notes" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Notes Confirmation */}
      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your notes? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Recipe from Meal Confirmation */}
      <AlertDialog open={!!recipeToDelete} onOpenChange={(open) => !open && setRecipeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from meal?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{recipeToDelete?.name}&quot; from this meal? The recipe will still be available in your personal recipes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteRecipe}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Rating Dialog */}
      {showRatingDialog && event && (
        <EventRatingDialog
          event={event}
          recipes={ratingRecipes || event.recipesWithNotes}
          userId={user?.id || ""}
          onComplete={handleRatingsSubmitted}
          onCancel={() => { setShowRatingDialog(false); setRatingRecipes(null); }}
          mode="rating"
        />
      )}
    </div>
  );
};

export default PersonalMealDetailPage;
