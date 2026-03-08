import { useEffect, useRef, useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChefHat, X, ChevronLeft, ChevronRight, List, Layers } from "lucide-react";
import type { CookModeStep as CookModeStepType } from "@/types";
import CookModeStep from "./CookModeStep";
import { getRecipeColor } from "@/lib/cookModeColors";

interface CookModeDialogProps {
  open: boolean;
  onClose: () => void;
  steps: CookModeStepType[];
  recipeNames: Map<string, string>;
  loading?: boolean;
  error?: string;
}

const CookModeDialog = ({
  open,
  onClose,
  steps,
  loading,
  error,
}: CookModeDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<"step" | "list">("step");
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Build recipe-to-color-index map from step order
  const recipeColorMap = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const colorMap = new Map<string, number>();
    let colorIndex = 0;
    steps.forEach((step) => {
      if (!colorMap.has(step.recipeId)) {
        colorMap.set(step.recipeId, colorIndex++);
      }
    });
    recipeColorMap.current = colorMap;
  }, [steps]);

  // Wake Lock: keep screen on while cooking
  useEffect(() => {
    if (!open) return;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (
            navigator as Navigator & {
              wakeLock: { request: (type: string) => Promise<WakeLockSentinel> };
            }
          ).wakeLock.request("screen");
        }
      } catch {
        // graceful fallback — wake lock not supported or denied
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [open]);

  // Reset step and view when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setViewMode("step");
    }
  }, [open]);

  const goToPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentStep((s) => Math.min(steps.length - 1, s + 1));
  }, [steps.length]);

  const jumpToStep = useCallback((index: number) => {
    setCurrentStep(index);
    setViewMode("step");
  }, []);

  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  const currentStepData = steps[currentStep];
  const currentColorIndex = currentStepData
    ? (recipeColorMap.current.get(currentStepData.recipeId) ?? 0)
    : 0;
  const currentColor = getRecipeColor(currentColorIndex);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white overflow-hidden focus:outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Cook Mode</DialogPrimitive.Title>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-800 flex-shrink-0" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-purple-400" />
              <span className="font-semibold text-sm text-slate-200">Cook Mode</span>
              {steps.length > 0 && (
                <span className="text-xs text-slate-500 ml-1">
                  {currentStep + 1} / {steps.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode((v) => (v === "step" ? "list" : "step"))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label={
                  viewMode === "step" ? "Switch to list view" : "Switch to step view"
                }
              >
                {viewMode === "step" ? (
                  <List className="h-4 w-4" />
                ) : (
                  <Layers className="h-4 w-4" />
                )}
                {viewMode === "step" ? "List" : "Steps"}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close cook mode"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 overflow-hidden relative">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-purple-500 animate-spin" />
                <p className="text-slate-400 text-sm">Generating cooking timeline...</p>
              </div>
            )}

            {error && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {!loading && !error && steps.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-slate-500 text-sm">No steps available.</p>
              </div>
            )}

            {/* Step-by-step view */}
            {!loading && !error && steps.length > 0 && viewMode === "step" && (
              <div className="h-full flex flex-col px-4 py-6 sm:px-8">
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-xl">
                    <CookModeStep step={currentStepData} color={currentColor} isActive />
                  </div>
                </div>
              </div>
            )}

            {/* List view */}
            {!loading && !error && steps.length > 0 && viewMode === "list" && (
              <div className="h-full overflow-y-auto px-4 py-4 sm:px-8 space-y-3">
                {steps.map((step, index) => {
                  const colorIndex = recipeColorMap.current.get(step.recipeId) ?? 0;
                  const color = getRecipeColor(colorIndex);
                  return (
                    <button
                      key={index}
                      onClick={() => jumpToStep(index)}
                      className="w-full text-left"
                      aria-label={`Go to step ${index + 1}`}
                    >
                      <CookModeStep step={step} color={color} isActive={index === currentStep} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation buttons (step view only) */}
          {!loading && !error && steps.length > 0 && viewMode === "step" && (
            <div className="flex-shrink-0 border-t border-slate-800 p-4 flex gap-3">
              <button
                onClick={goToPrev}
                disabled={currentStep === 0}
                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous step"
              >
                <ChevronLeft className="h-5 w-5" />
                Prev
              </button>
              <button
                onClick={goToNext}
                disabled={currentStep === steps.length - 1}
                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next step"
              >
                Next
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default CookModeDialog;
