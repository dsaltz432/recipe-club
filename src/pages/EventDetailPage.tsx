import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUser, getAllowedUser, isAdmin } from "@/lib/auth";
import type { User, Recipe, RecipeNote, EventRecipeWithNotes, RecipeRatingsSummary } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
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
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ChefHat,
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  X,
  Camera,
  Star,
  ChevronDown,
  ChevronUp,
  Upload,
  Loader2,
} from "lucide-react";
import PhotoUpload from "@/components/recipes/PhotoUpload";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/googleCalendar";
import EventRatingDialog from "@/components/events/EventRatingDialog";
import { v4 as uuidv4 } from "uuid";
import { getIngredientColor, getLightBackgroundColor, getBorderColor, getDarkerTextColor } from "@/lib/ingredientColors";

// Helper to render stars with half-star support
const renderStars = (rating: number, starSize = "h-4 w-4") => {
  return [1, 2, 3, 4, 5].map((star) => {
    if (rating >= star) {
      // Full star
      return <Star key={star} className={`${starSize} fill-yellow-400 text-yellow-400`} />;
    } else if (rating >= star - 0.5) {
      // Half star - use relative positioning to overlay half-filled on empty
      return (
        <div key={star} className={`${starSize} relative`}>
          <Star className={`${starSize} text-gray-300 absolute`} />
          <div className="overflow-hidden w-1/2">
            <Star className={`${starSize} fill-yellow-400 text-yellow-400`} />
          </div>
        </div>
      );
    } else {
      // Empty star
      return <Star key={star} className={`${starSize} text-gray-300`} />;
    }
  });
};

interface EventRecipeWithRatings extends EventRecipeWithNotes {
  ratingSummary?: RecipeRatingsSummary;
}

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
  const [recipeName, setRecipeName] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingRecipeImage, setIsUploadingRecipeImage] = useState(false);
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
        if (summary.totalRatings > 0) {
          summary.averageRating = summary.averageRating / summary.totalRatings;
          summary.wouldCookAgainPercent = Math.round(
            (summary.wouldCookAgainPercent / summary.totalRatings) * 100
          );
        }
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

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser?.email) {
        const allowed = await getAllowedUser(currentUser.email);
        setUserIsMember(allowed?.is_club_member ?? false); // Only club members can rate
        setUserIsAdmin(isAdmin(allowed));
      }

      await loadEventData();
      setIsLoading(false);
    };

    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const isValidUrl = (url: string) => {
    return url.trim().startsWith("http://") || url.trim().startsWith("https://");
  };

  // Send email notification to club members
  const sendRecipeNotification = async (
    type: "added" | "updated",
    recipeNameVal: string,
    recipeUrlVal: string
  ) => {
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

  const handleRecipeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large (max 5MB)");
      return;
    }

    setIsUploadingRecipeImage(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("recipe-images").getPublicUrl(filePath);

      setRecipeUrl(publicUrl);
      toast.success("Image uploaded!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingRecipeImage(false);
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
    if (!recipeUrl.trim() || !isValidUrl(recipeUrl)) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }
    if (!user?.id || !event) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Create new recipe with event_id and ingredient_id
      const { error: recipeError } = await supabase
        .from("recipes")
        .insert({
          name: recipeName.trim(),
          url: recipeUrl.trim() || null,
          event_id: event.eventId,
          ingredient_id: event.ingredientId,
          created_by: user.id,
        });

      if (recipeError) throw recipeError;

      toast.success("Recipe added!");

      // Send notification to club members
      sendRecipeNotification("added", recipeName.trim(), recipeUrl.trim());

      // Clear form
      setRecipeName("");
      setRecipeUrl("");
      setShowAddForm(false);
      loadEventData();
    } catch (error: unknown) {
      console.error("Error saving recipe:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save recipe";
      toast.error(errorMessage);
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
    if (!editRecipeUrl.trim() || !isValidUrl(editRecipeUrl)) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }

    const urlChanged = recipeToEdit.url !== editRecipeUrl.trim();

    setIsEditingRecipe(true);
    try {
      const { error } = await supabase
        .from("recipes")
        .update({
          name: editRecipeName.trim(),
          url: editRecipeUrl.trim(),
        })
        .eq("id", recipeToEdit.id);

      if (error) throw error;

      toast.success("Recipe updated!");

      // Send notification only if URL changed
      if (urlChanged) {
        sendRecipeNotification("updated", editRecipeName.trim(), editRecipeUrl.trim());
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
      } else if (recipeForNewNote) {
        // Create new note for recipe
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
      // Delete the note entirely (not just clearing fields)
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

  const handleEditEventClick = () => {
    if (!event) return;
    setEditDate(parseISO(event.eventDate));
    setEditTime(event.eventTime || "19:00");
    setShowEditDialog(true);
  };

  const handleSaveEventEdit = async () => {
    if (!editDate || !event) {
      toast.error("Please select a date");
      return;
    }

    setIsUpdating(true);
    try {
      const newEventDate = format(editDate, "yyyy-MM-dd");

      // Get the event details including calendar_event_id
      const { data: eventData, error: fetchError } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (name)")
        .eq("id", event.eventId)
        .single();

      if (fetchError) throw fetchError;

      // Update the scheduled event
      const { error: updateError } = await supabase
        .from("scheduled_events")
        .update({
          event_date: newEventDate,
          event_time: editTime,
        })
        .eq("id", event.eventId);

      if (updateError) throw updateError;

      // Update Google Calendar event if it exists
      if (eventData.calendar_event_id) {
        const calendarResult = await updateCalendarEvent({
          calendarEventId: eventData.calendar_event_id,
          date: editDate,
          time: editTime,
          ingredientName: eventData.ingredients?.name || "Unknown",
        });

        if (!calendarResult.success) {
          console.warn("Failed to update calendar event:", calendarResult.error);
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
    if (!event) return;

    setIsCanceling(true);
    try {
      // Get the event data including calendar_event_id
      const { data: eventData, error: findError } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (*)")
        .eq("id", event.eventId)
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
    setShowRatingDialog(true);
  };

  const handleRatingsSubmitted = () => {
    // Just reload the data to show updated ratings
    setShowRatingDialog(false);
    loadEventData();
  };

  const handleRatingsComplete = async () => {
    if (!event) return;

    try {
      // Update event status to completed
      await supabase
        .from("scheduled_events")
        .update({ status: "completed" })
        .eq("id", event.eventId);

      // Increment the ingredient's used_count
      if (event.ingredientId) {
        const { data: ingredientData } = await supabase
          .from("ingredients")
          .select("used_count")
          .eq("id", event.ingredientId)
          .single();

        await supabase
          .from("ingredients")
          .update({
            used_count: (ingredientData?.used_count || 0) + 1,
            last_used_date: new Date().toISOString(),
            last_used_by: user?.id,
          })
          .eq("id", event.ingredientId);
      }

      toast.success("Event marked as completed!");
      setShowRatingDialog(false);
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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/events")}
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
          {isUpcoming && userIsAdmin && user?.id === event?.createdBy && (
            <div className="flex gap-1 sm:gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleEditEventClick} className="px-2 sm:px-3">
                <Pencil className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelConfirm(true)}
                className="text-muted-foreground hover:text-destructive px-2 sm:px-3"
              >
                <X className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            </div>
          )}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
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
              {isUpcoming && userIsAdmin && (
                <Button
                  onClick={handleCompleteClick}
                  className="bg-gradient-to-r from-purple to-purple-dark hover:from-purple-dark hover:to-purple text-white shadow-md w-full sm:w-auto"
                >
                  Complete Event
                </Button>
              )}
              {!isUpcoming && userIsMember && totalRecipes > 0 && (
                <Button
                  onClick={handleRateRecipesClick}
                  variant="outline"
                  className="border-purple text-purple hover:bg-purple/10 w-full sm:w-auto"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Rate Recipes
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recipes Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg sm:text-xl font-semibold">
              Recipes ({event?.recipesWithNotes.length || 0})
            </h2>
            {userIsAdmin && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-gradient-to-r from-purple to-purple-dark hover:from-purple-dark hover:to-purple text-white shadow-md"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span>Add Recipe</span>
              </Button>
            )}
          </div>


          {/* Recipe List */}
          {event?.recipesWithNotes.length === 0 ? (
            <Card className="bg-white/90 backdrop-blur-sm border-2 border-dashed border-purple/20">
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                <div className="w-16 h-16 rounded-full bg-purple/10 flex items-center justify-center mb-4">
                  <ChefHat className="h-8 w-8 text-purple" />
                </div>
                <p className="text-muted-foreground text-center text-sm sm:text-base">
                  No recipes locked in yet. Be the first to add one!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {event?.recipesWithNotes.map(({ recipe, notes, ratingSummary }) => {
                const hasUserNote = notes.some(n => n.userId === user?.id);

                return (
                <Card key={recipe.id} className="bg-white/90 backdrop-blur-sm border border-purple/10 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:py-4 sm:px-6 space-y-3">
                    {/* Recipe header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                        {recipe.createdByName && (
                          <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 ring-2 ring-purple/20">
                            <AvatarImage src={recipe.createdByAvatar} />
                            <AvatarFallback className="bg-purple/10 text-purple text-xs">
                              {recipe.createdByName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-base sm:text-lg truncate">{recipe.name}</h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {recipe.createdByName && (
                              <span className="text-xs text-muted-foreground">
                                by {recipe.createdByName}
                              </span>
                            )}
                            {recipe.url && (
                              <a
                                href={recipe.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs sm:text-sm text-purple hover:text-purple-dark hover:underline flex items-center gap-1 font-medium"
                              >
                                View recipe <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {/* Rating display */}
                          {ratingSummary && ratingSummary.totalRatings > 0 && (
                            <div className="flex flex-col gap-1 mt-2">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                  {renderStars(ratingSummary.averageRating, "h-3.5 w-3.5 sm:h-4 sm:w-4")}
                                </div>
                                <span className="text-xs sm:text-sm font-medium">
                                  {Number.isInteger(ratingSummary.averageRating)
                                    ? ratingSummary.averageRating
                                    : ratingSummary.averageRating.toFixed(1)}/5
                                </span>
                              </div>
                              {ratingSummary.memberRatings && ratingSummary.memberRatings.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                                  <span>Make again:</span>
                                  {ratingSummary.memberRatings.map((member, idx) => (
                                    <span key={idx} className={member.wouldCookAgain ? "text-green-600" : "text-red-500"}>
                                      {member.initial}: {member.wouldCookAgain ? "Yes" : "No"}
                                      {idx < ratingSummary.memberRatings!.length - 1 && ","}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {notes.length > 0 && (
                          <span className="text-[10px] sm:text-xs bg-purple/10 text-purple px-2 py-0.5 rounded-full font-medium">
                            {notes.length} {notes.length !== 1 ? "notes" : "note"}
                          </span>
                        )}
                        {(recipe.createdBy === user?.id || userIsAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={() => handleEditRecipeClick(recipe)}
                          >
                            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Notes Section */}
                    {notes.length > 0 && (
                      <>
                        {expandedRecipeNotes.has(recipe.id) && (
                          <>
                            <Separator className="bg-purple/10" />
                            <div className="space-y-3">
                              {notes.map((note) => (
                                <div key={note.id} className="flex items-start gap-2 sm:gap-3 pl-2 sm:pl-3 border-l-2 border-purple/30">
                                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 ring-2 ring-purple/10">
                                    <AvatarImage src={note.userAvatar} />
                                    <AvatarFallback className="bg-purple/10 text-purple text-xs">{note.userName?.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                      <span className="font-medium text-sm sm:text-base">{note.userName}'s Notes</span>
                                      {note.photos && note.photos.length > 0 && (
                                        <span className="flex items-center gap-0.5 text-[10px] sm:text-xs text-muted-foreground">
                                          <Camera className="h-3 w-3" />
                                          {note.photos.length}
                                        </span>
                                      )}
                                    </div>
                                    {note.notes && (
                                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{note.notes}</p>
                                    )}
                                    {note.photos && note.photos.length > 0 && (
                                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1 -mx-1 px-1">
                                        {note.photos.map((photo, idx) => (
                                          <img
                                            key={idx}
                                            src={photo}
                                            alt=""
                                            className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg shadow-sm shrink-0"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {note.userId === user?.id && (
                                    <div className="flex gap-0.5 sm:gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 sm:h-8 sm:w-8"
                                        onClick={() => handleEditNoteClick(note)}
                                      >
                                        <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 sm:h-8 sm:w-8"
                                        disabled={deletingNoteId === note.id}
                                        onClick={() => handleDeleteClick(note)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {/* Toggle notes button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground"
                          onClick={() => toggleRecipeNotes(recipe.id)}
                        >
                          {expandedRecipeNotes.has(recipe.id) ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Hide Notes
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Show Notes ({notes.length})
                            </>
                          )}
                        </Button>
                      </>
                    )}

                    {/* Add notes button - show for users who haven't added notes yet */}
                    {!hasUserNote && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-purple border-purple/30"
                        onClick={() => handleAddNotesClick(recipe)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add notes
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
        </div>
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
            <DialogTitle className="font-display text-xl">
              Add a Recipe
            </DialogTitle>
            <DialogDescription>
              Add a recipe for the {event?.ingredientName} event.
            </DialogDescription>
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
              <Label htmlFor="recipe-url">Recipe URL</Label>
              <div className="flex gap-2">
                <Input
                  id="recipe-url"
                  type="url"
                  value={recipeUrl}
                  onChange={(e) => setRecipeUrl(e.target.value)}
                  placeholder="https://... or upload an image"
                  className={`flex-1 ${recipeUrl.trim() && !isValidUrl(recipeUrl) ? "border-red-500" : ""}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => recipeImageInputRef.current?.click()}
                  disabled={isUploadingRecipeImage}
                  className="shrink-0"
                >
                  {isUploadingRecipeImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={recipeImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleRecipeImageUpload}
                  className="hidden"
                />
              </div>
              {recipeUrl.trim() && !isValidUrl(recipeUrl) && (
                <p className="text-sm text-red-500">URL must start with http:// or https://</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter a URL or upload an image (max 5MB)
              </p>
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
              disabled={isSubmitting || !recipeName.trim() || !isValidUrl(recipeUrl)}
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
          if (!open) {
            setRecipeToEdit(null);
          }
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
              <Label htmlFor="edit-recipe-url">Recipe URL *</Label>
              <Input
                id="edit-recipe-url"
                type="url"
                value={editRecipeUrl}
                onChange={(e) => setEditRecipeUrl(e.target.value)}
                placeholder="https://..."
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
              disabled={isEditingRecipe || !editRecipeName.trim() || !isValidUrl(editRecipeUrl)}
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
                disabled={(date) => date < new Date()}
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
              This will cancel the {event?.ingredientName} event and remove all associated recipes.
              This action cannot be undone.
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
          recipes={event.recipesWithNotes}
          userId={user?.id || ""}
          onComplete={ratingDialogMode === "completing" ? handleRatingsComplete : handleRatingsSubmitted}
          onCancel={() => setShowRatingDialog(false)}
          mode={ratingDialogMode}
        />
      )}
    </div>
  );
};

export default EventDetailPage;
