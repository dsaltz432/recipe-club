import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { EventRecipeWithNotes } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon,
  X,
  ChefHat,
  Pencil,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/googleCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EventRatingDialog from "./EventRatingDialog";
import { getIngredientColor, getLightBackgroundColor, getBorderColor, getDarkerTextColor } from "@/lib/ingredientColors";

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
  ingredientColor?: string;
  createdBy?: string;
  recipesWithNotes: EventRecipeWithNotes[];
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

      const eventIds = eventsData?.map(e => e.id) || [];

      // Fetch recipes for these events (recipes now have event_id directly)
      const { data: recipesData, error: recipesError } = await supabase
        .from("recipes")
        .select("*")
        .in("event_id", eventIds);

      if (recipesError) throw recipesError;

      // Fetch notes for these recipes
      const recipeIds = recipesData?.map(r => r.id) || [];
      const { data: notesData, error: notesError } = await supabase
        .from("recipe_notes")
        .select(`
          *,
          profiles (name, avatar_url)
        `)
        .in("recipe_id", recipeIds);

      if (notesError) throw notesError;

      // Build event map
      const eventMap = new Map<string, EventData>();

      eventsData?.forEach((event) => {
        const ingredientName = event.ingredients?.name;
        const ingredientColor = event.ingredients?.color || (ingredientName ? getIngredientColor(ingredientName) : undefined);
        eventMap.set(event.id, {
          eventId: event.id,
          eventDate: event.event_date,
          eventTime: event.event_time || undefined,
          status: event.status as "scheduled" | "completed",
          ingredientId: event.ingredient_id || "",
          ingredientName: ingredientName || undefined,
          ingredientColor,
          createdBy: event.created_by || undefined,
          recipesWithNotes: [],
          participantCount: 0,
        });
      });

      // Group notes by recipe
      const notesByRecipe = new Map<string, typeof notesData>();
      notesData?.forEach((note) => {
        const existing = notesByRecipe.get(note.recipe_id) || [];
        existing.push(note);
        notesByRecipe.set(note.recipe_id, existing);
      });

      // Add recipes to their events
      recipesData?.forEach((recipe) => {
        const eventId = recipe.event_id;
        if (!eventId || !eventMap.has(eventId)) return;

        const eventData = eventMap.get(eventId)!;
        const recipeNotes = notesByRecipe.get(recipe.id) || [];

        eventData.recipesWithNotes.push({
          recipe: {
            id: recipe.id,
            name: recipe.name,
            url: recipe.url || undefined,
            eventId: recipe.event_id || undefined,
            ingredientId: recipe.ingredient_id || undefined,
            createdBy: recipe.created_by || undefined,
            createdAt: recipe.created_at,
          },
          notes: recipeNotes.map((note) => ({
            id: note.id,
            recipeId: note.recipe_id,
            userId: note.user_id,
            notes: note.notes || undefined,
            photos: note.photos || undefined,
            createdAt: note.created_at,
            userName: note.profiles?.name || "Unknown",
            userAvatar: note.profiles?.avatar_url || undefined,
          })),
        });
      });

      // Calculate participant counts (users who added recipes)
      eventMap.forEach((event) => {
        const uniqueUsers = new Set<string>();
        event.recipesWithNotes.forEach((r) => {
          if (r.recipe.createdBy) uniqueUsers.add(r.recipe.createdBy);
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

      // Note: Recipes cascade delete with the event (ON DELETE CASCADE)
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
  const navigate = useNavigate();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Edit event state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTime, setEditTime] = useState("19:00");
  const [isUpdating, setIsUpdating] = useState(false);

  // Rating dialog state
  const [showRatingDialog, setShowRatingDialog] = useState(false);

  const totalRecipes = event.recipesWithNotes.length;

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

  // Get background, border, and text colors from ingredient color
  const bgColor = event.ingredientColor ? getLightBackgroundColor(event.ingredientColor) : undefined;
  const borderColor = event.ingredientColor ? getBorderColor(event.ingredientColor) : undefined;
  const textColor = event.ingredientColor ? getDarkerTextColor(event.ingredientColor) : "#9b87f5";

  return (
    <>
      <Card
        className={`backdrop-blur-sm cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${
          isUpcoming
            ? "border-2 shadow-md"
            : "border shadow-sm"
        }`}
        style={{
          backgroundColor: bgColor || (isUpcoming ? undefined : "rgba(255,255,255,0.9)"),
          borderColor: borderColor || (isUpcoming ? "rgba(155, 135, 245, 0.2)" : "rgba(155, 135, 245, 0.1)"),
        }}
        onClick={() => navigate(`/events/${event.eventId}`)}
      >
        <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: event.ingredientColor
                    ? getLightBackgroundColor(event.ingredientColor)
                    : isUpcoming ? "rgba(155, 135, 245, 0.2)" : "rgba(155, 135, 245, 0.1)",
                }}
              >
                <ChefHat
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  style={{ color: textColor }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="font-display text-base sm:text-lg">
                    {event.ingredientName && (
                      <span className="font-bold" style={{ color: textColor }}>
                        {event.ingredientName}
                      </span>
                    )}
                  </CardTitle>
                  {isUpcoming && (
                    <span className="text-[10px] sm:text-xs bg-gradient-to-r from-purple to-purple-dark text-white px-2 py-0.5 rounded-full font-medium">
                      Upcoming
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-0.5">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="font-medium">{format(parseISO(event.eventDate), "MMM d, yyyy")}</span>
                  </div>
                  {event.eventTime && (
                    <span className="text-muted-foreground">
                      {formatTime(event.eventTime)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                  <ChefHat className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>
                    <strong className="text-orange">{totalRecipes}</strong> recipe{totalRecipes !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
            {isUpcoming && isAdmin && (
              <div className="flex gap-1 sm:gap-2 shrink-0 ml-auto sm:ml-0" onClick={(e) => e.stopPropagation()}>
                {userId === event.createdBy && (
                  <Button variant="outline" size="sm" onClick={handleEditClick} className="h-8 px-2 sm:px-3">
                    <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleCompleteClick} className="h-8 px-2 sm:px-3 bg-purple/5 hover:bg-purple/10">
                  <span className="hidden sm:inline">Complete</span>
                  <span className="sm:hidden">Done</span>
                </Button>
                {onCancel && userId === event.createdBy && (
                  <Button variant="ghost" size="sm" onClick={handleCancelClick} className="h-8 px-2 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

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

      {/* Rating Dialog */}
      {showRatingDialog && (
        <EventRatingDialog
          event={event}
          recipes={event.recipesWithNotes}
          userId={userId}
          onComplete={handleRatingsComplete}
          onCancel={() => setShowRatingDialog(false)}
        />
      )}
    </>
  );
};

export default RecipeClubEvents;
