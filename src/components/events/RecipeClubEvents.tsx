import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
import type { Recipe, RecipeContribution, EventRecipeWithContributions } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon,
  Users,
  ExternalLink,
  X,
  ChefHat,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { updateCalendarEvent } from "@/lib/googleCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PhotoUpload from "@/components/recipes/PhotoUpload";
import { deleteCalendarEvent } from "@/lib/googleCalendar";
import EventRatingDialog from "./EventRatingDialog";

interface RecipeClubEventsProps {
  userId: string;
  isAdmin?: boolean;
  onEventChange?: () => void;
}

interface EventData {
  eventId: string;
  eventDate: string;
  eventTime?: string;
  status: "scheduled" | "completed";
  ingredientId: string;
  ingredientName?: string;
  createdBy?: string;
  recipesWithContributions: EventRecipeWithContributions[];
  participantCount: number;
}

const RecipeClubEvents = ({ userId, isAdmin = false, onEventChange }: RecipeClubEventsProps) => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEvents = async () => {
    try {
      // Fetch all scheduled and completed events with their ingredients
      const { data: eventsData, error: eventsError } = await supabase
        .from("scheduled_events")
        .select(`
          *,
          ingredients (*)
        `)
        .in("status", ["scheduled", "completed"])
        .order("event_date", { ascending: true });

      if (eventsError) throw eventsError;

      // Fetch all contributions with recipes and user profiles for these events
      const eventIds = eventsData?.map(e => e.id) || [];

      const { data: contributionsData, error: contributionsError } = await supabase
        .from("recipe_contributions")
        .select(`
          *,
          recipes (*),
          profiles (name, avatar_url)
        `)
        .in("event_id", eventIds);

      if (contributionsError) throw contributionsError;

      // Group contributions by event and then by recipe
      const eventMap = new Map<string, EventData>();

      eventsData?.forEach((event) => {
        eventMap.set(event.id, {
          eventId: event.id,
          eventDate: event.event_date,
          eventTime: event.event_time || undefined,
          status: event.status as "scheduled" | "completed",
          ingredientId: event.ingredient_id || "",
          ingredientName: event.ingredients?.name || undefined,
          createdBy: event.created_by || undefined,
          recipesWithContributions: [],
          participantCount: 0,
        });
      });

      // Group contributions by recipe within each event
      contributionsData?.forEach((contribution) => {
        const eventId = contribution.event_id;
        if (!eventId || !eventMap.has(eventId)) return;

        const eventData = eventMap.get(eventId)!;
        const recipeId = contribution.recipe_id;

        // Find or create the recipe entry
        let recipeEntry = eventData.recipesWithContributions.find(
          (r) => r.recipe.id === recipeId
        );

        if (!recipeEntry) {
          recipeEntry = {
            recipe: {
              id: contribution.recipes.id,
              name: contribution.recipes.name,
              url: contribution.recipes.url || undefined,
              createdBy: contribution.recipes.created_by || undefined,
              createdAt: contribution.recipes.created_at,
            },
            contributions: [],
          };
          eventData.recipesWithContributions.push(recipeEntry);
        }

        recipeEntry.contributions.push({
          id: contribution.id,
          recipeId: contribution.recipe_id,
          userId: contribution.user_id || "",
          eventId: contribution.event_id || "",
          notes: contribution.notes || undefined,
          photos: contribution.photos || undefined,
          createdAt: contribution.created_at,
          userName: contribution.profiles?.name || "Unknown",
          userAvatar: contribution.profiles?.avatar_url || undefined,
        });
      });

      // Calculate participant counts
      eventMap.forEach((event) => {
        const uniqueUsers = new Set<string>();
        event.recipesWithContributions.forEach((r) => {
          r.contributions.forEach((c) => {
            if (c.userId) uniqueUsers.add(c.userId);
          });
        });
        event.participantCount = uniqueUsers.size;
      });

      // Sort events: upcoming first (by date ascending), then past (by date descending)
      const allEvents = Array.from(eventMap.values());
      const upcoming = allEvents.filter((e) => e.status === "scheduled").sort(
        (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      );
      const past = allEvents.filter((e) => e.status === "completed").sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
      );

      setEvents([...upcoming, ...past]);
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const cancelEvent = async (eventId: string) => {
    if (!isAdmin) {
      toast.error("Only admins can cancel events");
      return;
    }

    try {
      // Find the event
      const { data: eventData, error: findError } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (*)")
        .eq("id", eventId)
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
        .eq("event_id", eventId);

      // Note: We do NOT reset the ingredient's used_count when cancelling
      // The count tracks how many times it was used historically

      // Delete the event row
      await supabase
        .from("scheduled_events")
        .delete()
        .eq("id", eventData.id);

      toast.success("Event cancelled and calendar invite removed!");
      loadEvents();
      onEventChange?.();
    } catch (error) {
      console.error("Error cancelling event:", error);
      toast.error("Failed to cancel event");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No events yet. Spin the wheel to create one!
            </p>
          </CardContent>
        </Card>
      ) : (
        events.map((event) => {
          const isUpcoming = event.status === "scheduled";
          return (
            <EventCard
              key={event.eventId}
              event={event}
              userId={userId}
              isAdmin={isAdmin}
              onCancel={isUpcoming ? () => cancelEvent(event.eventId) : undefined}
              onEdit={loadEvents}
              isUpcoming={isUpcoming}
              onRecipesChanged={loadEvents}
              onEventChange={onEventChange}
            />
          );
        })
      )}
    </div>
  );
};

interface EventCardProps {
  event: EventData;
  userId: string;
  isAdmin?: boolean;
  onCancel?: () => void;
  onEdit?: () => void;
  isUpcoming: boolean;
  onRecipesChanged?: () => void;
  onEventChange?: () => void;
}

const EventCard = ({ event, userId, isAdmin = false, onCancel, onEdit, isUpcoming, onRecipesChanged, onEventChange }: EventCardProps) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contributionToDelete, setContributionToDelete] = useState<RecipeContribution | null>(null);
  const [deletingContributionId, setDeletingContributionId] = useState<string | null>(null);

  // Edit event state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTime, setEditTime] = useState("19:00");
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit contribution state
  const [contributionToEdit, setContributionToEdit] = useState<RecipeContribution | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [isUpdatingContribution, setIsUpdatingContribution] = useState(false);

  // Rating dialog state
  const [showRatingDialog, setShowRatingDialog] = useState(false);

  // Recipe autocomplete state
  const [existingRecipes, setExistingRecipes] = useState<Recipe[]>([]);
  const [showRecipeSuggestions, setShowRecipeSuggestions] = useState(false);
  const [selectedExistingRecipe, setSelectedExistingRecipe] = useState<Recipe | null>(null);

  const totalContributions = event.recipesWithContributions.reduce(
    (sum, r) => sum + r.contributions.length,
    0
  );

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    onCancel?.();
  };

  const handleEditClick = () => {
    setEditDate(parseISO(event.eventDate));
    setEditTime(event.eventTime || "19:00");
    setShowEditDialog(true);
  };

  const handleCompleteClick = () => {
    // Show rating dialog before completing event
    setShowRatingDialog(true);
  };

  const handleRatingsComplete = async () => {
    // After ratings are submitted, complete the event and increment used_count
    try {
      // Update event status to completed
      await supabase
        .from("scheduled_events")
        .update({ status: "completed" })
        .eq("id", event.eventId);

      // Increment the ingredient's used_count
      if (event.ingredientId) {
        // First get current count
        const { data: ingredientData } = await supabase
          .from("ingredients")
          .select("used_count")
          .eq("id", event.ingredientId)
          .single();

        // Then increment
        await supabase
          .from("ingredients")
          .update({
            used_count: (ingredientData?.used_count || 0) + 1,
            last_used_date: new Date().toISOString(),
            last_used_by: userId,
          })
          .eq("id", event.ingredientId);
      }

      toast.success("Event marked as completed!");
      setShowRatingDialog(false);
      onRecipesChanged?.();
      onEventChange?.();
    } catch (error) {
      console.error("Error completing event:", error);
      toast.error("Failed to complete event");
    }
  };

  const handleSaveEdit = async () => {
    if (!editDate) {
      toast.error("Please select a date");
      return;
    }

    setIsUpdating(true);
    try {
      const newEventDate = format(editDate, "yyyy-MM-dd");

      // Get the event details including calendar_event_id and ingredient name
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
          title: `Recipe Club Hub: ${eventData.ingredients?.name || "Event"}`,
          description: `Recipe Club Hub event featuring ${eventData.ingredients?.name || "a mystery ingredient"}`,
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
      onEdit?.();
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error("Failed to update event");
    } finally {
      setIsUpdating(false);
    }
  };

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
        // Use existing recipe
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
          event_id: event.eventId,
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
      onRecipesChanged?.();
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
      onRecipesChanged?.();
    } catch (error) {
      console.error("Error deleting contribution:", error);
      toast.error("Failed to remove contribution");
    } finally {
      setDeletingContributionId(null);
    }
  };

  const handleEditContributionClick = (contribution: RecipeContribution) => {
    setContributionToEdit(contribution);
    setEditNotes(contribution.notes || "");
    setEditPhotos(contribution.photos || []);
  };

  const handleSaveContributionEdit = async () => {
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
      onRecipesChanged?.();
    } catch (error) {
      console.error("Error updating contribution:", error);
      toast.error("Failed to update contribution");
    } finally {
      setIsUpdatingContribution(false);
    }
  };

  return (
    <>
      <Card
        className={`backdrop-blur-sm cursor-pointer hover:shadow-md transition-shadow ${
          isUpcoming
            ? "bg-gradient-to-r from-purple/10 via-white to-orange/10 border-purple/30"
            : "bg-white/80"
        }`}
        onClick={() => setShowDetails(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isUpcoming ? "bg-purple/20" : "bg-purple/10"
              }`}>
                <ChefHat className="h-6 w-6 text-purple" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="font-display text-lg">
                    {event.ingredientName && (
                      <span className="text-purple">{event.ingredientName}</span>
                    )}
                    {event.ingredientName && " · "}
                    {format(parseISO(event.eventDate), "MMMM d, yyyy")}
                    {event.eventTime && (
                      <span className="text-muted-foreground font-normal text-base ml-2">
                        at {formatTime(event.eventTime)}
                      </span>
                    )}
                  </CardTitle>
                  {isUpcoming && (
                    <span className="text-xs bg-purple text-white px-2 py-0.5 rounded-full">
                      Upcoming
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {event.participantCount} participant
                    {event.participantCount !== 1 ? "s" : ""} · {totalContributions} recipe{totalContributions !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
            {isUpcoming && isAdmin && (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {userId === event.createdBy && (
                  <Button variant="outline" size="sm" onClick={handleEditClick}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleCompleteClick}>
                  Complete Event
                </Button>
                {onCancel && userId === event.createdBy && (
                  <Button variant="ghost" size="sm" onClick={handleCancelClick}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-purple" />
              {event.ingredientName || format(parseISO(event.eventDate), "MMMM d, yyyy")}
            </DialogTitle>
            <DialogDescription>
              {format(parseISO(event.eventDate), "MMMM d, yyyy")}
              {event.eventTime && ` at ${formatTime(event.eventTime)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* All Recipes Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">
                  Recipes ({event.recipesWithContributions.length})
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

              {event.recipesWithContributions.length === 0 && !showAddForm ? (
                <p className="text-sm text-muted-foreground">
                  No recipes locked in yet. Be the first!
                </p>
              ) : (
                <div className="space-y-4">
                  {event.recipesWithContributions.map(({ recipe, contributions }) => (
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
                                  onClick={() => handleEditContributionClick(contribution)}
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

                      {/* Add your contribution button (if user hasn't contributed to this recipe) */}
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
                        <div className="space-y-2 relative">
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

      {/* Cancel Event Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Event?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this event? This will remove the calendar invite and all associated recipes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Event</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              onClick={handleSaveEdit}
              disabled={!editDate || isUpdating}
              className="bg-purple hover:bg-purple-dark"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              onClick={handleSaveContributionEdit}
              disabled={isUpdatingContribution}
              className="bg-purple hover:bg-purple-dark"
            >
              {isUpdatingContribution ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      {showRatingDialog && (
        <EventRatingDialog
          event={event}
          recipes={event.recipesWithContributions}
          userId={userId}
          onComplete={handleRatingsComplete}
          onCancel={() => setShowRatingDialog(false)}
        />
      )}
    </>
  );
};

export default RecipeClubEvents;
