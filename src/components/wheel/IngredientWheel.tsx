import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getIngredientColor, getContrastTextColor, assignWheelColorsWithContrast, reorderForColorContrast } from "@/lib/ingredientColors";
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
  const bankIngredientsUnordered = ingredients.filter((i) => i.inBank);

  // Reorder ingredients for optimal color contrast on the wheel
  const bankIngredients = useMemo(() => {
    if (bankIngredientsUnordered.length <= 2) return bankIngredientsUnordered;

    const colors = bankIngredientsUnordered.map(
      (ing) => ing.color || getIngredientColor(ing.name)
    );
    const reorderedIndices = reorderForColorContrast(colors);
    return reorderedIndices.map((i) => bankIngredientsUnordered[i]);
  }, [bankIngredientsUnordered]);

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

      // Remove ingredient from bank (used_count is incremented when event is COMPLETED)
      const { error: ingredientError } = await supabase
        .from("ingredients")
        .update({ in_bank: false })
        .eq("id", selectedIngredient.id);

      if (ingredientError) {
        console.error("Error removing ingredient from bank:", ingredientError);
        // Don't throw - event was created successfully, this is non-critical
      }

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

    // Get ingredient colors and assign vibrant wheel colors with contrast optimization
    const ingredientColors = bankIngredients.map(
      (ingredient) => ingredient.color || getIngredientColor(ingredient.name)
    );
    const sliceColors = assignWheelColorsWithContrast(ingredientColors, WHEEL_COLORS);

    return (
      <div
        ref={wheelRef}
        className="w-full h-full rounded-full relative overflow-hidden"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          background: `conic-gradient(${sliceColors
            .map(
              (color, i) => `${color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`
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

          // Text rotation: all text points radially toward the center
          const textRotation = segmentCenterAngle + 90;

          // Get text color that contrasts well with the slice color
          const sliceColor = sliceColors[i];
          const textColor = getContrastTextColor(sliceColor);
          // Use appropriate shadow based on text color
          const textShadow = textColor === "#ffffff"
            ? "1px 1px 2px rgba(0,0,0,0.7), -1px -1px 2px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.5)"
            : "1px 1px 2px rgba(255,255,255,0.7), -1px -1px 2px rgba(255,255,255,0.7), 0 0 4px rgba(255,255,255,0.5)";

          return (
            <div
              key={ingredient.id}
              className="absolute text-[11px] font-bold"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(${textRotation}deg)`,
                color: textColor,
                textShadow,
                whiteSpace: "nowrap",
                opacity: ingredient.usedCount > 2 ? 0.85 : 1,
              }}
            >
              {ingredient.name}
            </div>
          );
        })}

        {/* Center Spin Button - counter-rotate to keep text upright */}
        <button
          onClick={spinWheel}
          disabled={!canSpin || isSpinning}
          className="absolute top-1/2 left-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center cursor-pointer hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100 border-4 border-purple"
          style={{
            transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
            transition: isSpinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "transform 0.2s ease",
            boxShadow: "0 0 20px rgba(155, 135, 245, 0.5), 0 4px 15px rgba(0, 0, 0, 0.2)",
          }}
        >
          <span className="font-bold text-base sm:text-lg text-purple drop-shadow-sm">
            {isSpinning ? "..." : "Spin!"}
          </span>
        </button>
      </div>
    );
  };

  return (
    <>
      <Card className="bg-white/90 backdrop-blur-sm border-2 border-purple/10 shadow-md">
        <CardContent className="flex flex-col items-center gap-3 sm:gap-4 px-3 sm:px-6 py-4 sm:py-6">
          {/* Wheel Container */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple/20 to-orange/20 rounded-full blur-xl scale-110 opacity-50"></div>
            {/* Pointer */}
            <div className="absolute -top-2 sm:-top-3 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[10px] sm:border-l-[12px] border-r-[10px] sm:border-r-[12px] border-t-[16px] sm:border-t-[20px] border-l-transparent border-r-transparent border-t-purple drop-shadow-lg"></div>
            </div>

            {/* Wheel */}
            <div className="w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 relative z-0">{renderWheel()}</div>
          </div>

          {/* Progress Message */}
          {activeEvent && (
            <div className="text-xs sm:text-sm text-muted-foreground text-center bg-gradient-to-r from-orange/10 to-orange/5 border border-orange/20 p-3 rounded-xl w-full">
              <p className="font-semibold text-orange">Active event in progress</p>
              <p className="mt-1">
                Event on {format(parseISO(activeEvent.eventDate), "MMM d, yyyy")} with{" "}
                <span className="font-semibold">{activeEvent.ingredientName}</span>
              </p>
              <p className="mt-1 text-[10px] sm:text-xs">Complete or cancel the current event to spin again.</p>
            </div>
          )}
          {!activeEvent && !hasEnoughIngredients && (
            <p className="text-xs sm:text-sm text-muted-foreground text-center bg-purple/5 px-4 py-2 rounded-lg">
              Add <strong className="text-purple">{MIN_INGREDIENTS_TO_SPIN - bankIngredients.length}</strong> more
              ingredient{MIN_INGREDIENTS_TO_SPIN - bankIngredients.length !== 1 ? "s" : ""} to
              spin the wheel!
            </p>
          )}
          {!activeEvent && hasEnoughIngredients && disabled && (
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
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
