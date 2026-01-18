import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import type { ScheduledEvent, Recipe, RecipeContribution } from "@/types";
import { format, parseISO, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Calendar as CalendarIcon, Clock, ChefHat, ExternalLink, Plus, Trash2, Pencil, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PhotoUpload from "@/components/recipes/PhotoUpload";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/googleCalendar";

interface CountdownCardProps {
  event: ScheduledEvent;
  userId: string;
  isAdmin?: boolean;
  onRecipeAdded?: () => void;
  onEventUpdated?: () => void;
  onEventCanceled?: () => void;
}

interface EventRecipeWithContributions {
  recipe: Recipe;
  contributions: RecipeContribution[];
}

const CountdownCard = ({ event, userId, isAdmin = false, onRecipeAdded, onEventUpdated, onEventCanceled }: CountdownCardProps) => {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showDetails, setShowDetails] = useState(false);
  const [eventRecipes, setEventRecipes] = useState<EventRecipeWithContributions[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Recipe form state
  const [recipeName, setRecipeName] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingContributionId, setDeletingContributionId] = useState<string | null>(null);
  const [contributionToDelete, setContributionToDelete] = useState<RecipeContribution | null>(null);

  // Autocomplete state
  const [existingRecipes, setExistingRecipes] = useState<Recipe[]>([]);
  const [showRecipeSuggestions, setShowRecipeSuggestions] = useState(false);
  const [selectedExistingRecipe, setSelectedExistingRecipe] = useState<Recipe | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Edit contribution state
  const [contributionToEdit, setContributionToEdit] = useState<RecipeContribution | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [isUpdatingContribution, setIsUpdatingContribution] = useState(false);

  // Edit event state
  const [showEditEventDialog, setShowEditEventDialog] = useState(false);
  const [editEventDate, setEditEventDate] = useState<Date | undefined>(undefined);
  const [editEventTime, setEditEventTime] = useState("19:00");
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return minutes === "00" ? `${displayHour}${ampm}` : `${displayHour}:${minutes}${ampm}`;
  };

  const loadEventRecipes = async () => {
    setIsLoadingRecipes(true);
    try {
      // Load contributions for this event
      const { data: contributionsData, error } = await supabase
        .from("recipe_contributions")
        .select(`
          *,
          recipes (*),
          profiles (name, avatar_url)
        `)
        .eq("event_id", event.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by recipe
      const recipeMap = new Map<string, EventRecipeWithContributions>();

      contributionsData?.forEach((c) => {
        const recipeId = c.recipe_id;
        if (!recipeMap.has(recipeId)) {
          recipeMap.set(recipeId, {
            recipe: {
              id: c.recipes.id,
              name: c.recipes.name,
              url: c.recipes.url || undefined,
              createdBy: c.recipes.created_by || undefined,
              createdAt: c.recipes.created_at,
            },
            contributions: [],
          });
        }
        recipeMap.get(recipeId)!.contributions.push({
          id: c.id,
          recipeId: c.recipe_id,
          userId: c.user_id || "",
          eventId: c.event_id || "",
          notes: c.notes || undefined,
          photos: c.photos || undefined,
          createdAt: c.created_at,
          userName: c.profiles?.name || "Unknown",
          userAvatar: c.profiles?.avatar_url || undefined,
        });
      });

      setEventRecipes(Array.from(recipeMap.values()));
    } catch (error) {
      console.error("Error loading recipes:", error);
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  useEffect(() => {
    const calculateCountdown = () => {
      const eventDateTime = new Date(`${event.eventDate}T${event.eventTime || "19:00"}`);
      const now = new Date();

      if (eventDateTime <= now) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = differenceInDays(eventDateTime, now);
      const hours = differenceInHours(eventDateTime, now) % 24;
      const minutes = differenceInMinutes(eventDateTime, now) % 60;
      const seconds = differenceInSeconds(eventDateTime, now) % 60;

      setCountdown({ days, hours, minutes, seconds });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, [event.eventDate, event.eventTime]);

  useEffect(() => {
    if (showDetails && event.id) {
      loadEventRecipes();
    }
  }, [showDetails, event.id]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowRecipeSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isToday = countdown.days === 0;
  const isSoon = countdown.days <= 1;
  const isTimeUp = isToday && countdown.hours === 0 && countdown.minutes === 0 && countdown.seconds === 0;

  // Load existing recipes for autocomplete
  const loadExistingRecipes = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setExistingRecipes([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .ilike("name", `%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      setExistingRecipes(
        data?.map((r) => ({
          id: r.id,
          name: r.name,
          url: r.url || undefined,
          createdBy: r.created_by || undefined,
          createdAt: r.created_at,
        })) || []
      );
    } catch (error) {
      console.error("Error loading recipes:", error);
    }
  };

  const handleRecipeNameChange = (value: string) => {
    setRecipeName(value);
    setSelectedExistingRecipe(null);
    loadExistingRecipes(value);
    setShowRecipeSuggestions(true);
  };

  const handleSelectExistingRecipe = (recipe: Recipe) => {
    setSelectedExistingRecipe(recipe);
    setRecipeName(recipe.name);
    setRecipeUrl(recipe.url || "");
    setShowRecipeSuggestions(false);
  };

  const handleSubmitRecipe = async () => {
    if (!recipeName.trim()) {
      toast.error("Please enter a recipe name");
      return;
    }

    setIsSubmitting(true);
    try {
      let recipeId: string;

      if (selectedExistingRecipe) {
        recipeId = selectedExistingRecipe.id;
      } else {
        // Create new recipe
        const { data: newRecipe, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            name: recipeName.trim(),
            url: recipeUrl.trim() || null,
            created_by: userId,
          })
          .select("id")
          .single();

        if (recipeError) throw recipeError;
        recipeId = newRecipe.id;
      }

      // Create contribution
      const { error: contributionError } = await supabase
        .from("recipe_contributions")
        .insert({
          recipe_id: recipeId,
          user_id: userId,
          event_id: event.id,
          notes: notes.trim() || null,
          photos: photos.length > 0 ? photos : null,
        });

      if (contributionError) throw contributionError;

      toast.success("Recipe added!");

      // Clear form
      setRecipeName("");
      setRecipeUrl("");
      setNotes("");
      setPhotos([]);
      setSelectedExistingRecipe(null);
      setShowAddForm(false);

      loadEventRecipes();
      onRecipeAdded?.();
    } catch (error: unknown) {
      console.error("Error saving recipe:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save recipe";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (contribution: RecipeContribution) => {
    setContributionToDelete(contribution);
  };

  const handleConfirmDelete = async () => {
    if (!contributionToDelete) return;

    setDeletingContributionId(contributionToDelete.id);
    setContributionToDelete(null);

    try {
      const { error } = await supabase
        .from("recipe_contributions")
        .delete()
        .eq("id", contributionToDelete.id);

      if (error) throw error;
      toast.success("Contribution removed");
      loadEventRecipes();
      onRecipeAdded?.();
    } catch (error) {
      console.error("Error deleting contribution:", error);
      toast.error("Failed to remove contribution");
    } finally {
      setDeletingContributionId(null);
    }
  };

  const handleEditClick = (contribution: RecipeContribution) => {
    setContributionToEdit(contribution);
    setEditNotes(contribution.notes || "");
    setEditPhotos(contribution.photos || []);
  };

  const handleSaveEdit = async () => {
    if (!contributionToEdit) return;

    setIsUpdatingContribution(true);
    try {
      const { error } = await supabase
        .from("recipe_contributions")
        .update({
          notes: editNotes.trim() || null,
          photos: editPhotos.length > 0 ? editPhotos : null,
        })
        .eq("id", contributionToEdit.id);

      if (error) throw error;
      toast.success("Contribution updated!");
      setContributionToEdit(null);
      loadEventRecipes();
      onRecipeAdded?.();
    } catch (error) {
      console.error("Error updating contribution:", error);
      toast.error("Failed to update contribution");
    } finally {
      setIsUpdatingContribution(false);
    }
  };

  const handleOpenDetails = () => {
    setShowDetails(true);
  };

  const handleEditEventClick = () => {
    setEditEventDate(parseISO(event.eventDate));
    setEditEventTime(event.eventTime || "19:00");
    setShowEditEventDialog(true);
  };

  const handleSaveEventEdit = async () => {
    if (!editEventDate) {
      toast.error("Please select a date");
      return;
    }

    if (!event.id) {
      toast.error("Event ID not found");
      return;
    }

    setIsUpdatingEvent(true);
    try {
      const newEventDate = format(editEventDate, "yyyy-MM-dd");

      // Get the event details including calendar_event_id
      const { data: eventData, error: fetchError } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (name)")
        .eq("id", event.id)
        .single();

      if (fetchError) throw fetchError;

      // Update the scheduled event
      const { error: updateError } = await supabase
        .from("scheduled_events")
        .update({
          event_date: newEventDate,
          event_time: editEventTime,
        })
        .eq("id", event.id);

      if (updateError) throw updateError;

      // Update Google Calendar event if it exists
      if (eventData.calendar_event_id) {
        const calendarResult = await updateCalendarEvent({
          calendarEventId: eventData.calendar_event_id,
          title: `Recipe Club Hub: ${eventData.ingredients?.name || "Event"}`,
          description: `Recipe Club Hub event featuring ${eventData.ingredients?.name || "a mystery ingredient"}`,
          date: editEventDate,
          time: editEventTime,
          ingredientName: eventData.ingredients?.name || "Unknown",
        });

        if (!calendarResult.success) {
          console.warn("Failed to update calendar event:", calendarResult.error);
        }
      }

      toast.success("Event updated!");
      setShowEditEventDialog(false);
      onEventUpdated?.();
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error("Failed to update event");
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!event.id) return;

    setIsCanceling(true);
    try {
      // Get the event data including calendar_event_id
      const { data: eventData, error: findError } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (*)")
        .eq("id", event.id)
        .single();

      if (findError) throw findError;

      // Delete the Google Calendar event if it exists
      if (eventData.calendar_event_id) {
        const deleteResult = await deleteCalendarEvent(eventData.calendar_event_id);
        // Only warn for actual errors, not for expected "not available" cases
        if (!deleteResult.success && !deleteResult.error?.includes("not available")) {
          console.warn("Failed to delete calendar event:", deleteResult.error);
        }
      }

      // Delete all contributions for this event
      await supabase
        .from("recipe_contributions")
        .delete()
        .eq("event_id", event.id);

      // Note: We do NOT reset the ingredient's used_count when cancelling

      // Delete the event row
      await supabase
        .from("scheduled_events")
        .delete()
        .eq("id", eventData.id);

      toast.success("Event canceled");
      setShowCancelConfirm(false);
      onEventCanceled?.();
    } catch (error) {
      console.error("Error canceling event:", error);
      toast.error("Failed to cancel event");
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <>
    <Card className="bg-gradient-to-br from-purple/10 via-white to-orange/10 border-2 border-purple/20">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Left: Event Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-purple mb-2">
              <ChefHat className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wide">
                Upcoming Event
              </span>
            </div>

            <h3 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              {event.ingredientName || "Mystery Ingredient"}
            </h3>

            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span>{format(parseISO(event.eventDate), "EEEE, MMMM d, yyyy")}</span>
              </div>
              {event.eventTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(event.eventTime)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Countdown */}
          <div className="flex-shrink-0">
            <div className={`text-center p-6 rounded-2xl ${isSoon ? 'bg-orange/10' : 'bg-purple/10'}`}>
              {isTimeUp ? (
                <div className="text-2xl font-bold text-orange">
                  It's Time!
                </div>
              ) : (
                <>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {isToday ? "Starting in" : "Countdown"}
                  </div>
                  <div className="flex items-center gap-2">
                    {countdown.days > 0 && (
                      <div className="text-center min-w-[50px]">
                        <div className="text-2xl md:text-3xl font-bold text-purple">
                          {countdown.days}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {countdown.days === 1 ? "day" : "days"}
                        </div>
                      </div>
                    )}
                    {(countdown.days > 0 || countdown.hours > 0) && (
                      <div className="text-center min-w-[50px]">
                        <div className="text-2xl md:text-3xl font-bold text-purple">
                          {String(countdown.hours).padStart(2, "0")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {countdown.hours === 1 ? "hour" : "hours"}
                        </div>
                      </div>
                    )}
                    <div className="text-center min-w-[50px]">
                      <div className="text-2xl md:text-3xl font-bold text-purple">
                        {String(countdown.minutes).padStart(2, "0")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {countdown.minutes === 1 ? "min" : "mins"}
                      </div>
                    </div>
                    <div className="text-center min-w-[50px]">
                      <div className="text-2xl md:text-3xl font-bold text-purple">
                        {String(countdown.seconds).padStart(2, "0")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {countdown.seconds === 1 ? "sec" : "secs"}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 text-center md:text-left flex flex-wrap gap-3 justify-center md:justify-start">
          <Button
            variant="outline"
            className="border-purple text-purple hover:bg-purple hover:text-white"
            onClick={handleOpenDetails}
          >
            View Event Details
          </Button>
          {isAdmin && userId === event.createdBy && (
            <>
              <Button
                variant="outline"
                onClick={handleEditEventClick}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Event
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowCancelConfirm(true)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Event
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Event Details Dialog */}
    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-purple" />
            {event.ingredientName || "Mystery Ingredient"}
          </DialogTitle>
          <DialogDescription>
            {format(parseISO(event.eventDate), "EEEE, MMMM d, yyyy")}
            {event.eventTime && ` at ${formatTime(event.eventTime)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* All Recipes Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">
                Recipes ({eventRecipes.length})
              </h4>
              {!showAddForm && isAdmin && (
                <Button
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                  className="bg-purple hover:bg-purple-dark"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Recipe
                </Button>
              )}
            </div>
            {isLoadingRecipes ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple"></div>
              </div>
            ) : eventRecipes.length === 0 && !showAddForm ? (
              <p className="text-sm text-muted-foreground">
                No recipes locked in yet. Be the first!
              </p>
            ) : (
              <div className="space-y-4">
                {eventRecipes.map(({ recipe, contributions }) => (
                  <div key={recipe.id} className="p-4 rounded-lg bg-gray-50 space-y-3">
                    {/* Recipe header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{recipe.name}</h4>
                        {recipe.url && (
                          <a
                            href={recipe.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-purple hover:underline flex items-center gap-1"
                          >
                            View recipe <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {contributions.length} contribution{contributions.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Contributions */}
                    <div className="space-y-2 pl-4 border-l-2 border-purple/20">
                      {contributions.map((contribution) => (
                        <div key={contribution.id} className="flex items-start gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={contribution.userAvatar} />
                            <AvatarFallback>{contribution.userName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{contribution.userName}</span>
                              {contribution.userId === userId && (
                                <span className="text-xs bg-purple/10 text-purple px-1.5 py-0.5 rounded">You</span>
                              )}
                            </div>
                            {contribution.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{contribution.notes}</p>
                            )}
                            {contribution.photos && contribution.photos.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {contribution.photos.map((photo, idx) => (
                                  <img
                                    key={idx}
                                    src={photo}
                                    alt=""
                                    className="h-16 w-16 object-cover rounded"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          {contribution.userId === userId && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleEditClick(contribution)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={deletingContributionId === contribution.id}
                                onClick={() => handleDeleteClick(contribution)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add your contribution button */}
                    {isAdmin && !contributions.some((c) => c.userId === userId) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-purple border-purple/30"
                        onClick={() => {
                          setSelectedExistingRecipe(recipe);
                          setRecipeName(recipe.name);
                          setRecipeUrl(recipe.url || "");
                          setShowAddForm(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add your notes/photos
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Recipe Form */}
          {showAddForm && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">
                    {selectedExistingRecipe ? "Add Your Notes" : "Add a Recipe"}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setRecipeName("");
                      setRecipeUrl("");
                      setNotes("");
                      setPhotos([]);
                      setSelectedExistingRecipe(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="space-y-4">
                  {!selectedExistingRecipe && (
                    <>
                      <div className="space-y-2 relative" ref={autocompleteRef}>
                        <Label htmlFor="recipe-name">
                          Recipe Name *
                        </Label>
                        <Input
                          id="recipe-name"
                          value={recipeName}
                          onChange={(e) => handleRecipeNameChange(e.target.value)}
                          onFocus={() => setShowRecipeSuggestions(true)}
                          placeholder="Start typing to search existing recipes..."
                        />
                        {/* Autocomplete dropdown */}
                        {showRecipeSuggestions && existingRecipes.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                            {existingRecipes.map((recipe) => (
                              <button
                                key={recipe.id}
                                className="w-full px-3 py-2 text-left hover:bg-gray-50"
                                onClick={() => handleSelectExistingRecipe(recipe)}
                              >
                                <div className="font-medium">{recipe.name}</div>
                                {recipe.url && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {recipe.url}
                                  </div>
                                )}
                              </button>
                            ))}
                            <button
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-purple border-t"
                              onClick={() => setShowRecipeSuggestions(false)}
                            >
                              <Plus className="h-4 w-4" />
                              Create new recipe "{recipeName}"
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recipe-url">
                          Recipe URL (optional)
                        </Label>
                        <Input
                          id="recipe-url"
                          type="url"
                          value={recipeUrl}
                          onChange={(e) => setRecipeUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </>
                  )}

                  {selectedExistingRecipe && (
                    <div className="p-3 bg-purple/5 rounded-lg">
                      <p className="text-sm text-muted-foreground">Adding contribution to:</p>
                      <p className="font-medium">{selectedExistingRecipe.name}</p>
                      {selectedExistingRecipe.url && (
                        <a
                          href={selectedExistingRecipe.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple hover:underline"
                        >
                          {selectedExistingRecipe.url}
                        </a>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes / Variations (optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special tips or variations?"
                      rows={2}
                    />
                  </div>

                  <PhotoUpload photos={photos} onPhotosChange={setPhotos} />

                  <Button
                    onClick={handleSubmitRecipe}
                    disabled={isSubmitting || !recipeName.trim()}
                    className="w-full bg-purple hover:bg-purple-dark"
                  >
                    {isSubmitting ? "Adding..." : selectedExistingRecipe ? "Add Contribution" : "Add Recipe"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Contribution Confirmation */}
    <AlertDialog open={!!contributionToDelete} onOpenChange={(open) => !open && setContributionToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Contribution?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete your contribution? This action cannot be undone.
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

    {/* Edit Contribution Dialog */}
    <Dialog open={!!contributionToEdit} onOpenChange={(open) => !open && setContributionToEdit(null)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Edit Contribution
          </DialogTitle>
          <DialogDescription>
            Update your notes and photos.
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
              rows={2}
            />
          </div>

          <PhotoUpload photos={editPhotos} onPhotosChange={setEditPhotos} />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setContributionToEdit(null)}
            disabled={isUpdatingContribution}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            disabled={isUpdatingContribution}
            className="bg-purple hover:bg-purple-dark"
          >
            {isUpdatingContribution ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Edit Event Dialog */}
    <Dialog open={showEditEventDialog} onOpenChange={setShowEditEventDialog}>
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
              selected={editEventDate}
              onSelect={setEditEventDate}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </div>

          <div className="flex items-center gap-4 px-4">
            <Label htmlFor="edit-event-time" className="whitespace-nowrap">Event Time</Label>
            <Input
              id="edit-event-time"
              type="time"
              value={editEventTime}
              onChange={(e) => setEditEventTime(e.target.value)}
              className="w-32"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowEditEventDialog(false)}
            disabled={isUpdatingEvent}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveEventEdit}
            disabled={!editEventDate || isUpdatingEvent}
            className="bg-purple hover:bg-purple-dark"
          >
            {isUpdatingEvent ? "Saving..." : "Save Changes"}
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
            This will cancel the {event.ingredientName} event and remove all associated recipes.
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
    </>
  );
};

export default CountdownCard;
