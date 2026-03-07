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
import { Calendar as CalendarIcon, Clock, ChefHat, Pencil, X, CheckCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cancelEvent, completeEvent, updateEvent } from "@/lib/eventActions";

interface CountdownCardProps {
  event: ScheduledEvent;
  userId: string;
  isAdmin?: boolean;
  onRecipeAdded?: () => void;
  onEventUpdated?: () => void;
  onEventCanceled?: () => void;
  clubMemberNames?: string[];
  _testNullDate?: boolean;
}

const CountdownCard = ({ event, userId, isAdmin = false, onEventUpdated, onEventCanceled, clubMemberNames, _testNullDate }: CountdownCardProps) => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

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

  const handleCompleteEvent = async () => {
    if (!event.id) return;

    setIsCompleting(true);
    try {
      const result = await completeEvent(event.id, event.ingredientId || "", userId || "");
      if (result.success) {
        toast.success("Event marked as completed!");
        setShowCompleteConfirm(false);
        onEventUpdated?.();
      } else {
        console.error("Error completing event:", result.error);
        toast.error("Failed to complete event");
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const handleEditEventClick = () => {
    setEditEventDate(parseISO(event.eventDate));
    setEditEventTime(event.eventTime || "19:00");
    setShowEditEventDialog(true);
  };

  const handleSaveEventEdit = async () => {
    if (_testNullDate || !editEventDate) {
      toast.error("Please select a date");
      return;
    }

    if (!event.id) {
      toast.error("Event ID not found");
      return;
    }

    setIsUpdatingEvent(true);
    try {
      const result = await updateEvent(event.id, editEventDate, editEventTime);
      if (result.success) {
        toast.success("Event updated!");
        setShowEditEventDialog(false);
        onEventUpdated?.();
      } else {
        toast.error("Failed to update event");
      }
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!event.id) return;

    setIsCanceling(true);
    try {
      const result = await cancelEvent(event.id);
      if (result.success) {
        toast.success("Event canceled");
        setShowCancelConfirm(false);
        onEventCanceled?.();
      } else {
        toast.error("Failed to cancel event");
      }
    } finally {
      setIsCanceling(false);
    }
  };

  const renderCountdown = () => (
    <div className={`text-center p-3 sm:p-6 rounded-2xl ${isSoon ? 'bg-gradient-to-br from-orange/20 to-orange/5 border border-orange/20' : 'bg-gradient-to-br from-purple/20 to-purple/5 border border-purple/20'}`}>
      {isTimeUp ? (
        <div className="space-y-1 sm:space-y-2">
          <div className="text-lg sm:text-2xl font-bold text-orange animate-pulse">
            It's Time!
          </div>
          <button
            onClick={() => navigate(`/events/${event.id}`)}
            className="text-xs sm:text-sm text-purple hover:text-purple-dark underline underline-offset-2"
          >
            Head to the event for recipes and cooking!
          </button>
        </div>
      ) : (
        <>
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground mb-1.5 sm:mb-2 font-semibold">
            {isToday ? "Starting in" : "Countdown"}
          </div>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {countdown.days > 0 && (
              <div className="text-center min-w-[44px] sm:min-w-[50px] bg-white/80 p-1.5 sm:p-2 rounded-lg shadow-sm">
                <div className="text-lg sm:text-2xl md:text-3xl font-bold text-purple tabular-nums">
                  {countdown.days}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {countdown.days === 1 ? "day" : "days"}
                </div>
              </div>
            )}
            {(countdown.days > 0 || countdown.hours > 0) && (
              <div className="text-center min-w-[44px] sm:min-w-[50px] bg-white/80 p-1.5 sm:p-2 rounded-lg shadow-sm">
                <div className="text-lg sm:text-2xl md:text-3xl font-bold text-purple tabular-nums">
                  {String(countdown.hours).padStart(2, "0")}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {countdown.hours === 1 ? "hr" : "hrs"}
                </div>
              </div>
            )}
            <div className="text-center min-w-[44px] sm:min-w-[50px] bg-white/80 p-1.5 sm:p-2 rounded-lg shadow-sm">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold text-purple tabular-nums">
                {String(countdown.minutes).padStart(2, "0")}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                min
              </div>
            </div>
            <div className="text-center min-w-[44px] sm:min-w-[50px] bg-white/80 p-1.5 sm:p-2 rounded-lg shadow-sm">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold text-purple tabular-nums">
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
  );

  return (
    <>
    <Card className="bg-gradient-to-br from-purple/15 via-white to-orange/15 border-2 border-purple/20 shadow-lg overflow-hidden">
      <CardContent className="p-3 sm:p-6 md:p-8">
        {/* Mobile: compact stacked layout */}
        {/* Desktop: side-by-side with countdown on right */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          {/* Event Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 text-purple mb-2">
              <div className="p-1.5 sm:p-2 bg-purple/10 rounded-full">
                <ChefHat className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
                Upcoming Event
              </span>
            </div>

            {/* Ingredient name + date/time pills side by side */}
            <div className="flex items-start justify-between gap-2 sm:block mb-1 sm:mb-0">
              <h3 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 sm:mb-1">
                {event.ingredientName || "Mystery Ingredient"}
              </h3>
              {/* Date/time pills - right-aligned on mobile, below name on desktop */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 sm:mb-4 shrink-0">
                <div className="flex items-center gap-1 sm:gap-1.5 bg-purple/5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                  <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple" />
                  <span className="font-medium text-[11px] sm:text-sm text-muted-foreground">{format(parseISO(event.eventDate), "EEE, MMM d")}</span>
                </div>
                {event.eventTime && (
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-orange/5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange" />
                    <span className="font-medium text-[11px] sm:text-sm text-muted-foreground">{formatTime(event.eventTime)}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Members below the name row */}
            {clubMemberNames && clubMemberNames.length > 0 && (
              <div className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                <span className="font-medium">Members:</span> {clubMemberNames.join(", ")}
              </div>
            )}

            {/* Countdown - inline on mobile between header and buttons */}
            <div className="md:hidden my-3">
              {renderCountdown()}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 sm:w-fit">
              <Button
                className="bg-gradient-to-r from-purple to-purple-dark hover:from-purple-dark hover:to-purple text-white shadow-md w-full text-sm"
                size="sm"
                onClick={() => navigate(`/events/${event.id}`)}
              >
                View Event Details
              </Button>
              {isAdmin && userId === event.createdBy && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditEventClick}
                    className="h-8 px-2.5 text-xs flex-1 sm:flex-none"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompleteConfirm(true)}
                    className="h-8 px-2.5 text-xs bg-purple/5 hover:bg-purple/10 flex-1 sm:flex-none"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCancelConfirm(true)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 flex-1 sm:flex-none"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Countdown - desktop only */}
          <div className="hidden md:flex flex-shrink-0 self-center">
            {renderCountdown()}
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Complete Event Confirmation */}
    <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark Event as Complete?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the {event.ingredientName} event as completed and increment the ingredient's usage count.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCompleting}>Keep Scheduled</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCompleteEvent}
            disabled={isCompleting}
            className="bg-purple hover:bg-purple-dark"
          >
            {isCompleting ? "Completing..." : "Mark Complete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
              disabled={(date) => { const today = new Date(); today.setHours(0,0,0,0); return date < today; }}
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
            This will permanently delete the {event.ingredientName} event and all associated recipes, notes, ratings, meal plan references, and Google Calendar event. This cannot be undone.
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
