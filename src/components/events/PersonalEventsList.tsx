import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Plus, ChefHat, CalendarDays, CheckCircle2, Clock, BookOpen } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PersonalEvent {
  id: string;
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
  const [selectedTime, setSelectedTime] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: eventsData, error } = await (supabase as any)
        .from("scheduled_events")
        .select("id, event_date, event_time, status")
        .eq("type", "personal")
        .eq("created_by", userId)
        .neq("status", "canceled")
        .order("event_date", { ascending: false });

      if (error) throw error;

      const allEventIds: string[] = (eventsData ?? []).map((e: { id: string }) => e.id);

      // Filter out events auto-created by meal planner (they have meal_plan_items rows)
      let standaloneEventIds = allEventIds;
      if (allEventIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mealPlanLinked } = await (supabase as any)
          .from("meal_plan_items")
          .select("event_id")
          .in("event_id", allEventIds)
          .not("event_id", "is", null);
        const mealPlanEventIds = new Set(
          (mealPlanLinked ?? []).map((m: { event_id: string }) => m.event_id)
        );
        standaloneEventIds = allEventIds.filter((id) => !mealPlanEventIds.has(id));
      }

      // Load recipe counts per standalone event
      const countMap: Record<string, number> = {};
      if (standaloneEventIds.length > 0) {
        const { data: recipesData } = await supabase
          .from("recipes")
          .select("event_id")
          .in("event_id", standaloneEventIds);

        for (const r of recipesData ?? []) {
          if (r.event_id) countMap[r.event_id] = (countMap[r.event_id] ?? 0) + 1;
        }
      }

      const standaloneSet = new Set(standaloneEventIds);
      setEvents(
        (eventsData ?? [])
          .filter((e: { id: string }) => standaloneSet.has(e.id))
          .map((e: { id: string; event_date: string; event_time: string | null; status: string }) => ({
          id: e.id,
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

  const handleCreate = async () => {
    if (!selectedDate) return;
    setIsCreating(true);
    try {
      const eventDate = format(selectedDate, "yyyy-MM-dd");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("scheduled_events")
        .insert({
          type: "personal",
          status: "scheduled",
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
          onClick={() => setShowCreateDialog(true)}
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
              onClick={() => setShowCreateDialog(true)}
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
                <EventCard key={event.id} event={event} onClick={() => navigate(`/meals/${event.id}`)} />
              ))}
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past</p>
              {past.map((event) => (
                <EventCard key={event.id} event={event} onClick={() => navigate(`/meals/${event.id}`)} />
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
              Pick a date and optionally a time. You'll add recipes and build a grocery list after creating the event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-time">Time (optional)</Label>
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
              disabled={!selectedDate || isCreating}
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
}

const EventCard = ({ event, onClick }: EventCardProps) => {
  const isCompleted = event.status === "completed";
  return (
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
          <p className="font-medium text-sm text-gray-900">
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
        <Badge
          variant="outline"
          className={isCompleted
            ? "border-green-200 text-green-700 bg-green-50 text-xs"
            : "border-purple/20 text-purple-700 bg-purple/5 text-xs"
          }
        >
          {isCompleted ? "Completed" : "Upcoming"}
        </Badge>
      </CardContent>
    </Card>
  );
};

export default PersonalEventsList;
