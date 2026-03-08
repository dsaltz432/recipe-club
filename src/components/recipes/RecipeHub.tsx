import { useState, useEffect } from "react";
import { getCachedAiModel } from "@/lib/userPreferences";
import { useRecipeParse } from "@/hooks/useRecipeParse";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Search, BookOpen, Loader2, SlidersHorizontal, Plus } from "lucide-react";
import PhotoUpload from "./PhotoUpload";
import ParseProgressDialog from "@/components/mealplan/ParseProgressDialog";
import RecipeInputForm, {
  createInitialFormData,
  canSubmitRecipeForm,
  type RecipeFormData,
} from "./RecipeInputForm";
import type { Recipe, Ingredient, RecipeNote, RecipeRatingsSummary, RecipeIngredient, RecipeContent, GroceryCategory } from "@/types";
import RecipeCard from "./RecipeCard";
import EventRatingDialog from "@/components/events/EventRatingDialog";
import { getIngredientColor } from "@/lib/ingredientColors";
import { getPantryItems, DEFAULT_PANTRY_ITEMS } from "@/lib/pantry";
import { saveRecipeEdit } from "@/lib/recipeActions";

export interface RecipeWithNotes extends Recipe {
  notes: RecipeNote[];
  ingredientName?: string;
  ingredientColor?: string;
  ratingSummary?: RecipeRatingsSummary;
  isPersonal?: boolean;
}

interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  raw_text: string | null;
  sort_order: number | null;
  created_at: string | null;
}

interface RecipeContentRow {
  id: string;
  recipe_id: string;
  status: string;
}

type RecipeSubTab = "club" | "personal";
type SortOption = "newest" | "alphabetical" | "highest_rated";

interface RecipeHubProps {
  userId?: string;
  isAdmin?: boolean;
  canEdit?: boolean;
  isClubMember?: boolean;
}

const RecipeHub = ({ userId, isAdmin, canEdit = isAdmin, isClubMember }: RecipeHubProps) => {
  const [recipes, setRecipes] = useState<RecipeWithNotes[]>([]);
  const [usedIngredients, setUsedIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ingredientFilter, setIngredientFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [subTab, setSubTab] = useState<RecipeSubTab>("club");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [clubCount, setClubCount] = useState<number | null>(null);
  const [personalCount, setPersonalCount] = useState<number | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithNotes | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingRecipe, setRatingRecipe] = useState<RecipeWithNotes | null>(null);
  const [noteRecipe, setNoteRecipe] = useState<RecipeWithNotes | null>(null);
  const [noteText, setNoteText] = useState("");
  const [notePhotos, setNotePhotos] = useState<string[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [recipeIngredientsMap, setRecipeIngredientsMap] = useState<Record<string, RecipeIngredient[]>>({});
  const [recipeContentMap, setRecipeContentMap] = useState<Record<string, RecipeContent>>({});
  const [pantryItemNames, setPantryItemNames] = useState<string[]>(DEFAULT_PANTRY_ITEMS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Add Recipe dialog state
  const [showAddRecipeDialog, setShowAddRecipeDialog] = useState(false);
  const [addRecipeFormData, setAddRecipeFormData] = useState<RecipeFormData>(createInitialFormData());
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [isUploadingAddRecipeFile, setIsUploadingAddRecipeFile] = useState(false);

  const handleAddPersonalRecipe = async () => {
    if (!userId) return;
    setIsAddingRecipe(true);
    try {
      const { data: newRecipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          name: addRecipeFormData.name.trim(),
          url: addRecipeFormData.url.trim() || null,
          created_by: userId,
          event_id: null,
          ingredient_id: null,
        })
        .select("id")
        .single();

      if (recipeError) throw recipeError;
      const recipeId = newRecipe.id;

      // All modes (URL, upload, manual paste) go through parse
      const name = addRecipeFormData.name.trim();
      const url = addRecipeFormData.url.trim();
      const text = addRecipeFormData.inputMode === "manual" ? addRecipeFormData.pasteText : undefined;
      setShowAddRecipeDialog(false);
      setAddRecipeFormData(createInitialFormData());
      startParse(recipeId, name, { url: url || undefined, text });
    } catch (error) {
      console.error("Error adding recipe:", error);
      toast.error("Failed to add recipe");
    } finally {
      setIsAddingRecipe(false);
    }
  };

  const {
    parseStatus,
    parseStep,
    pendingParseName,
    startParse,
    handleRetry: handleParseRetry,
    handleKeep: handleParseKeep,
    handleDiscard: handleParseDiscard,
  } = useRecipeParse({
    onSuccess: () => { setIsLoading(true); loadRecipes(); },
    onKeep: () => { setIsLoading(true); loadRecipes(); },
    onDiscard: () => { setIsLoading(true); loadRecipes(); },
  });

  const handleIngredientsChange = async (recipeId: string) => {
    const { data } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", recipeId);
    if (data) {
      setRecipeIngredientsMap((prev) => ({
        ...prev,
        [recipeId]: data.map((row) => ({
          id: row.id,
          recipeId: row.recipe_id,
          name: row.name,
          quantity: row.quantity ?? undefined,
          unit: row.unit ?? undefined,
          category: row.category as import("@/types").GroceryCategory,
          rawText: row.raw_text ?? undefined,
          sortOrder: row.sort_order ?? undefined,
          createdAt: row.created_at ?? undefined,
        })),
      }));
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
    // Load all recipes with their ingredient info, joining scheduled_events to filter out personal meals
    const { data: recipesData, error: recipesError } = await supabase
      .from("recipes")
      .select(`
        *,
        ingredients (name, color),
        profiles:created_by (name, avatar_url),
        scheduled_events!event_id (type)
      `)
      .not("event_id", "is", null)
      .order("created_at", { ascending: false });

    if (recipesError) throw recipesError;

    // Filter out personal meal recipes (those linked to personal events)
    const clubRecipesData = (recipesData || []).filter(
      (r) => (r.scheduled_events as { type: string } | null)?.type !== "personal"
    );

    // Load notes and ratings in parallel (both depend on recipe IDs)
    const recipeIds = clubRecipesData.map((r) => r.id);

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
    const recipesWithNotes: RecipeWithNotes[] = clubRecipesData.map((r) => {
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
      };
    });

    setRecipes(recipesWithNotes);
    setClubCount(recipesWithNotes.length);
    await loadRecipeDetails(recipeIds);
  };

  const loadPersonalRecipes = async () => {
    if (!userId) {
      setRecipes([]);
      setPersonalCount(0);
      return;
    }

    // Load personal recipes created by user, joining scheduled_events to identify personal meals
    const { data: personalData, error: personalError } = await supabase
      .from("recipes")
      .select(`
        *,
        ingredients (name, color),
        profiles:created_by (name, avatar_url),
        scheduled_events!event_id (type)
      `)
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (personalError) throw personalError;

    // Filter to include only recipes with no event_id OR recipes linked to personal events
    const filteredPersonalData = (personalData || []).filter(
      (r) => !r.event_id || (r.scheduled_events as { type: string } | null)?.type === "personal"
    );

    const personalRecipes: RecipeWithNotes[] = filteredPersonalData.map((r) => {
      const creatorProfile = r.profiles as { name: string | null; avatar_url: string | null } | null;
      const ingredientData = r.ingredients as { name: string; color: string | null } | null;
      const ingredientName = ingredientData?.name;
      const ingredientColor = ingredientData?.color || (ingredientName ? getIngredientColor(ingredientName) : undefined);
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
        notes: [],
        ingredientName,
        ingredientColor,
        isPersonal: !r.event_id || (r.scheduled_events as { type: string } | null)?.type === "personal",
      };
    });

    // Load notes for all recipes
    const allRecipeIds = personalRecipes.map((r) => r.id);
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

        personalRecipes.forEach((recipe) => {
          recipe.notes = notesByRecipe.get(recipe.id) || [];
          recipe.notesCount = recipe.notes.length;
          recipe.contributors = [...new Set(recipe.notes.map((n) => n.userName!))];
        });
      }
    }

    setRecipes(personalRecipes);
    setPersonalCount(personalRecipes.length);
    await loadRecipeDetails(allRecipeIds);
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

  const loadRecipeDetails = async (recipeIds: string[]) => {
    if (recipeIds.length === 0) {
      setRecipeIngredientsMap({});
      setRecipeContentMap({});
      return;
    }

    const [ingredientsResult, contentResult] = await Promise.all([
      supabase
        .from("recipe_ingredients")
        .select("*")
        .in("recipe_id", recipeIds),
      supabase
        .from("recipe_content")
        .select("id, recipe_id, status")
        .in("recipe_id", recipeIds),
    ]);

    // Map ingredients by recipe
    const ingredientsMap: Record<string, RecipeIngredient[]> = {};
    if (ingredientsResult.data) {
      (ingredientsResult.data as RecipeIngredientRow[]).forEach((row) => {
        const mapped: RecipeIngredient = {
          id: row.id,
          recipeId: row.recipe_id,
          name: row.name,
          quantity: row.quantity ?? undefined,
          unit: row.unit ?? undefined,
          category: row.category as GroceryCategory,
          rawText: row.raw_text ?? undefined,
          sortOrder: row.sort_order ?? undefined,
          createdAt: row.created_at ?? undefined,
        };
        if (!ingredientsMap[row.recipe_id]) {
          ingredientsMap[row.recipe_id] = [];
        }
        ingredientsMap[row.recipe_id].push(mapped);
      });
    }
    setRecipeIngredientsMap(ingredientsMap);

    // Map content by recipe
    const contentMap: Record<string, RecipeContent> = {};
    if (contentResult.data) {
      (contentResult.data as RecipeContentRow[]).forEach((row) => {
        contentMap[row.recipe_id] = {
          id: row.id,
          recipeId: row.recipe_id,
          status: row.status as RecipeContent["status"],
        };
      });
    }
    setRecipeContentMap(contentMap);
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


  const isValidUrl = (value: string) => {
    return value.trim().startsWith("http://") || value.trim().startsWith("https://");
  };

  const handleEditRecipe = (recipe: RecipeWithNotes) => {
    setEditingRecipe(recipe);
    setEditName(recipe.name);
    setEditUrl(recipe.url || "");
  };

  const handleSaveEdit = async () => {
    setIsEditing(true);
    try {
      const result = await saveRecipeEdit(
        editingRecipe!.id,
        editName,
        editUrl,
        editingRecipe!.url || ""
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Recipe updated!");
      setEditingRecipe(null);
      setIsLoading(true);
      loadRecipes();
    } catch (error) {
      console.error("Error updating recipe:", error);
      toast.error("Failed to update recipe");
    } finally {
      setIsEditing(false);
    }
  };

  const [deleteGuardMessage, setDeleteGuardMessage] = useState<string | null>(null);

  const handleDeleteRecipe = async (recipeId: string) => {
    // Check if recipe is linked to a meal plan or event
    try {
      const { count: mealCount } = await supabase
        .from("meal_plan_items")
        .select("*", { count: "exact", head: true })
        .eq("recipe_id", recipeId);

      if (mealCount && mealCount > 0) {
        setDeleteGuardMessage("This recipe is used in a meal plan. Remove it from those first before deleting.");
        return;
      }
    } catch {
      // If check fails, allow deletion attempt anyway
    }

    setDeletingRecipeId(recipeId);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", deletingRecipeId!);

      if (error) throw error;

      toast.success("Recipe deleted!");
      setDeletingRecipeId(null);
      setIsLoading(true);
      loadRecipes();
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Failed to delete recipe");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditRating = (recipe: RecipeWithNotes) => {
    setRatingRecipe(recipe);
    setRatingDialogOpen(true);
  };

  const handleAddNote = (recipe: RecipeWithNotes) => {
    // If user already has a note, open it for editing instead
    const existingNote = recipe.notes.find((n) => n.userId === userId);
    if (existingNote) {
      setNoteRecipe(recipe);
      setNoteText(existingNote.notes || "");
      setNotePhotos(existingNote.photos || []);
      return;
    }
    setNoteRecipe(recipe);
    setNoteText("");
    setNotePhotos([]);
  };

  const handleSaveNote = async () => {
    setIsSavingNote(true);
    try {
      const existingNote = noteRecipe!.notes.find((n) => n.userId === userId);
      if (existingNote) {
        const { error } = await supabase
          .from("recipe_notes")
          .update({
            notes: noteText.trim() || null,
            photos: notePhotos.length > 0 ? notePhotos : null,
          })
          .eq("id", existingNote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recipe_notes")
          .insert({
            recipe_id: noteRecipe!.id,
            user_id: userId!,
            notes: noteText.trim() || null,
            photos: notePhotos.length > 0 ? notePhotos : null,
          });
        if (error) throw error;
      }

      toast.success(existingNote ? "Note updated!" : "Note added!");
      setNoteRecipe(null);
      setIsLoading(true);
      loadRecipes();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleParseRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId)!;

    toast("Parsing recipe ingredients...");

    supabase.functions
      .invoke("parse-recipe", {
        body: { recipeId, recipeUrl: recipe.url, recipeName: recipe.name, model: getCachedAiModel() },
      })
      .then((result) => {
        if (result?.error) {
          toast.error("Failed to parse recipe");
        } else {
          toast.success("Recipe parsed!");
          setIsLoading(true);
          loadRecipes();
        }
      });
  };

  useEffect(() => {
    loadUsedIngredients();

    // Load user's pantry items for filtering recipe card ingredients
    if (userId) {
      getPantryItems(userId).then((items) => {
        const names = items.map((i) => i.name);
        if (names.length > 0) setPantryItemNames(names);
      }).catch(() => { /* fallback to defaults */ });
    }

    // Eagerly load personal count so the tab button shows it on mount
    (async () => {
      if (!userId) {
        setPersonalCount(0);
        return;
      }
      try {
        const { data } = await supabase
          .from("recipes")
          .select("id, event_id, scheduled_events!event_id (type)")
          .eq("created_by", userId);

        const filtered = (data || []).filter(
          (r) =>
            !r.event_id ||
            (r.scheduled_events as { type: string } | null)?.type === "personal"
        );
        setPersonalCount(filtered.length);
      } catch {
        // Count will be loaded when tab is clicked
      }
    })();
  }, [userId]);

  useEffect(() => {
    setIsLoading(true);
    loadRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  // Filter recipes based on search and ingredient
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      searchTerm === "" ||
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.ingredientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.notes.some(
        (n) => n.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesIngredient =
      ingredientFilter === "all" ||
      recipe.ingredientId === ingredientFilter;

    return matchesSearch && matchesIngredient;
  });

  // Sort filtered recipes
  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    if (sortOption === "alphabetical") {
      return a.name.localeCompare(b.name);
    }
    if (sortOption === "highest_rated") {
      const ratingA = a.ratingSummary?.averageRating ?? 0;
      const ratingB = b.ratingSummary?.averageRating ?? 0;
      return ratingB - ratingA;
    }
    // "newest" — by created_at descending (already default from DB, but sort explicitly)
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-white/80 p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-14" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={subTab === "club" ? "default" : "outline"}
          size="sm"
          onClick={() => setSubTab("club")}
          className={subTab === "club" ? "bg-purple hover:bg-purple-dark" : ""}
        >
          Club{clubCount !== null ? ` (${clubCount})` : ""}
        </Button>
        <Button
          variant={subTab === "personal" ? "default" : "outline"}
          size="sm"
          onClick={() => setSubTab("personal")}
          className={subTab === "personal" ? "bg-purple hover:bg-purple-dark" : ""}
        >
          My Recipes{personalCount !== null ? ` (${personalCount})` : ""}
        </Button>
      </div>

      {/* Club / Personal tab content */}
      <>
        {/* Header with Search and Add */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full sm:w-auto">
            {/* Search + mobile icon buttons */}
            <div className="flex gap-2 w-full sm:flex-1 sm:max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="recipe-search"
                  placeholder="Search recipes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {subTab === "personal" && userId && (
                <Button
                  size="icon"
                  className="sm:hidden shrink-0 bg-purple hover:bg-purple-dark"
                  onClick={() => setShowAddRecipeDialog(true)}
                  aria-label="Add Recipe"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className="sm:hidden relative shrink-0"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {(sortOption !== "newest" || ingredientFilter !== "all") && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-purple" />
                )}
              </Button>
            </div>

            {/* Mobile filters (collapsible) */}
            {mobileFiltersOpen && (
              <div className="flex flex-col gap-3 w-full sm:hidden">
                <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical (A-Z)</SelectItem>
                    <SelectItem value="highest_rated">Highest Rated</SelectItem>
                  </SelectContent>
                </Select>
                {subTab === "club" && (
                  <Select value={ingredientFilter} onValueChange={setIngredientFilter}>
                    <SelectTrigger className="w-full">
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
            )}

            {/* Desktop filters (always visible) */}
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="hidden sm:flex w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="alphabetical">Alphabetical (A-Z)</SelectItem>
                <SelectItem value="highest_rated">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
            {subTab === "club" && (
              <Select value={ingredientFilter} onValueChange={setIngredientFilter}>
                <SelectTrigger className="hidden sm:flex w-48">
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
          {subTab === "personal" && userId && (
            <Button
              onClick={() => setShowAddRecipeDialog(true)}
              className="hidden sm:inline-flex bg-purple hover:bg-purple-dark shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Recipe
            </Button>
          )}
        </div>

        {/* Recipe Grid */}
        {sortedRecipes.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchTerm || ingredientFilter !== "all"
                  ? "No recipes found matching your search."
                  : subTab === "personal"
                  ? "No personal recipes yet. Click \"Add Recipe\" to get started."
                  : "No recipes yet. Recipes are added through events."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onEdit={recipe.createdBy === userId || (recipe.eventId && canEdit) ? handleEditRecipe : undefined}
                onDelete={recipe.createdBy === userId || (recipe.eventId && canEdit) ? handleDeleteRecipe : undefined}
                onEditRating={userId && isClubMember ? handleEditRating : undefined}
                onAddNote={userId ? handleAddNote : undefined}
                ingredients={recipeIngredientsMap[recipe.id]}
                pantryItems={pantryItemNames}
                contentStatus={recipeContentMap[recipe.id]?.status}
                onParseRecipe={isAdmin ? handleParseRecipe : undefined}
                userId={userId}
                onIngredientsChange={() => handleIngredientsChange(recipe.id)}
              />
            ))}
          </div>
        )}
      </>


      {/* Edit Personal Recipe Dialog */}
      <Dialog
        open={!!editingRecipe}
        onOpenChange={() => setEditingRecipe(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Recipe</DialogTitle>
            <DialogDescription>Update your personal recipe details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-recipe-name">Recipe Name *</Label>
              <Input
                id="edit-recipe-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter recipe name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-recipe-url">Recipe URL (optional)</Label>
              <Input
                id="edit-recipe-url"
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://..."
                className={editUrl.trim() && !isValidUrl(editUrl) ? "border-red-500" : ""}
              />
              {editUrl.trim() && !isValidUrl(editUrl) && (
                <p className="text-sm text-red-500">
                  URL must start with http:// or https://
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingRecipe(null)}
              disabled={isEditing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isEditing || !editName.trim()}
              className="bg-purple hover:bg-purple-dark"
            >
              {isEditing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingRecipeId}
        onOpenChange={() => setDeletingRecipeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recipe? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Guard Dialog */}
      <AlertDialog
        open={!!deleteGuardMessage}
        onOpenChange={() => setDeleteGuardMessage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Delete Recipe</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteGuardMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>OK</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Note Dialog */}
      <Dialog
        open={!!noteRecipe}
        onOpenChange={() => setNoteRecipe(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {noteRecipe?.notes.some((n) => n.userId === userId) ? "Edit Note" : "Add Note"}
            </DialogTitle>
            <DialogDescription>
              {noteRecipe?.notes.some((n) => n.userId === userId)
                ? <>Update your notes and photos for &quot;{noteRecipe?.name}&quot;.</>
                : <>Add notes and photos for &quot;{noteRecipe?.name}&quot;.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note-text">Notes</Label>
              <Textarea
                id="note-text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add your notes about this recipe..."
                rows={4}
              />
            </div>
            <PhotoUpload
              photos={notePhotos}
              onPhotosChange={setNotePhotos}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setNoteRecipe(null)}
              disabled={isSavingNote}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              disabled={isSavingNote || (!noteText.trim() && notePhotos.length === 0)}
              className="bg-purple hover:bg-purple-dark"
            >
              {isSavingNote ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Note"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Recipe Dialog */}
      <Dialog
        open={showAddRecipeDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddRecipeDialog(false);
            setAddRecipeFormData(createInitialFormData());
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add Recipe</DialogTitle>
            <DialogDescription>Add a personal recipe to your collection.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <RecipeInputForm
              formData={addRecipeFormData}
              onFormDataChange={setAddRecipeFormData}
              manualPasteOnly
              isUploading={isUploadingAddRecipeFile}
              onUploadingChange={setIsUploadingAddRecipeFile}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddRecipeDialog(false);
                setAddRecipeFormData(createInitialFormData());
              }}
              disabled={isAddingRecipe}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPersonalRecipe}
              disabled={!canSubmitRecipeForm(addRecipeFormData, isAddingRecipe, true) || isUploadingAddRecipeFile}
              className="bg-purple hover:bg-purple-dark"
            >
              {isAddingRecipe ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Recipe"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parse Progress Dialog */}
      <ParseProgressDialog
        parseStatus={parseStatus}
        parseStep={parseStep}
        recipeName={pendingParseName}
        onDiscard={handleParseDiscard}
        onKeep={handleParseKeep}
        onRetry={handleParseRetry}
      />

      {/* Edit Rating Dialog */}
      {ratingDialogOpen && ratingRecipe && ratingRecipe.eventId && userId && (
        <EventRatingDialog
          event={{
            eventId: ratingRecipe.eventId,
            eventDate: ratingRecipe.createdAt || "",
            ingredientName: ratingRecipe.ingredientName,
          }}
          recipes={[{ recipe: ratingRecipe, notes: ratingRecipe.notes }]}
          userId={userId}
          mode="rating"
          onComplete={() => {
            setRatingDialogOpen(false);
            setRatingRecipe(null);
            setIsLoading(true);
            loadRecipes();
          }}
          onCancel={() => {
            setRatingDialogOpen(false);
            setRatingRecipe(null);
          }}
        />
      )}
    </div>
  );
};

export default RecipeHub;
