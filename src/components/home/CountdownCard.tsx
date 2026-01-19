import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ScheduledEvent } from "@/types";
import { format, parseISO, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Calendar as CalendarIcon, Clock, ChefHat, Pencil, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/googleCalendar";

interface CountdownCardProps {
  event: ScheduledEvent;
  userId: string;
  isAdmin?: boolean;
  onRecipeAdded?: () => void;
  onEventUpdated?: () => void;
  onEventCanceled?: () => void;
}

const CountdownCard = ({ event, userId, isAdmin = false, onEventUpdated, onEventCanceled }: CountdownCardProps) => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

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

  const isToday = countdown.days === 0;
  const isSoon = countdown.days <= 1;
  const isTimeUp = isToday && countdown.hours === 0 && countdown.minutes === 0 && countdown.seconds === 0;

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

      // Note: Recipes cascade delete with the event (ON DELETE CASCADE)
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
    <Card className="bg-gradient-to-br from-purple/15 via-white to-orange/15 border-2 border-purple/20 shadow-lg overflow-hidden">
      <CardContent className="p-4 sm:p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8">
          {/* Left: Event Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 text-purple mb-2">
              <div className="p-1.5 sm:p-2 bg-purple/10 rounded-full">
                <ChefHat className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
                Upcoming Event
              </span>
            </div>

            <h3 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              {event.ingredientName || "Mystery Ingredient"}
            </h3>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex items-center gap-1.5 bg-purple/5 px-2.5 py-1 rounded-full">
                <CalendarIcon className="h-3.5 w-3.5 text-purple" />
                <span className="font-medium text-xs sm:text-sm text-muted-foreground">{format(parseISO(event.eventDate), "EEE, MMM d")}</span>
              </div>
              {event.eventTime && (
                <div className="flex items-center gap-1.5 bg-orange/5 px-2.5 py-1 rounded-full">
                  <Clock className="h-3.5 w-3.5 text-orange" />
                  <span className="font-medium text-xs sm:text-sm text-muted-foreground">{formatTime(event.eventTime)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                className="bg-gradient-to-r from-purple to-purple-dark hover:from-purple-dark hover:to-purple text-white shadow-md"
                onClick={() => navigate(`/event/${event.id}`)}
              >
                View Event Details
              </Button>
              {isAdmin && userId === event.createdBy && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditEventClick}
                    className="h-8 px-3 text-xs"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCancelConfirm(true)}
                    className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Right: Countdown */}
          <div className="flex-shrink-0 self-center">
            <div className={`text-center p-4 sm:p-6 rounded-2xl ${isSoon ? 'bg-gradient-to-br from-orange/20 to-orange/5 border border-orange/20' : 'bg-gradient-to-br from-purple/20 to-purple/5 border border-purple/20'}`}>
              {isTimeUp ? (
                <div className="text-xl sm:text-2xl font-bold text-orange animate-pulse">
                  It's Time!
                </div>
              ) : (
                <>
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                    {isToday ? "Starting in" : "Countdown"}
                  </div>
                  <div className="flex items-center justify-center gap-1 sm:gap-2">
                    {countdown.days > 0 && (
                      <div className="text-center min-w-[40px] sm:min-w-[50px] bg-white/80 p-1.5 sm:p-2 rounded-lg shadow-sm">
                        <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple">
                          {countdown.days}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                          {countdown.days === 1 ? "day" : "days"}
                        </div>
                      </div>
                    )}
                    {(countdown.days > 0 || countdown.hours > 0) && (
                      <div className="text-center min-w-[40px] sm:min-w-[50px] bg-white/80 p-1.5 sm:p-2 rounded-lg shadow-sm">
                        <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple">
                          {String(countdown.hours).padStart(2, "0")}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                          {countdown.hours === 1 ? "hr" : "hrs"}
                        </div>
                      </div>
                    )}
                    <div className="text-center min-w-[40px] sm:min-w-[50px] bg-white/80 p-1.5 sm:p-2 rounded-lg shadow-sm">
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple">
                        {String(countdown.minutes).padStart(2, "0")}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                        min
                      </div>
                    </div>
                    <div className="text-center min-w-[40px] sm:min-w-[50px] bg-white/80 p-1.5 sm:p-2 rounded-lg shadow-sm">
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple tabular-nums">
                        {String(countdown.seconds).padStart(2, "0")}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                        sec
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

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
