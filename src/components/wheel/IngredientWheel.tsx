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
import type { Ingredient } from "@/types";
import { MIN_INGREDIENTS_TO_SPIN, WHEEL_COLORS } from "@/lib/constants";
import confetti from "canvas-confetti";

interface IngredientWheelProps {
  ingredients: Ingredient[];
  onResult: (ingredient: Ingredient, date: Date) => void;
}

const IngredientWheel = ({ ingredients, onResult }: IngredientWheelProps) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const availableIngredients = ingredients.filter((i) => !i.isUsed);
  const canSpin = availableIngredients.length >= MIN_INGREDIENTS_TO_SPIN;

  const spinWheel = () => {
    if (!canSpin || isSpinning) return;

    setIsSpinning(true);
    setSelectedIngredient(null);

    // Pick a random ingredient (avoid same as last)
    let randomIndex: number;
    do {
      randomIndex = Math.floor(Math.random() * availableIngredients.length);
    } while (randomIndex === lastSelectedIndex && availableIngredients.length > 1);

    setLastSelectedIndex(randomIndex);

    // Calculate rotation to land on the selected ingredient
    const segmentAngle = 360 / availableIngredients.length;
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
      setSelectedIngredient(availableIngredients[randomIndex]);
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

  const handleConfirm = () => {
    if (selectedIngredient && selectedDate) {
      onResult(selectedIngredient, selectedDate);
      setShowDatePicker(false);
      setSelectedIngredient(null);
      setSelectedDate(undefined);
    }
  };

  const handleSpinAgain = () => {
    setShowDatePicker(false);
    setSelectedIngredient(null);
    setSelectedDate(undefined);
    spinWheel();
  };

  // Generate wheel segments
  const renderWheel = () => {
    if (availableIngredients.length === 0) {
      return (
        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500 text-center px-4">
            Add ingredients to spin!
          </span>
        </div>
      );
    }

    const segmentAngle = 360 / availableIngredients.length;

    return (
      <div
        ref={wheelRef}
        className="w-full h-full rounded-full relative overflow-hidden"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning ? "transform 6s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          background: `conic-gradient(${availableIngredients
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
        {availableIngredients.map((ingredient, i) => {
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
              }}
            >
              {ingredient.name}
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
          {!canSpin && (
            <p className="text-sm text-muted-foreground text-center">
              Add {MIN_INGREDIENTS_TO_SPIN - availableIngredients.length} more
              ingredient{MIN_INGREDIENTS_TO_SPIN - availableIngredients.length !== 1 ? "s" : ""} to
              spin the wheel!
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

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleSpinAgain}>
              Spin Again
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedDate}
              className="bg-purple hover:bg-purple-dark"
            >
              Lock In Ingredient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IngredientWheel;
