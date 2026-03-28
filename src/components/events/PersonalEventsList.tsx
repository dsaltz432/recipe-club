import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, startOfToday } from "date-fns";
import { Plus, ChefHat, CalendarDays, CheckCircle2, Clock, BookOpen, Pencil, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cancelEvent } from "@/lib/eventActions";

interface PersonalEvent {
  id: string;
  title: string;
  eventDate: string;
  eventTime?: string;
  status: "scheduled" | "completed" | "canceled";
  recipeCount: number;
}

interface PersonalEventsListProps {
  userId: string;
}

const PersonalEventsList = ({ userId }: PersonalEventsListProps) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<PersonalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState("19:00");
  const [eventTitle, setEventTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: eventsData, error } = await supabase
        .from("scheduled_events")
        .select("id, title, event_date, event_time, status")
        .eq("type", "personal")
        .eq("created_by", userId)
        .neq("status", "canceled")
        .order("event_date", { ascending: false });

      if (error) throw error;

      const eventIds: string[] = (eventsData ?? []).map((e) => e.id);

      // Load recipe counts per event
      const countMap: Record<string, number> = {};
      if (eventIds.length > 0) {
        const { data: recipesData } = await supabase
          .from("recipes")
          .select("event_id")
          .in("event_id", eventIds);

        for (const r of recipesData ?? []) {
          if (r.event_id) countMap[r.event_id] = (countMap[r.event_id] ?? 0) + 1;
        }
      }

      setEvents(
        (eventsData ?? [])
          .map((e) => ({
            id: e.id,
            title: e.title ?? "",
            eventDate: e.event_date,
            eventTime: e.event_time ?? undefined,
            status: e.status as PersonalEvent["status"],
            recipeCount: countMap[e.id] ?? 0,
          }))
      );
    } catch (err) {
      console.error("Error loading personal events:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleOpenCreate = () => {
    setEventTitle("");
    setSelectedDate(new Date());
    setSelectedTime("19:00");
    setShowCreateDialog(true);
  };

  const handleCreate = async () => {
    if (!selectedDate || !eventTitle.trim()) return;
    setIsCreating(true);
    try {
      const eventDate = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("scheduled_events")
        .insert({
          type: "personal",
          status: "scheduled",
          title: eventTitle.trim(),
          event_date: eventDate,
          event_time: selectedTime || null,
          created_by: userId,
        })
        .select("id")
        .single();

      if (error) throw error;
      setShowCreateDialog(false);
      navigate(`/meals/${data.id}`);
    } catch (err) {
      console.error("Error creating personal event:", err);
      toast.error("Failed to create event");
    } finally {
      setIsCreating(false);
    }
  };

  const upcoming = events.filter((e) => e.status === "scheduled");
  const past = events.filter((e) => e.status === "completed");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-purple-600" />
          <h3 className="font-display text-lg font-semibold text-gray-900">My Cooking Events</h3>
        </div>
        <Button
          size="sm"
          className="bg-purple hover:bg-purple-dark text-white"
          onClick={handleOpenCreate}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Event
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="bg-white/80 border-purple/10">
          <CardContent className="py-10 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-purple/10 flex items-center justify-center">
              <CalendarDays className="h-7 w-7 text-purple" />
            </div>
            <p className="font-medium text-gray-700">No cooking events yet</p>
            <p className="text-sm text-muted-foreground">
              Create an event to plan recipes and build a grocery list.
            </p>
            <Button
              size="sm"
              className="bg-purple hover:bg-purple-dark text-white"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Your First Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</p>
              {upcoming.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => navigate(`/meals/${event.id}`)}
                  onRefresh={loadEvents}
                />
              ))}
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past</p>
              {past.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => navigate(`/meals/${event.id}`)}
                  onRefresh={loadEvents}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Cooking Event</DialogTitle>
            <DialogDescription>
              Give your event a name, pick a date, and optionally a time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="event-title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="event-title"
                placeholder="e.g. Dumplingfest, Shabbat Brunch"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={{ before: startOfToday() }}
                className="rounded-md border"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-time">Time</Label>
              <Input
                id="event-time"
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full"
              />
            </div>
            <Button
              className="w-full bg-purple hover:bg-purple-dark text-white"
              disabled={!selectedDate || !eventTitle.trim() || isCreating}
              onClick={handleCreate}
            >
              {isCreating ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

interface EventCardProps {
  event: PersonalEvent;
  onClick: () => void;
  onRefresh: () => void;
}

const EventCard = ({ event, onClick, onRefresh }: EventCardProps) => {
  const isCompleted = event.status === "completed";
  const isUpcoming = event.status === "scheduled";

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTime, setEditTime] = useState("19:00");
  const [isUpdating, setIsUpdating] = useState(false);

  // Cancel confirmation state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(event.title);
    setEditDate(parseISO(event.eventDate));
    setEditTime(event.eventTime || "19:00");
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editDate) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("scheduled_events")
        .update({
          title: editTitle.trim() || null,
          event_date: format(editDate, "yyyy-MM-dd"),
          event_time: editTime || null,
        })
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Event updated!");
      setShowEditDialog(false);
      onRefresh();
    } catch (err) {
      console.error("Error updating event:", err);
      toast.error("Failed to update event");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCompleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("scheduled_events")
        .update({ status: "completed" })
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Event completed!");
      onRefresh();
    } catch (err) {
      console.error("Error completing event:", err);
      toast.error("Failed to complete event");
    }
  };

  const handleCancelConfirm = async () => {
    setIsCanceling(true);
    try {
      const result = await cancelEvent(event.id);
      if (result.success) {
        toast.success("Event deleted");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsCanceling(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <>
      <Card
        className="bg-white/80 border-purple/10 hover:border-purple/30 hover:shadow-md transition-all cursor-pointer"
        onClick={onClick}
      >
        <CardContent className="px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple/10 flex items-center justify-center shrink-0">
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
            ) : (
              <CalendarDays className="h-5 w-5 text-purple-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {event.title && (
              <p className="font-semibold text-sm text-gray-900 truncate">{event.title}</p>
            )}
            <p className={`text-sm truncate ${event.title ? "text-muted-foreground" : "font-medium text-gray-900"}`}>
              {format(parseISO(event.eventDate), "EEEE, MMMM d, yyyy")}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {event.eventTime && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {event.eventTime}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <BookOpen className="h-3 w-3" />
                {event.recipeCount} {event.recipeCount === 1 ? "recipe" : "recipes"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isUpcoming && (
              <>
                <Button variant="outline" size="sm" onClick={handleEditClick} className="h-8 px-2 sm:px-3">
                  <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleCompleteClick} className="h-8 px-2 sm:px-3 bg-purple/5 hover:bg-purple/10">
                  <CheckCircle className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Complete</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowCancelConfirm(true); }}
                  className="h-8 px-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Cancel</span>
                </Button>
              </>
            )}
            {isCompleted && (
              <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 text-xs">
                Completed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Event</DialogTitle>
            <DialogDescription>Change the title, date, and time for this event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`edit-title-${event.id}`}>Event Title</Label>
              <Input
                id={`edit-title-${event.id}`}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Event title"
              />
            </div>
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
              <Label htmlFor={`edit-time-${event.id}`} className="whitespace-nowrap">Event Time</Label>
              <Input
                id={`edit-time-${event.id}`}
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-32"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editDate || isUpdating} className="bg-purple hover:bg-purple-dark">
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the event and all its recipes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Keep Event</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={isCanceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? "Deleting..." : "Delete Event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PersonalEventsList;
