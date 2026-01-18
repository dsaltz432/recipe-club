import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Ingredient, ScheduledEvent } from "@/types";
import { MIN_INGREDIENTS_TO_SPIN, WHEEL_COLORS } from "@/lib/constants";
import confetti from "canvas-confetti";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createCalendarEvent } from "@/lib/googleCalendar";
import { v4 as uuidv4 } from "uuid";

interface IngredientWheelProps {
  ingredients: Ingredient[];
  onEventCreated: () => void;
  userId: string;
  disabled?: boolean;
  activeEvent?: ScheduledEvent | null;
}

const IngredientWheel = ({ ingredients, onEventCreated, userId, disabled = false, activeEvent }: IngredientWheelProps) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("19:00");
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isLockingIn, setIsLockingIn] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Only show ingredients that are in the bank
  const bankIngredients = ingredients.filter((i) => i.inBank);
  const hasEnoughIngredients = bankIngredients.length >= MIN_INGREDIENTS_TO_SPIN;
  const canSpin = hasEnoughIngredients && !disabled;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "pm" : "am";
    const displayHour = hour % 12 || 12;
    return minutes === "00" ? `${displayHour}${ampm}` : `${displayHour}:${minutes}${ampm}`;
  };

  const spinWheel = () => {
    if (!canSpin || isSpinning) return;

    setIsSpinning(true);
    setSelectedIngredient(null);

    // Pick a random ingredient (avoid same as last)
    let randomIndex: number;
    do {
      randomIndex = Math.floor(Math.random() * bankIngredients.length);
    } while (randomIndex === lastSelectedIndex && bankIngredients.length > 1);

    setLastSelectedIndex(randomIndex);

    // Calculate rotation to land on the selected ingredient
    const segmentAngle = 360 / bankIngredients.length;
    const segmentCenter = segmentAngle * randomIndex + segmentAngle / 2;

    // CSS conic-gradient starts at TOP (0deg) and goes clockwise
    // Pointer is at the top. After rotating wheel clockwise by R degrees,
    // the wheel position under the pointer is (360 - R % 360) % 360
    // We want this to equal segmentCenter:
    // (360 - R % 360) % 360 = segmentCenter
    // R % 360 = (360 - segmentCenter) % 360
    const targetMod = (360 - segmentCenter + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;

    // How much more to rotate to reach target position
    let additionalRotation = (targetMod - currentMod + 360) % 360;
    if (additionalRotation < 30) additionalRotation += 360; // Ensure visible rotation

    const spins = 5 + Math.floor(Math.random() * 4); // 5, 6, 7, or 8 full spins (integer)
    const finalRotation = rotation + spins * 360 + additionalRotation;

    setRotation(finalRotation);

    // After spin completes
    setTimeout(() => {
      setIsSpinning(false);
      setSelectedIngredient(bankIngredients[randomIndex]);
      setShowDatePicker(true);

      // Confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: WHEEL_COLORS,
      });
    }, 6000);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  const handleConfirm = async () => {
    if (!selectedIngredient || !selectedDate) return;

    setIsLockingIn(true);

    try {
      const eventDateStr = format(selectedDate, "yyyy-MM-dd");
      const eventId = uuidv4();

      // Try to create Google Calendar event first
      const calendarResult = await createCalendarEvent({
        title: `Recipe Club Hub: ${selectedIngredient.name}`,
        description: `Recipe Club Hub event featuring ${selectedIngredient.name}`,
        date: selectedDate,
        time: selectedTime,
        ingredientName: selectedIngredient.name,
      });

      // Create the scheduled event with calendar_event_id if available
      const { error: eventError } = await supabase
        .from("scheduled_events")
        .insert({
          id: eventId,
          ingredient_id: selectedIngredient.id,
          event_date: eventDateStr,
          event_time: selectedTime,
          created_by: userId,
          status: "scheduled",
          calendar_event_id: calendarResult.eventId || null,
        });

      if (eventError) throw eventError;

      // Note: used_count is incremented when event is COMPLETED, not when scheduled

      // Success confetti!
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: WHEEL_COLORS,
      });

      if (calendarResult.success) {
        toast.success(`Event created! Calendar invite sent for ${format(selectedDate, "MMMM d, yyyy")} at ${formatTime(selectedTime)}`);
      } else {
        toast.success(`Event created for ${format(selectedDate, "MMMM d, yyyy")} at ${formatTime(selectedTime)}! (Calendar invite not sent)`);
      }

      setShowDatePicker(false);
      setSelectedIngredient(null);
      setSelectedDate(undefined);
      setSelectedTime("19:00");
      onEventCreated();
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Failed to create event. Please try again.");
    } finally {
      setIsLockingIn(false);
    }
  };

  const handleSpinAgain = () => {
    setShowDatePicker(false);
    setSelectedIngredient(null);
    setSelectedDate(undefined);
    setSelectedTime("19:00");
    spinWheel();
  };

  // Generate wheel segments
  const renderWheel = () => {
    if (bankIngredients.length === 0) {
      return (
        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500 text-center px-4">
            Add ingredients to spin!
          </span>
        </div>
      );
    }

    const segmentAngle = 360 / bankIngredients.length;

    return (
      <div
        ref={wheelRef}
        className="w-full h-full rounded-full relative overflow-hidden"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          background: `conic-gradient(${bankIngredients
            .map(
              (_, i) =>
                `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${i * segmentAngle}deg ${
                  (i + 1) * segmentAngle
                }deg`
            )
            .join(", ")})`,
        }}
      >
        {/* Ingredient labels */}
        {bankIngredients.map((ingredient, i) => {
          // Angle to center of segment (in conic-gradient coords: 0 = top, clockwise)
          const segmentCenterAngle = segmentAngle * i + segmentAngle / 2;

          // Convert to math coords for positioning (0 = right, counter-clockwise)
          const mathAngle = segmentCenterAngle - 90;
          const radians = (mathAngle * Math.PI) / 180;

          // Position label along the radius, closer to outer edge
          const x = 50 + 36 * Math.cos(radians);
          const y = 50 + 36 * Math.sin(radians);

          // Text rotation: radial orientation, but flip on right side so always readable
          // Right side of wheel: segmentCenterAngle 270-360 or 0-90 (text should point inward)
          // Left side of wheel: segmentCenterAngle 90-270 (text should point outward)
          const isRightSide = segmentCenterAngle <= 90 || segmentCenterAngle > 270;
          const textRotation = isRightSide
            ? segmentCenterAngle + 90  // Point inward (readable from outside)
            : segmentCenterAngle - 90; // Point outward (readable from outside)

          return (
            <div
              key={ingredient.id}
              className="absolute text-[11px] font-bold text-white"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(${textRotation}deg)`,
                textShadow: "1px 1px 2px rgba(0,0,0,0.7), -1px -1px 2px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.5)",
                whiteSpace: "nowrap",
                opacity: ingredient.usedCount > 2 ? 0.85 : 1,
              }}
            >
              {ingredient.name}
              {ingredient.usedCount > 0 && (
                <span className="ml-1 text-[9px] opacity-75">
                  ({ingredient.usedCount})
                </span>
              )}
            </div>
          );
        })}

        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-purple"></div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-center">
            Ingredient Wheel
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {/* Wheel Container */}
          <div className="relative">
            {/* Pointer */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-purple drop-shadow-lg"></div>
            </div>

            {/* Wheel */}
            <div className="w-64 h-64 md:w-80 md:h-80">{renderWheel()}</div>
          </div>

          {/* Spin Button */}
          <Button
            onClick={spinWheel}
            disabled={!canSpin || isSpinning}
            size="lg"
            className="bg-purple hover:bg-purple-dark text-white px-8"
          >
            {isSpinning ? "Spinning..." : "Spin!"}
          </Button>

          {/* Progress Message */}
          {activeEvent && (
            <div className="text-sm text-muted-foreground text-center bg-orange/10 p-3 rounded-lg">
              <p className="font-medium text-orange">Active event in progress</p>
              <p>
                Event on {format(parseISO(activeEvent.eventDate), "MMMM d, yyyy")} with{" "}
                <span className="font-medium">{activeEvent.ingredientName}</span>
              </p>
              <p className="mt-1">Complete or cancel the current event to spin again.</p>
            </div>
          )}
          {!activeEvent && !hasEnoughIngredients && (
            <p className="text-sm text-muted-foreground text-center">
              Add {MIN_INGREDIENTS_TO_SPIN - bankIngredients.length} more
              ingredient{MIN_INGREDIENTS_TO_SPIN - bankIngredients.length !== 1 ? "s" : ""} to
              spin the wheel!
            </p>
          )}
          {!activeEvent && hasEnoughIngredients && disabled && (
            <p className="text-sm text-muted-foreground text-center">
              Only admins can spin the wheel.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Date Picker Dialog */}
      <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              You landed on: {selectedIngredient?.name}
            </DialogTitle>
            <DialogDescription>
              Choose a date for your recipe club event, or spin again for a
              different ingredient.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </div>

          <div className="flex items-center gap-4 px-4">
            <Label htmlFor="event-time" className="whitespace-nowrap">Event Time</Label>
            <Input
              id="event-time"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-32"
            />
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleSpinAgain} disabled={isLockingIn}>
              Spin Again
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedDate || isLockingIn}
              className="bg-purple hover:bg-purple-dark"
            >
              {isLockingIn ? "Creating Event..." : "Lock In Ingredient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IngredientWheel;
