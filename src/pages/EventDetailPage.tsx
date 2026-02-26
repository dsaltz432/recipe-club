import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUser, getAllowedUser, isAdmin, signOut } from "@/lib/auth";
import type { User, Recipe, RecipeNote, RecipeRatingsSummary, RecipeIngredient, RecipeContent, SmartGroceryItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ChefHat,
  Calendar as CalendarIcon,
  Clock,
  Pencil,
  X,
  Star,
  Menu,
  LogOut,
  ShoppingCart,
  BookOpen,
  UtensilsCrossed,
  Users,
  CheckCircle,
} from "lucide-react";
import PhotoUpload from "@/components/recipes/PhotoUpload";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/googleCalendar";
import { isDevMode } from "@/lib/devMode";
import EventRatingDialog from "@/components/events/EventRatingDialog";
import EventRecipesTab from "@/components/events/EventRecipesTab";
import type { EventRecipeWithRatings } from "@/components/events/EventRecipesTab";
import { getIngredientColor, getLightBackgroundColor, getBorderColor, getDarkerTextColor } from "@/lib/ingredientColors";
import { cn } from "@/lib/utils";
import GroceryListSection from "@/components/recipes/GroceryListSection";
import PantryDialog from "@/components/pantry/PantryDialog";
import PantrySection from "@/components/pantry/PantrySection";
import { getPantryItems, ensureDefaultPantryItems } from "@/lib/pantry";
import { smartCombineIngredients } from "@/lib/groceryList";
import { loadGroceryCache, saveGroceryCache, deleteGroceryCache } from "@/lib/groceryCache";
import RecipeParseProgress from "@/components/recipes/RecipeParseProgress";
import EditRecipeIngredientsDialog from "@/components/recipes/EditRecipeIngredientsDialog";
import RecipeInputForm, { createInitialFormData, canSubmitRecipeForm, buildIngredientPayload, type RecipeFormData } from "@/components/recipes/RecipeInputForm";

interface EventData {
  eventId: string;
  eventDate: string;
  eventTime?: string;
  status: "scheduled" | "completed";
  ingredientId: string;
  ingredientName?: string;
  ingredientColor?: string;
  createdBy?: string;
  recipesWithNotes: EventRecipeWithRatings[];
  participantCount: number;
}

const EventDetailPage = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [userIsMember, setUserIsMember] = useState(false);

  // Add Recipe form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [recipeFormData, setRecipeFormData] = useState<RecipeFormData>(createInitialFormData());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingRecipeImage, setIsUploadingRecipeImage] = useState(false);

  // Edit Recipe state
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);
  const [editRecipeName, setEditRecipeName] = useState("");
  const [editRecipeUrl, setEditRecipeUrl] = useState("");
  const [isEditingRecipe, setIsEditingRecipe] = useState(false);

  // Edit/Add note state
  const [noteToEdit, setNoteToEdit] = useState<RecipeNote | null>(null);
  const [recipeForNewNote, setRecipeForNewNote] = useState<Recipe | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);

  // Delete note state
  const [noteToDelete, setNoteToDelete] = useState<RecipeNote | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Delete recipe state
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);

  // Edit event state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTime, setEditTime] = useState("19:00");
  const [isUpdating, setIsUpdating] = useState(false);

  // Cancel event state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Rating dialog state
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratingDialogMode, setRatingDialogMode] = useState<"completing" | "rating">("completing");
  const [ratingRecipes, setRatingRecipes] = useState<EventRecipeWithRatings[] | null>(null);

  // Grocery list state
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeContentMap, setRecipeContentMap] = useState<Record<string, RecipeContent>>({});
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false);

  // Parse-on-add state
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "failed">("idle");
  const [parseError, setParseError] = useState<string | null>(null);
  const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(null);
  const [parseStep, setParseStep] = useState<"saving" | "parsing" | "loading" | "combining" | "notifying" | "done">("saving");
  const [showCombineStep, setShowCombineStep] = useState(false);

  // Smart grocery combine state
  const [smartGroceryItems, setSmartGroceryItems] = useState<SmartGroceryItem[] | null>(null);
  const [perRecipeItems, setPerRecipeItems] = useState<Record<string, SmartGroceryItem[]> | undefined>(undefined);
  const [isCombining, setIsCombining] = useState(false);
  const [combineError, setCombineError] = useState<string | null>(null);

  // Pantry state
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [showPantryDialog, setShowPantryDialog] = useState(false);

  // Edit ingredients state
  const [editIngredientsRecipe, setEditIngredientsRecipe] = useState<{ id: string; name: string } | null>(null);

  // Parse progress step definitions
  const parseSteps = [
    { key: "saving" as const, label: "Adding recipe" },
    { key: "parsing" as const, label: "Parsing ingredients & instructions" },
    { key: "loading" as const, label: "Loading recipe data" },
    ...(showCombineStep ? [{ key: "combining" as const, label: "Combining with other recipes" }] : []),
    { key: "notifying" as const, label: "Notifying club members" },
  ];

  // Notes expansion state - tracks which recipes have notes expanded
  const [expandedRecipeNotes, setExpandedRecipeNotes] = useState<Set<string>>(new Set());

  const toggleRecipeNotes = (recipeId: string) => {
    setExpandedRecipeNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId);
      } else {
        newSet.add(recipeId);
      }
      return newSet;
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const loadEventData = async () => {
    if (!eventId) return;

    try {
      // Load event with ingredient
      const { data: eventData, error: eventError } = await supabase
        .from("scheduled_events")
        .select(`*, ingredients (*)`)
        .eq("id", eventId)
        .single();

      if (eventError || !eventData) {
        setNotFound(true);
        return;
      }

      // Load recipes for this event with creator info
      const { data: recipesData, error: recipesError } = await supabase
        .from("recipes")
        .select("*, profiles:created_by (name, avatar_url)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (recipesError) throw recipesError;

      // Load notes for all recipes in this event, with user profiles
      const recipeIds = recipesData?.map(r => r.id) || [];
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
          .select(`*, profiles (name, avatar_url)`)
          .in("recipe_id", recipeIds);

        if (notesError) throw notesError;
        notesData = data || [];
      }

      // Load ratings for all recipes in this event with user names
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

      // Calculate rating summaries by recipe
      const ratingsByRecipe = new Map<string, RecipeRatingsSummary>();

      ratingsData.forEach((rating) => {
        const recipeId = rating.recipe_id;
        const userName = rating.profiles?.name || "?";
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

      // Finalize averages
      ratingsByRecipe.forEach((summary) => {
        summary.averageRating = summary.averageRating / summary.totalRatings;
        summary.wouldCookAgainPercent = Math.round(
          (summary.wouldCookAgainPercent / summary.totalRatings) * 100
        );
      });

      // Build recipes with notes and ratings
      const recipesWithNotes: EventRecipeWithRatings[] = (recipesData || []).map(recipe => {
        const recipeNotes = notesData
          .filter(n => n.recipe_id === recipe.id)
          .map(n => ({
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
            ingredientId: recipe.ingredient_id || undefined,
            createdBy: recipe.created_by || undefined,
            createdAt: recipe.created_at,
            createdByName: creatorProfile?.name || undefined,
            createdByAvatar: creatorProfile?.avatar_url || undefined,
          },
          notes: recipeNotes,
          ratingSummary,
        };
      });

      // Calculate participant count (users who have added notes)
      const uniqueUsers = new Set<string>();
      recipesWithNotes.forEach(r => {
        r.notes.forEach(n => {
          if (n.userId) uniqueUsers.add(n.userId);
        });
      });

      const ingredientName = eventData.ingredients?.name;
      const ingredientColor = eventData.ingredients?.color || (ingredientName ? getIngredientColor(ingredientName) : undefined);

      setEvent({
        eventId: eventData.id,
        eventDate: eventData.event_date,
        eventTime: eventData.event_time || undefined,
        status: eventData.status as "scheduled" | "completed",
        ingredientId: eventData.ingredient_id || "",
        ingredientName: ingredientName || undefined,
        ingredientColor,
        createdBy: eventData.created_by || undefined,
        recipesWithNotes,
        participantCount: uniqueUsers.size,
      });
    } catch (error) {
      console.error("Error loading event:", error);
      setNotFound(true);
    }
  };

  const loadGroceryData = async (recipeIds: string[]): Promise<{ ingredients: RecipeIngredient[]; contentMap: Record<string, RecipeContent> } | null> => {
    setIsLoadingIngredients(true);
    try {
      const [ingredientsResult, contentResult] = await Promise.all([
        supabase.from("recipe_ingredients").select("*").in("recipe_id", recipeIds),
        supabase.from("recipe_content").select("*").in("recipe_id", recipeIds),
      ]);

      let ingredients: RecipeIngredient[] = [];
      const contentMap: Record<string, RecipeContent> = {};

      if (ingredientsResult.data) {
        ingredients = ingredientsResult.data.map((row) => ({
          id: row.id,
          recipeId: row.recipe_id,
          name: row.name,
          quantity: row.quantity ?? undefined,
          unit: row.unit ?? undefined,
          category: row.category as RecipeIngredient["category"],
          rawText: row.raw_text ?? undefined,
          sortOrder: row.sort_order ?? undefined,
          createdAt: row.created_at,
        }));
        setRecipeIngredients(ingredients);
      }

      if (contentResult.data) {
        for (const row of contentResult.data) {
          contentMap[row.recipe_id] = {
            id: row.id,
            recipeId: row.recipe_id,
            description: row.description ?? undefined,
            servings: row.servings ?? undefined,
            prepTime: row.prep_time ?? undefined,
            cookTime: row.cook_time ?? undefined,
            totalTime: row.total_time ?? undefined,
            instructions: Array.isArray(row.instructions) ? row.instructions as string[] : undefined,
            sourceTitle: row.source_title ?? undefined,
            parsedAt: row.parsed_at ?? undefined,
            status: row.status as RecipeContent["status"],
            errorMessage: row.error_message ?? undefined,
            createdAt: row.created_at,
          };
        }
        setRecipeContentMap(contentMap);
      }

      return { ingredients, contentMap };
    } catch (error) {
      console.error("Error loading grocery data:", error);
      return null;
    } finally {
      setIsLoadingIngredients(false);
    }
  };

  const runSmartCombine = async (currentIngredients: RecipeIngredient[], currentContentMap: Record<string, RecipeContent>, recipes: Recipe[], forEventId?: string) => {
    // Count parsed recipes
    const parsedRecipes = recipes.filter((r) => currentContentMap[r.id]?.status === "completed");
    if (parsedRecipes.length < 1) {
      setSmartGroceryItems(null);
      setCombineError(null);
      return;
    }

    setIsCombining(true);
    setCombineError(null);
    try {
      const recipeNameMap: Record<string, string> = {};
      for (const r of recipes) {
        recipeNameMap[r.id] = r.name;
      }
      const result = await smartCombineIngredients(currentIngredients, recipeNameMap);
      setSmartGroceryItems(result.items);
      setPerRecipeItems(result.perRecipeItems);

      // Persist to cache
      const eid = forEventId || eventId;
      if (eid) {
        const sortedRecipeIds = parsedRecipes.map((r) => r.id).sort();
        saveGroceryCache("event", eid, user!.id, result.items, sortedRecipeIds, result.perRecipeItems);
      }
    } catch (err) {
      console.error("Smart combine error:", err);
      setSmartGroceryItems(null);
      setPerRecipeItems(undefined);
      setCombineError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsCombining(false);
    }
  };

  const handleParseRecipe = async (recipeId: string) => {
    const recipe = event?.recipesWithNotes.find((r) => r.recipe.id === recipeId)?.recipe;
    if (!recipe?.url) return;

    try {
      const { data, error } = await supabase.functions.invoke("parse-recipe", {
        body: { recipeId, recipeUrl: recipe.url, recipeName: recipe.name },
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.error ?? "Failed to parse recipe. Please try again.");
        return;
      }

      if (data?.skipped) {
        toast.success("Recipe parsed (skipped in dev mode)");
      } else {
        toast.success("Recipe parsed successfully!");
      }

      // Reload grocery data and run smart combine with fresh data
      const recipeIds = event!.recipesWithNotes.map((r) => r.recipe.id);
      const groceryData = await loadGroceryData(recipeIds);
      if (!groceryData) return;

      const allRecipes = event!.recipesWithNotes.map((r) => r.recipe);
      await runSmartCombine(groceryData.ingredients, groceryData.contentMap, allRecipes);
    } catch (error) {
      console.error("Error parsing recipe:", error);
      toast.error("Failed to parse recipe. Please try again.");
    }
  };

  const loadPantryItems = async (userId: string) => {
    try {
      await ensureDefaultPantryItems(userId);
      const items = await getPantryItems(userId);
      setPantryItems(items.map((i) => i.name));
    } catch (error) {
      console.error("Error loading pantry items:", error);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser?.email) {
        const allowed = await getAllowedUser(currentUser.email);
        setUserIsMember(allowed?.is_club_member ?? false); // Only club members can rate
        setUserIsAdmin(isAdmin(allowed));
      }

      if (currentUser?.id) {
        loadPantryItems(currentUser.id);
      }

      await loadEventData();
      setIsLoading(false);
    };

    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Load grocery data when event recipes are available
  useEffect(() => {
    if (event?.recipesWithNotes && event.recipesWithNotes.length > 0) {
      const recipeIds = event.recipesWithNotes.map((r) => r.recipe.id);
      loadGroceryData(recipeIds).then(async (groceryData) => {
        if (!groceryData) return;
        // Check cache before running AI combine
        const cached = await loadGroceryCache("event", eventId!, user?.id || "");
        if (cached) {
          const currentParsedIds = event.recipesWithNotes
            .filter((r) => groceryData.contentMap[r.recipe.id]?.status === "completed")
            .map((r) => r.recipe.id)
            .sort();
          const cachedIds = [...cached.recipeIds].sort();
          if (
            currentParsedIds.length === cachedIds.length &&
            currentParsedIds.every((id, i) => id === cachedIds[i])
          ) {
            setSmartGroceryItems(cached.items);
            setPerRecipeItems(cached.perRecipeItems);
            return;
          }
        }
        // Cache miss or stale — run smart combine with fresh data
        const allRecipes = event.recipesWithNotes.map((r) => r.recipe);
        runSmartCombine(groceryData.ingredients, groceryData.contentMap, allRecipes);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.recipesWithNotes?.length]);

  const isValidUrl = (url: string) => {
    return url.trim().startsWith("http://") || url.trim().startsWith("https://");
  };

  // Send email notification to club members
  const sendRecipeNotification = async (
    type: "added" | "updated",
    recipeNameVal: string,
    recipeUrlVal: string
  ) => {
    if (isDevMode()) {
      console.log("[DEV MODE] Skipping email notification");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("notify-recipe-change", {
        body: {
          type,
          recipeName: recipeNameVal,
          recipeUrl: recipeUrlVal,
          ingredientName: event?.ingredientName,
          eventDate: event?.eventDate,
          excludeUserId: user?.id,
        },
      });

      if (error) {
        console.error("Error sending notification:", error);
      } else {
        console.log("Notification sent:", data);
      }
    } catch (error) {
      console.error("Error invoking notification function:", error);
    }
  };

  const handleSubmitRecipe = async () => {
    if (!user?.id || !event) {
      return;
    }

    // Always combine groceries (even for a single recipe), but only show the "Combining" progress step for 2+
    const existingParsedCount = event.recipesWithNotes.filter(
      r => recipeContentMap[r.recipe.id]?.status === "completed"
    ).length;
    const willCombine = existingParsedCount >= 0;
    setShowCombineStep(existingParsedCount >= 1);

    setParseStep("saving");
    setParseStatus("parsing");
    setIsSubmitting(true);
    try {
      // Create new recipe with event_id and ingredient_id, returning the new ID
      const { data: insertedRecipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          name: recipeFormData.name.trim(),
          url: recipeFormData.inputMode === "manual" ? null : (recipeFormData.url.trim() || null),
          event_id: event.eventId,
          ingredient_id: event.ingredientId,
          created_by: user.id,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      const newRecipeId = insertedRecipe.id;
      setPendingRecipeId(newRecipeId);

      setIsSubmitting(false);

      const savedRecipeName = recipeFormData.name.trim();
      const savedRecipeUrl = recipeFormData.inputMode === "manual" ? "" : recipeFormData.url.trim();

      if (recipeFormData.inputMode === "manual") {
        // Manual mode: save ingredients directly, skip parsing
        setParseStep("parsing");
        const ingredientData = buildIngredientPayload(recipeFormData.ingredientRows);

        if (ingredientData.length > 0) {
          const { error: rpcError } = await supabase.rpc("replace_recipe_ingredients", {
            p_recipe_id: newRecipeId,
            p_ingredients: ingredientData,
          });
          if (rpcError) throw rpcError;

          await supabase.from("recipe_content").insert({
            recipe_id: newRecipeId,
            status: "completed",
          });
        }

        // Loading step: reload event and grocery data
        setParseStep("loading");
        await loadEventData();

        const recipeIds = [...event.recipesWithNotes.map((r) => r.recipe.id), newRecipeId];
        const groceryData = await loadGroceryData(recipeIds);

        if (willCombine && groceryData) {
          setParseStep("combining");
          const allRecipes = [...event.recipesWithNotes.map((r) => r.recipe), insertedRecipe as unknown as Recipe];
          await runSmartCombine(groceryData.ingredients, groceryData.contentMap, allRecipes);
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        setParseStep("notifying");
        await sendRecipeNotification("added", savedRecipeName, savedRecipeUrl);
        await new Promise(resolve => setTimeout(resolve, 200));

        setParseStep("done");
        await new Promise(resolve => setTimeout(resolve, 2500));

        setParseStatus("idle");
        setParseError(null);
        setPendingRecipeId(null);
        setRecipeFormData(createInitialFormData());
        setShowAddForm(false);
        setParseStep("saving");
      } else {
        // URL/Upload mode: parse via edge function
        setParseStep("parsing");

        try {
          const { data: parseData, error: parseError } = await supabase.functions.invoke("parse-recipe", {
            body: { recipeId: newRecipeId, recipeUrl: savedRecipeUrl, recipeName: savedRecipeName },
          });

          if (parseError) throw parseError;
          if (!parseData?.success) throw new Error(parseData?.error ?? "Failed to parse recipe");

          // Loading step: reload event and grocery data
          setParseStep("loading");
          await loadEventData();

          const recipeIds = [...event.recipesWithNotes.map((r) => r.recipe.id), newRecipeId];
          const groceryData = await loadGroceryData(recipeIds);

          // Combining step (only if 2+ parsed recipes)
          if (willCombine && groceryData) {
            setParseStep("combining");
            const allRecipes = [...event.recipesWithNotes.map((r) => r.recipe), insertedRecipe as unknown as Recipe];
            await runSmartCombine(groceryData.ingredients, groceryData.contentMap, allRecipes);
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          // Notifying step: send email notification to club members
          setParseStep("notifying");
          await sendRecipeNotification("added", savedRecipeName, savedRecipeUrl);
          await new Promise(resolve => setTimeout(resolve, 200));

          // Show "done" state with all checkmarks for 1.5s before closing
          setParseStep("done");
          await new Promise(resolve => setTimeout(resolve, 2500));

          // Success: close dialog, reset state
          setParseStatus("idle");
          setParseError(null);
          setPendingRecipeId(null);
          setRecipeFormData(createInitialFormData());
          setShowAddForm(false);
          setParseStep("saving");
        } catch (error) {
          console.error("Error parsing recipe:", error);
          const msg = error instanceof Error ? error.message : "Failed to parse recipe";
          setParseStatus("failed");
          setParseError(msg);
        }
      }
    } catch (error: unknown) {
      console.error("Error saving recipe:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save recipe";
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleKeepRecipeAnyway = () => {
    setParseStatus("idle");
    setParseError(null);
    setPendingRecipeId(null);
    setParseStep("saving");
    setRecipeFormData(createInitialFormData());
    setShowAddForm(false);
    toast.success("Recipe added (parsing skipped)");
    loadEventData();
  };

  const handleRetryParse = async () => {
    const retryRecipeId = pendingRecipeId!;
    setParseStatus("parsing");
    setParseError(null);
    setParseStep("parsing");

    try {
      const { data: retryData, error: retryError } = await supabase.functions.invoke("parse-recipe", {
        body: { recipeId: retryRecipeId, recipeUrl: recipeFormData.url.trim(), recipeName: recipeFormData.name.trim() },
      });
      if (retryError) throw retryError;
      if (!retryData?.success) {
        setParseStatus("failed");
        setParseError(retryData?.error ?? "Failed to parse recipe");
        return;
      }

      // Success: close dialog and refresh
      setParseStatus("idle");
      setParseError(null);
      setPendingRecipeId(null);
      setParseStep("saving");
      setRecipeFormData(createInitialFormData());
      setShowAddForm(false);
      toast.success("Recipe parsed successfully!");
      loadEventData();
    } catch (error) {
      console.error("Error retrying parse:", error);
      const msg = error instanceof Error ? error.message : "Failed to parse recipe";
      setParseStatus("failed");
      setParseError(msg);
    }
  };

  const handleEditRecipeClick = (recipe: Recipe) => {
    setRecipeToEdit(recipe);
    setEditRecipeName(recipe.name);
    setEditRecipeUrl(recipe.url || "");
  };

  const handleSaveRecipeEdit = async () => {
    if (editRecipeUrl.trim() && !isValidUrl(editRecipeUrl)) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }

    const urlChanged = (recipeToEdit!.url || "") !== (editRecipeUrl.trim() || "");

    setIsEditingRecipe(true);
    try {
      const { error } = await supabase
        .from("recipes")
        .update({
          name: editRecipeName.trim(),
          url: editRecipeUrl.trim() || null,
        })
        .eq("id", recipeToEdit!.id);

      if (error) throw error;

      // Send notification only if URL changed
      if (urlChanged) {
        sendRecipeNotification("updated", editRecipeName.trim(), editRecipeUrl.trim());
      }

      // Trigger re-parse in background if URL changed and new URL is non-empty
      if (urlChanged && editRecipeUrl.trim()) {
        supabase.functions.invoke("parse-recipe", {
          body: { recipeId: recipeToEdit!.id, recipeUrl: editRecipeUrl.trim(), recipeName: editRecipeName.trim() },
        }).then(({ data: parseData, error: parseError }) => {
          if (parseError || !parseData?.success) {
            console.error("Error re-parsing recipe:", parseError ?? parseData?.error);
          } else {
            loadEventData();
          }
        });
        toast.success("Recipe updated!");
      } else {
        toast.success("Recipe updated!");
      }

      setRecipeToEdit(null);
      loadEventData();
    } catch (error) {
      console.error("Error updating recipe:", error);
      toast.error("Failed to update recipe");
    } finally {
      setIsEditingRecipe(false);
    }
  };

  const handleEditNoteClick = (note: RecipeNote) => {
    setNoteToEdit(note);
    setRecipeForNewNote(null);
    setEditNotes(note.notes || "");
    setEditPhotos(note.photos || []);
  };

  const handleAddNotesClick = (recipe: Recipe) => {
    setRecipeForNewNote(recipe);
    setNoteToEdit(null);
    setEditNotes("");
    setEditPhotos([]);
  };

  const handleSaveNote = async () => {
    if (!user?.id || !event) return;

    setIsUpdatingNote(true);
    try {
      if (noteToEdit) {
        // Update existing note
        const { error } = await supabase
          .from("recipe_notes")
          .update({
            notes: editNotes.trim() || null,
            photos: editPhotos.length > 0 ? editPhotos : null,
          })
          .eq("id", noteToEdit.id);

        if (error) throw error;
        toast.success("Notes updated!");
      } else {
        // Create new note for recipe
        const { error } = await supabase
          .from("recipe_notes")
          .insert({
            recipe_id: recipeForNewNote!.id,
            user_id: user.id,
            notes: editNotes.trim() || null,
            photos: editPhotos.length > 0 ? editPhotos : null,
          });

        if (error) throw error;
        toast.success("Notes added!");
      }

      setNoteToEdit(null);
      setRecipeForNewNote(null);
      loadEventData();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save notes");
    } finally {
      setIsUpdatingNote(false);
    }
  };

  const handleDeleteClick = (note: RecipeNote) => {
    setNoteToDelete(note);
  };

  const handleConfirmDelete = async () => {
    const note = noteToDelete!;
    setDeletingNoteId(note.id);
    setNoteToDelete(null);

    try {
      // Delete the note entirely (not just clearing fields)
      const { error } = await supabase
        .from("recipe_notes")
        .delete()
        .eq("id", note.id);

      if (error) throw error;
      toast.success("Notes removed");
      loadEventData();
    } catch (error) {
      console.error("Error deleting notes:", error);
      toast.error("Failed to remove notes");
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDeleteRecipeClick = (recipe: Recipe) => {
    setRecipeToDelete(recipe);
  };

  const handleConfirmDeleteRecipe = async () => {
    try {
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipeToDelete!.id);
      if (error) throw error;
      setRecipeToDelete(null);
      toast.success("Recipe deleted");
      deleteGroceryCache("event", eventId!, user!.id);
      loadEventData();
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Failed to delete recipe");
      setRecipeToDelete(null);
    }
  };

  const handleEditEventClick = () => {
    setEditDate(parseISO(event!.eventDate));
    setEditTime(event!.eventTime || "19:00");
    setShowEditDialog(true);
  };

  const handleSaveEventEdit = async () => {

    setIsUpdating(true);
    try {
      const newEventDate = format(editDate!, "yyyy-MM-dd");

      // Get the event details including calendar_event_id
      const { data: eventData, error: fetchError } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (name)")
        .eq("id", event!.eventId)
        .single();

      if (fetchError) throw fetchError;

      // Update the scheduled event
      const { error: updateError } = await supabase
        .from("scheduled_events")
        .update({
          event_date: newEventDate,
          event_time: editTime,
        })
        .eq("id", event!.eventId);

      if (updateError) throw updateError;

      // Update Google Calendar event if it exists
      if (eventData.calendar_event_id) {
        const calendarResult = await updateCalendarEvent({
          calendarEventId: eventData.calendar_event_id,
          date: editDate!,
          time: editTime,
          ingredientName: eventData.ingredients?.name || "Unknown",
        });

        if (!calendarResult.success) {
          console.warn("Failed to update calendar event:", calendarResult.error);
          toast.warning("Calendar sync failed. The event date was updated but your Google Calendar may be out of sync.");
        }
      }

      toast.success("Event updated!");
      setShowEditDialog(false);
      loadEventData();
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error("Failed to update event");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEvent = async () => {
    setIsCanceling(true);
    try {
      // Get the event data including calendar_event_id
      const { data: eventData, error: findError } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (*)")
        .eq("id", event!.eventId)
        .single();

      if (findError) throw findError;

      // Delete the Google Calendar event if it exists
      if (eventData.calendar_event_id) {
        const deleteResult = await deleteCalendarEvent(eventData.calendar_event_id);
        if (!deleteResult.success && !deleteResult.error?.includes("not available")) {
          console.warn("Failed to delete calendar event:", deleteResult.error);
        }
      }

      // Note: Recipes cascade delete with the event (ON DELETE CASCADE)

      // Delete the event row
      await supabase
        .from("scheduled_events")
        .delete()
        .eq("id", eventData.id);

      toast.success("Event canceled");
      setShowCancelConfirm(false);
      navigate("/dashboard/events");
    } catch (error) {
      console.error("Error canceling event:", error);
      toast.error("Failed to cancel event");
    } finally {
      setIsCanceling(false);
    }
  };

  const handleCompleteClick = () => {
    setRatingDialogMode("completing");
    setShowRatingDialog(true);
  };

  const handleRateRecipesClick = () => {
    setRatingDialogMode("rating");
    setRatingRecipes(null);
    setShowRatingDialog(true);
  };

  const handleRateRecipe = (recipeWithRatings: EventRecipeWithRatings) => {
    setRatingDialogMode("rating");
    setRatingRecipes([recipeWithRatings]);
    setShowRatingDialog(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handlePantryChange = () => {
    if (user?.id) {
      loadPantryItems(user.id);
    }
  };

  const handleRatingsSubmitted = () => {
    // Just reload the data to show updated ratings
    setShowRatingDialog(false);
    setRatingRecipes(null);
    loadEventData();
  };

  const handleRatingsComplete = async () => {
    try {
      // Update event status to completed
      const { error: statusError } = await supabase
        .from("scheduled_events")
        .update({ status: "completed" })
        .eq("id", event!.eventId);

      if (statusError) throw statusError;

      // Atomically increment the ingredient's used_count via RPC
      const { error: rpcError } = await supabase.rpc(
        "increment_ingredient_used_count",
        {
          p_ingredient_id: event!.ingredientId,
          p_user_id: user?.id,
        }
      );

      if (rpcError) throw rpcError;

      toast.success("Event marked as completed!");
      setShowRatingDialog(false);
      setRatingRecipes(null);
      loadEventData();
    } catch (error) {
      console.error("Error completing event:", error);
      toast.error("Failed to complete event");
    }
  };

  const isUpcoming = event?.status === "scheduled";
  const totalRecipes = event?.recipesWithNotes.length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
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
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ChefHat className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Event Not Found</h2>
              <p className="text-muted-foreground text-center">
                This event doesn't exist or has been removed.
              </p>
              <Button
                className="mt-4"
                onClick={() => navigate("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Get colors from ingredient
  const bgColor = event?.ingredientColor ? getLightBackgroundColor(event.ingredientColor) : undefined;
  const headerBorderColor = event?.ingredientColor ? getBorderColor(event.ingredientColor) : undefined;
  const themeColor = event?.ingredientColor ? getDarkerTextColor(event.ingredientColor) : "#9b87f5";

  return (
    <div
      className="min-h-screen"
      style={{
        background: bgColor
          ? `linear-gradient(to bottom right, ${bgColor}, white, ${bgColor})`
          : "linear-gradient(to bottom right, rgba(155, 135, 245, 0.15), white, rgba(249, 115, 22, 0.15))",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md shadow-sm"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          borderBottom: `1px solid ${headerBorderColor || "rgba(155, 135, 245, 0.1)"}`,
        }}
      >
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/dashboard/events")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Events</span>
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <ChefHat className="h-5 w-5 shrink-0" style={{ color: themeColor }} />
              <h1 className="font-display text-base sm:text-xl md:text-2xl font-bold truncate" style={{ color: themeColor }}>
                {event?.ingredientName || "Event Details"}
              </h1>
              {isUpcoming && (
                <span
                  className="text-[10px] sm:text-xs text-white px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: themeColor }}
                >
                  Upcoming
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:bg-purple/5 shrink-0">
                <Avatar className="h-8 w-8 ring-2 ring-purple/20">
                  <AvatarImage src={user?.avatar_url} alt={user?.name} />
                  <AvatarFallback className="bg-purple/10 text-purple font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">
                  {user?.name}
                </span>
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {userIsAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/users")} className="cursor-pointer">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl space-y-4 sm:space-y-6">
        {/* Event Info */}
        <Card
          className="backdrop-blur-sm border-2 shadow-md"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            borderColor: headerBorderColor || "rgba(155, 135, 245, 0.1)",
          }}
        >
          <CardContent className="py-4 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-muted-foreground">
                  <div
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full"
                    style={{ backgroundColor: bgColor || "rgba(155, 135, 245, 0.05)" }}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: themeColor }} />
                    <span className="font-medium">{event && format(parseISO(event.eventDate), "EEE, MMM d, yyyy")}</span>
                  </div>
                  {event?.eventTime && (
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-orange/5 px-2 sm:px-3 py-1 rounded-full">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange" />
                      <span className="font-medium">{formatTime(event.eventTime)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <ChefHat className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>
                    <strong className="text-orange">{totalRecipes}</strong> recipe{totalRecipes !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Event action buttons */}
              <div className="flex flex-wrap gap-2 shrink-0">
                {isUpcoming && userIsAdmin && user?.id === event?.createdBy && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleEditEventClick} className="h-8 px-3 text-xs">
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCompleteClick} className="h-8 px-3 text-xs bg-purple/5 hover:bg-purple/10">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Complete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(true)} className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50">
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                  </>
                )}
                {isUpcoming && userIsAdmin && user?.id !== event?.createdBy && (
                  <Button variant="outline" size="sm" onClick={handleCompleteClick} className="h-8 px-3 text-xs bg-purple/5 hover:bg-purple/10">
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Complete
                  </Button>
                )}
                {!isUpcoming && userIsMember && totalRecipes > 0 && (
                  <Button variant="outline" size="sm" onClick={handleRateRecipesClick} className="h-8 px-3 text-xs">
                    <Star className="h-3.5 w-3.5 mr-1" />
                    Rate Recipes
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs defaultValue="recipes" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mb-4">
            <TabsTrigger value="recipes" className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Recipes</span>
            </TabsTrigger>
            <TabsTrigger value="grocery" className="flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Groceries</span>
            </TabsTrigger>
            <TabsTrigger value="pantry" className="flex items-center gap-1.5">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Pantry</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recipes" forceMount className="data-[state=inactive]:hidden">
            <EventRecipesTab
              recipesWithNotes={event?.recipesWithNotes || []}
              user={user}
              userIsAdmin={userIsAdmin}
              expandedRecipeNotes={expandedRecipeNotes}
              deletingNoteId={deletingNoteId}
              onToggleRecipeNotes={toggleRecipeNotes}
              onAddRecipeClick={() => setShowAddForm(true)}
              onEditRecipeClick={handleEditRecipeClick}
              onAddNotesClick={handleAddNotesClick}
              onEditNoteClick={handleEditNoteClick}
              onDeleteNoteClick={handleDeleteClick}
              onDeleteRecipeClick={handleDeleteRecipeClick}
              onRateRecipe={handleRateRecipe}
              onEditIngredients={(recipe) => setEditIngredientsRecipe({ id: recipe.id, name: recipe.name })}
            />
          </TabsContent>

          <TabsContent value="grocery">
            {event && event.recipesWithNotes.length > 0 ? (
              <GroceryListSection
                recipes={event.recipesWithNotes.map((r) => r.recipe)}
                recipeIngredients={recipeIngredients}
                recipeContentMap={recipeContentMap}
                onParseRecipe={handleParseRecipe}
                eventName={event.ingredientName || "Event"}
                isLoading={isLoadingIngredients}
                pantryItems={pantryItems}
                smartGroceryItems={smartGroceryItems}
                isCombining={isCombining}
                combineError={combineError}
                perRecipeItems={perRecipeItems}
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
            )}
          </TabsContent>

          <TabsContent value="pantry">
            <PantrySection userId={user?.id} onPantryChange={handlePantryChange} />
          </TabsContent>

        </Tabs>
      </main>

      {/* Add Recipe Dialog */}
      <Dialog
        open={showAddForm}
        onOpenChange={() => {
          if (parseStatus === "parsing") {
            if (window.confirm("Parsing is in progress. The recipe has been saved. Close anyway?")) {
              setShowAddForm(false);
              setRecipeFormData(createInitialFormData());
              setParseStatus("idle");
              setParseError(null);
              setPendingRecipeId(null);
              setParseStep("saving");
              loadEventData();
            }
          } else {
            setShowAddForm(false);
            setRecipeFormData(createInitialFormData());
            setParseStatus("idle");
            setParseError(null);
            setPendingRecipeId(null);
            setParseStep("saving");
          }
        }}
      >
        <DialogContent className={cn(
          "max-h-[85vh] overflow-y-auto",
          recipeFormData.inputMode === "manual" ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Add a Recipe
            </DialogTitle>
            <DialogDescription>
              Add a recipe for the {event?.ingredientName} event.
            </DialogDescription>
          </DialogHeader>

          {parseStatus === "parsing" && (
            <RecipeParseProgress steps={parseSteps} currentStep={parseStep} />
          )}

          {parseStatus === "failed" && (
            <div className="space-y-4 py-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700 font-medium mb-1">Your recipe has been saved!</p>
                <p className="text-xs text-muted-foreground">
                  However, we couldn't extract ingredients automatically.
                </p>
              </div>
              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-600">{parseError}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleKeepRecipeAnyway}>
                  Continue without ingredients
                </Button>
                <Button onClick={handleRetryParse} className="bg-purple hover:bg-purple-dark">
                  Try parsing again
                </Button>
              </div>
            </div>
          )}

          {parseStatus === "idle" && (
            <>
              <div className="py-4">
                <RecipeInputForm
                  formData={recipeFormData}
                  onFormDataChange={setRecipeFormData}
                  isUploading={isUploadingRecipeImage}
                  onUploadingChange={setIsUploadingRecipeImage}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setRecipeFormData(createInitialFormData());
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitRecipe}
                  disabled={!canSubmitRecipeForm(recipeFormData, isSubmitting)}
                  className="bg-purple hover:bg-purple-dark"
                >
                  Add Recipe
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Recipe Dialog */}
      <Dialog
        open={!!recipeToEdit}
        onOpenChange={() => {
          setRecipeToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Edit Recipe
            </DialogTitle>
            <DialogDescription>
              Update the recipe details. If you change the URL, all club members will be notified.
            </DialogDescription>
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
                placeholder="https:// (optional)"
                className={editRecipeUrl.trim() && !isValidUrl(editRecipeUrl) ? "border-red-500" : ""}
              />
              {editRecipeUrl.trim() && !isValidUrl(editRecipeUrl) && (
                <p className="text-sm text-red-500">URL must start with http:// or https://</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRecipeToEdit(null)}
              disabled={isEditingRecipe}
            >
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
        onOpenChange={() => {
          setNoteToEdit(null);
          setRecipeForNewNote(null);
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
                : "Update your notes and photos."
              }
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

      {/* Remove Recipe from Event Confirmation */}
      <AlertDialog open={!!recipeToDelete} onOpenChange={(open) => !open && setRecipeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recipe from event?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete &quot;{recipeToDelete?.name}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteRecipe}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Event Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Edit Event
            </DialogTitle>
            <DialogDescription>
              Change the date and time for this event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={editDate}
                onSelect={setEditDate}
                disabled={(date) => { const today = new Date(); today.setHours(0,0,0,0); return date < today; }}
                initialFocus
              />
            </div>

            <div className="flex items-center gap-4 px-4">
              <Label htmlFor="edit-time" className="whitespace-nowrap">Event Time</Label>
              <Input
                id="edit-time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEventEdit}
              disabled={!editDate || isUpdating}
              className="bg-purple hover:bg-purple-dark"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Event Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {event?.ingredientName} event and all associated recipes, notes, ratings, meal plan references, and Google Calendar event. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Keep Event</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelEvent}
              disabled={isCanceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? "Canceling..." : "Cancel Event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rating Dialog */}
      {showRatingDialog && event && (
        <EventRatingDialog
          event={event}
          recipes={ratingRecipes || event.recipesWithNotes}
          userId={user!.id}
          onComplete={ratingDialogMode === "completing" ? handleRatingsComplete : handleRatingsSubmitted}
          onCancel={() => { setShowRatingDialog(false); setRatingRecipes(null); }}
          mode={ratingDialogMode}
        />
      )}

      {/* Pantry Dialog */}
      {user?.id && (
        <PantryDialog
          open={showPantryDialog}
          onOpenChange={setShowPantryDialog}
          userId={user.id}
          onPantryChange={handlePantryChange}
        />
      )}

      {/* Edit Ingredients Dialog */}
      {editIngredientsRecipe && user?.id && (
        <EditRecipeIngredientsDialog
          open={!!editIngredientsRecipe}
          onOpenChange={(open) => { if (!open) setEditIngredientsRecipe(null); }}
          recipeId={editIngredientsRecipe.id}
          recipeName={editIngredientsRecipe.name}
          ingredients={recipeIngredients.filter((i) => i.recipeId === editIngredientsRecipe.id)}
          onSaved={async () => {
            setEditIngredientsRecipe(null);
            const recipeIds = event?.recipesWithNotes.map((r) => r.recipe.id) || [];
            if (recipeIds.length > 0) {
              const groceryData = await loadGroceryData(recipeIds);
              if (groceryData) {
                const allRecipes = event!.recipesWithNotes.map((r) => r.recipe);
                await runSmartCombine(groceryData.ingredients, groceryData.contentMap, allRecipes);
              }
            }
          }}
          cacheContext={eventId ? { type: "event", id: eventId, userId: user.id } : undefined}
        />
      )}
    </div>
  );
};

export default EventDetailPage;
