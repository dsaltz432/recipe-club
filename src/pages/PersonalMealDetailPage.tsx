import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUser } from "@/lib/auth";
import type { User, Recipe, RecipeNote, RecipeRatingsSummary } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Star,
  Upload,
  Loader2,
  Menu,
  LogOut,
  BookOpen,
} from "lucide-react";
import PhotoUpload from "@/components/recipes/PhotoUpload";
import { signOut } from "@/lib/auth";
import EventRatingDialog from "@/components/events/EventRatingDialog";
import EventRecipesTab from "@/components/events/EventRecipesTab";
import type { EventRecipeWithRatings } from "@/components/events/EventRecipesTab";
import { uploadRecipeFile, FileValidationError } from "@/lib/upload";

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

  // Add Recipe form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingRecipeImage, setIsUploadingRecipeImage] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const recipeImageInputRef = useRef<HTMLInputElement>(null);

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

  // Rating dialog state
  const [showRatingDialog, setShowRatingDialog] = useState(false);

  // Notes expansion state
  const [expandedRecipeNotes, setExpandedRecipeNotes] = useState<Set<string>>(new Set());

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
        .select("recipe_id")
        // event_id column added by migration; use .or() to bypass generated types
        .or(`event_id.eq.${eventId}`);

      const linkedRecipeIds = (mealItemsData || [])
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

  const isValidUrl = (url: string) => {
    return url.trim().startsWith("http://") || url.trim().startsWith("https://");
  };

  const handleRecipeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingRecipeImage(true);
    setUploadingFileName(file.name);

    try {
      const publicUrl = await uploadRecipeFile(file);
      setRecipeUrl(publicUrl);
      if (!recipeName.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setRecipeName(baseName);
      }
      toast.success("File uploaded!");
    } catch (error) {
      if (error instanceof FileValidationError) {
        toast.error(error.message);
      } else {
        console.error("Error uploading file:", error);
        toast.error("Failed to upload file");
      }
    } finally {
      setIsUploadingRecipeImage(false);
      setUploadingFileName("");
      if (recipeImageInputRef.current) {
        recipeImageInputRef.current.value = "";
      }
    }
  };

  const handleSubmitRecipe = async () => {
    if (!recipeName.trim()) {
      toast.error("Please enter a recipe name");
      return;
    }
    if (!user?.id || !event) return;

    setIsSubmitting(true);
    try {
      const { data: insertedRecipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          name: recipeName.trim(),
          url: recipeUrl.trim() || null,
          event_id: event.eventId,
          created_by: user.id,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      const savedName = recipeName.trim();
      const savedUrl = recipeUrl.trim();

      toast.success("Recipe added!");
      setRecipeName("");
      setRecipeUrl("");
      setShowAddForm(false);
      loadEventData();

      // Trigger parse-recipe in background if URL is present
      if (savedUrl && insertedRecipe) {
        supabase.functions.invoke("parse-recipe", {
          body: { recipeId: insertedRecipe.id, recipeUrl: savedUrl, recipeName: savedName },
        }).then(({ error: parseError }) => {
          if (parseError) {
            console.error("Error parsing recipe:", parseError);
          } else {
            loadEventData();
          }
        });
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast.error("Failed to save recipe");
    } finally {
      setIsSubmitting(false);
    }
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
      const { error } = await supabase
        .from("recipes")
        .update({
          name: editRecipeName.trim(),
          url: editRecipeUrl.trim() || null,
        })
        .eq("id", recipeToEdit.id);

      if (error) throw error;

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
        const { error } = await supabase
          .from("recipe_notes")
          .update({
            notes: editNotes.trim() || null,
            photos: editPhotos.length > 0 ? editPhotos : null,
          })
          .eq("id", noteToEdit.id);

        if (error) throw error;
        toast.success("Notes updated!");
      } else if (recipeForNewNote) {
        const { error } = await supabase
          .from("recipe_notes")
          .insert({
            recipe_id: recipeForNewNote.id,
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
    if (!noteToDelete) return;

    setDeletingNoteId(noteToDelete.id);
    setNoteToDelete(null);

    try {
      const { error } = await supabase
        .from("recipe_notes")
        .delete()
        .eq("id", noteToDelete.id);

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

  const handleRateRecipesClick = () => {
    setShowRatingDialog(true);
  };

  const handleRatingsSubmitted = () => {
    setShowRatingDialog(false);
    loadEventData();
  };

  const handleSignOut = async () => {
    await signOut();
  };

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
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md shadow-sm bg-white/90 border-b border-purple/10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/dashboard/meals")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Meals</span>
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <ChefHat className="h-5 w-5 shrink-0 text-purple" />
              <h1 className="font-display text-base sm:text-xl md:text-2xl font-bold truncate text-purple">
                Meal Details
              </h1>
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
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {totalRecipes > 0 && (
                <>
                  <DropdownMenuItem onClick={handleRateRecipesClick} className="cursor-pointer">
                    <Star className="h-4 w-4 mr-2" />
                    Rate Recipes
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
        <Card className="backdrop-blur-sm border-2 shadow-md bg-white/90 border-purple/10">
          <CardContent className="py-4 sm:py-6">
            <div className="space-y-2">
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
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>
                  <strong className="text-orange">{totalRecipes}</strong> recipe{totalRecipes !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recipes */}
        <EventRecipesTab
          recipesWithNotes={event?.recipesWithNotes || []}
          user={user}
          userIsAdmin={true}
          expandedRecipeNotes={expandedRecipeNotes}
          deletingNoteId={deletingNoteId}
          onToggleRecipeNotes={toggleRecipeNotes}
          onAddRecipeClick={() => setShowAddForm(true)}
          onEditRecipeClick={handleEditRecipeClick}
          onAddNotesClick={handleAddNotesClick}
          onEditNoteClick={handleEditNoteClick}
          onDeleteNoteClick={handleDeleteClick}
          onDeleteRecipeClick={handleDeleteRecipeClick}
        />
      </main>

      {/* Add Recipe Dialog */}
      <Dialog
        open={showAddForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false);
            setRecipeName("");
            setRecipeUrl("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add a Recipe</DialogTitle>
            <DialogDescription>Add a recipe for this meal.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipe-name">Recipe Name *</Label>
              <Input
                id="recipe-name"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="Enter recipe name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipe-url">Recipe URL (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="recipe-url"
                  type="url"
                  value={recipeUrl}
                  onChange={(e) => setRecipeUrl(e.target.value)}
                  placeholder="https://... or upload a file"
                  className={`flex-1 ${recipeUrl.trim() && !isValidUrl(recipeUrl) ? "border-red-500" : ""}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => recipeImageInputRef.current?.click()}
                  disabled={isUploadingRecipeImage}
                  className="shrink-0"
                  aria-label="Upload photo or PDF"
                >
                  {isUploadingRecipeImage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      <span className="text-xs truncate max-w-[100px]">{uploadingFileName || "Uploading..."}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </>
                  )}
                </Button>
                <input
                  ref={recipeImageInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={handleRecipeImageUpload}
                  className="hidden"
                />
              </div>
              {recipeUrl.trim() && !isValidUrl(recipeUrl) && (
                <p className="text-sm text-red-500">URL must start with http:// or https://</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setRecipeName("");
                setRecipeUrl("");
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRecipe}
              disabled={isSubmitting || !recipeName.trim()}
              className="bg-purple hover:bg-purple-dark"
            >
              {isSubmitting ? "Adding..." : "Add Recipe"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          recipes={event.recipesWithNotes}
          userId={user?.id || ""}
          onComplete={handleRatingsSubmitted}
          onCancel={() => setShowRatingDialog(false)}
          mode="rating"
        />
      )}
    </div>
  );
};

export default PersonalMealDetailPage;
