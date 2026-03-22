import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChefHat, X, ChevronLeft, ChevronRight, CheckCircle2, ChevronUp, ChevronDown, List, Columns2 } from "lucide-react";
import type { CookModeStep as CookModeStepType, RecipeIngredient } from "@/types";
import type { CookViewMode } from "@/hooks/useCookMode";
import CookModeSidebar from "./CookModeSidebar";
import CookModeComplete from "./CookModeComplete";
import { getRecipeColor } from "@/lib/cookModeColors";
import { cn } from "@/lib/utils";

interface CookModeDialogProps {
  open: boolean;
  onClose: () => void;
  onRate?: () => void;
  steps: CookModeStepType[];
  recipeNames: Map<string, string>;
  loading?: boolean;
  error?: string;
  ingredientsByRecipe?: Map<string, RecipeIngredient[]>;
  userId?: string;
  /** Only shown when there are multiple recipes */
  viewMode?: CookViewMode;
  onViewModeChange?: (mode: CookViewMode) => void;
}


const CookModeDialog = ({
  open,
  onClose,
  onRate,
  steps,
  recipeNames,
  loading,
  error,
  ingredientsByRecipe,
  userId,
  viewMode = "interleaved",
  onViewModeChange,
}: CookModeDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSideBySideTab, setMobileSideBySideTab] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Determine if the toggle should be shown (multiple distinct recipes)
  const recipeCount = useMemo(() => recipeNames.size, [recipeNames]);
  const showViewToggle = recipeCount > 1 && !!onViewModeChange;

  // Build recipe-to-color-index map from step order
  const recipeColorMap = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const colorMap = new Map<string, number>();
    let colorIndex = 0;
    steps.forEach((step) => {
      if (!colorMap.has(step.recipeId)) {
        colorMap.set(step.recipeId, colorIndex++);
      }
      (step.sharedRecipeIds ?? []).forEach((id) => {
        if (!colorMap.has(id)) colorMap.set(id, colorIndex++);
      });
    });
    recipeColorMap.current = colorMap;
  }, [steps]);

  // Group steps by recipe for side-by-side view
  const stepsByRecipe = useMemo(() => {
    const map = new Map<string, { name: string; colorIndex: number; steps: CookModeStepType[] }>();
    steps.forEach((step) => {
      if (!map.has(step.recipeId)) {
        map.set(step.recipeId, {
          name: step.recipeName,
          colorIndex: recipeColorMap.current.get(step.recipeId) ?? 0,
          steps: [],
        });
      }
      map.get(step.recipeId)!.steps.push(step);
    });
    return map;
  }, [steps]);

  // Auto-scroll the active step into view (interleaved mode only)
  useEffect(() => {
    if (viewMode !== "interleaved") return;
    const el = stepRefs.current[currentStep];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentStep, viewMode]);

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

  // Reset state when dialog opens or view mode changes
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setCompleted(false);
      setMobileDrawerOpen(false);
    }
  }, [open]);

  useEffect(() => {
    setCurrentStep(0);
  }, [viewMode]);

  // Set initial mobile tab for side-by-side view
  useEffect(() => {
    if (viewMode === "side-by-side" && stepsByRecipe.size > 0) {
      setMobileSideBySideTab((prev) => prev ?? [...stepsByRecipe.keys()][0]);
    }
  }, [viewMode, stepsByRecipe]);

  const goToPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentStep((s) => Math.min(steps.length - 1, s + 1));
  }, [steps.length]);

  const jumpToStep = useCallback((index: number) => {
    setCurrentStep(index);
  }, []);

  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  const hasContent = !loading && !error && steps.length > 0;

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

          {/* Progress bar — only meaningful in interleaved step-by-step mode */}
          {viewMode === "interleaved" && (
            <div className="h-1.5 bg-slate-800 flex-shrink-0" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-purple-400" />
                <span className="font-semibold text-sm text-slate-200">Cook Mode</span>
                {viewMode === "interleaved" && steps.length > 0 && (
                  <span className="text-xs text-slate-500 ml-1">
                    {currentStep + 1} / {steps.length}
                  </span>
                )}
              </div>

              {/* View toggle — only shown for multiple recipes */}
              {showViewToggle && (
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => onViewModeChange("interleaved")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                      viewMode === "interleaved"
                        ? "bg-slate-700 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                    aria-pressed={viewMode === "interleaved"}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Step by Step</span>
                  </button>
                  <button
                    onClick={() => onViewModeChange("side-by-side")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                      viewMode === "side-by-side"
                        ? "bg-slate-700 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                    aria-pressed={viewMode === "side-by-side"}
                  >
                    <Columns2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Side by Side</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close cook mode"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Main content */}
          {completed ? (
            <div className="flex-1 overflow-hidden">
              <CookModeComplete
                recipeNames={recipeNames}
                onRate={onRate}
                onClose={onClose}
              />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-hidden flex flex-row min-h-0">

                {/* ── INTERLEAVED: step-by-step guided view ── */}
                {viewMode === "interleaved" && (
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {loading && (
                      <div className="h-full flex flex-col items-center justify-center gap-4">
                        <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-purple-500 animate-spin" />
                        <p className="text-slate-400 text-sm">Generating cooking timeline...</p>
                      </div>
                    )}

                    {error && !loading && (
                      <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
                        <p className="text-red-400 text-sm">{error}</p>
                      </div>
                    )}

                    {!loading && !error && steps.length === 0 && (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-slate-500 text-sm">No steps available.</p>
                      </div>
                    )}

                    {!loading && !error && steps.length > 0 && (
                      <div className="py-2">
                        {steps.map((step, index) => {
                          const isActive = index === currentStep;
                          const colorIndex = recipeColorMap.current.get(step.recipeId) ?? 0;
                          const color = getRecipeColor(colorIndex);

                          const recipeLabels: { name: string; colorIndex: number }[] = [
                            { name: step.recipeName, colorIndex },
                            ...(step.sharedRecipeIds ?? []).map((id, i) => ({
                              name: step.sharedRecipeNames?.[i] ?? recipeNames.get(id) ?? "Recipe",
                              colorIndex: recipeColorMap.current.get(id) ?? 0,
                            })),
                          ];

                          if (isActive) {
                            return (
                              <button
                                key={index}
                                ref={(el) => { stepRefs.current[index] = el; }}
                                onClick={() => jumpToStep(index)}
                                className="w-full text-left px-4 py-4 border-l-4 bg-slate-800/60 transition-colors focus:outline-none"
                                style={{ borderLeftColor: color.accent }}
                                aria-current="step"
                              >
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span
                                    className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white"
                                    style={{ backgroundColor: color.accent }}
                                  >
                                    {index + 1}
                                  </span>
                                  {recipeLabels.map((label, i) => {
                                    const labelColor = getRecipeColor(label.colorIndex);
                                    return (
                                      <span
                                        key={i}
                                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                        style={{
                                          backgroundColor: `${getRecipeColor(label.colorIndex).accent}22`,
                                          color: labelColor.accent,
                                          border: `1px solid ${labelColor.accent}44`,
                                        }}
                                      >
                                        {label.name}
                                      </span>
                                    );
                                  })}
                                </div>
                                <p className="text-xl sm:text-2xl leading-relaxed text-white font-medium pl-8">
                                  {step.instruction}
                                </p>
                                {step.timing && (
                                  <p className="mt-2 pl-8 text-sm font-medium" style={{ color: color.accent }}>
                                    {step.timing}
                                  </p>
                                )}
                              </button>
                            );
                          }

                          return (
                            <button
                              key={index}
                              ref={(el) => { stepRefs.current[index] = el; }}
                              onClick={() => jumpToStep(index)}
                              className="w-full text-left px-4 py-2.5 border-l-4 border-transparent hover:bg-slate-900 transition-colors flex items-start gap-2.5 focus:outline-none"
                              aria-label={`Go to step ${index + 1}`}
                            >
                              <span
                                className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-semibold flex items-center justify-center mt-0.5"
                                style={{
                                  color: color.accent,
                                  border: `1px solid ${color.accent}`,
                                }}
                              >
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                  {recipeLabels.map((label, i) => {
                                    const labelColor = getRecipeColor(label.colorIndex);
                                    return (
                                      <span
                                        key={i}
                                        className="text-xs font-medium"
                                        style={{ color: labelColor.accent }}
                                      >
                                        {label.name}
                                        {i < recipeLabels.length - 1 && " ·"}
                                      </span>
                                    );
                                  })}
                                </div>
                                <p className="text-sm text-slate-400 line-clamp-2 leading-snug">
                                  {step.instruction}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── SIDE BY SIDE: scrollable reference view ── */}
                {viewMode === "side-by-side" && (
                  <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                    {loading && (
                      <div className="h-full flex flex-col items-center justify-center gap-4">
                        <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-purple-500 animate-spin" />
                        <p className="text-slate-400 text-sm">Generating recipes...</p>
                      </div>
                    )}

                    {error && !loading && (
                      <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
                        <p className="text-red-400 text-sm">{error}</p>
                      </div>
                    )}

                    {!loading && !error && steps.length === 0 && (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-slate-500 text-sm">No steps available.</p>
                      </div>
                    )}

                    {!loading && !error && steps.length > 0 && (
                      <>
                        {/* Mobile: tab per recipe */}
                        <div className="md:hidden flex-1 overflow-hidden flex flex-col min-h-0">
                          {/* Tab bar */}
                          <div className="flex flex-shrink-0 border-b border-slate-800 overflow-x-auto">
                            {[...stepsByRecipe.entries()].map(([recipeId, { name, colorIndex }]) => {
                              const color = getRecipeColor(colorIndex);
                              const isActive = mobileSideBySideTab === recipeId;
                              return (
                                <button
                                  key={recipeId}
                                  onClick={() => setMobileSideBySideTab(recipeId)}
                                  className={cn(
                                    "flex-1 min-w-0 px-3 py-2.5 text-xs font-semibold truncate border-b-2 transition-colors whitespace-nowrap",
                                    isActive ? "border-current" : "border-transparent text-slate-500 hover:text-slate-300"
                                  )}
                                  style={isActive ? { color: color.accent, borderColor: color.accent } : {}}
                                >
                                  {name}
                                </button>
                              );
                            })}
                          </div>
                          {/* Active recipe steps */}
                          <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
                            {mobileSideBySideTab && stepsByRecipe.get(mobileSideBySideTab)?.steps.map((step, i) => (
                              <SideBySideStep key={i} step={step} index={i} colorIndex={stepsByRecipe.get(mobileSideBySideTab!)?.colorIndex ?? 0} />
                            ))}
                          </div>
                        </div>

                        {/* Desktop: columns */}
                        <div className="hidden md:flex flex-1 overflow-hidden min-h-0 divide-x divide-slate-800">
                          {[...stepsByRecipe.entries()].map(([recipeId, { name, colorIndex, steps: recipeSteps }]) => {
                            const color = getRecipeColor(colorIndex);
                            return (
                              <div key={recipeId} className="flex-1 flex flex-col overflow-hidden min-w-0">
                                {/* Column header */}
                                <div
                                  className="flex-shrink-0 px-4 py-3 border-b border-slate-800 font-semibold text-sm"
                                  style={{ color: color.accent }}
                                >
                                  {name}
                                </div>
                                {/* Steps */}
                                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
                                  {recipeSteps.map((step, i) => (
                                    <SideBySideStep key={i} step={step} index={i} colorIndex={colorIndex} />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Right: Ingredients + Tips sidebar (desktop only) */}
                {hasContent && (
                  <div className="hidden md:block w-72 flex-shrink-0">
                    <CookModeSidebar
                      ingredientsByRecipe={ingredientsByRecipe ?? new Map()}
                      recipeColorMap={recipeColorMap.current}
                      recipeNames={recipeNames}
                      primaryRecipeId={steps[0]?.recipeId}
                      userId={userId}
                    />
                  </div>
                )}
              </div>

              {/* Mobile: drawer toggle for ingredients + tips */}
              {hasContent && (
                <>
                  <button
                    onClick={() => setMobileDrawerOpen((o) => !o)}
                    aria-label={mobileDrawerOpen ? "Hide ingredients" : "Show ingredients"}
                    className="md:hidden w-full flex items-center justify-center gap-2 py-3 bg-slate-800 border-t border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition-colors flex-shrink-0"
                  >
                    {mobileDrawerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    Ingredients &amp; Tips
                  </button>
                  {mobileDrawerOpen && (
                    <div className="md:hidden overflow-y-auto max-h-[50vh] border-t border-slate-700 flex-shrink-0">
                      <CookModeSidebar
                        ingredientsByRecipe={ingredientsByRecipe ?? new Map()}
                        recipeColorMap={recipeColorMap.current}
                        recipeNames={recipeNames}
                        primaryRecipeId={steps[0]?.recipeId}
                        userId={userId}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Navigation buttons — interleaved mode only */}
          {viewMode === "interleaved" && hasContent && !completed && (
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
              {currentStep === steps.length - 1 ? (
                <button
                  onClick={() => setCompleted(true)}
                  className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm bg-green-600 text-white hover:bg-green-500 transition-colors"
                  aria-label="Finish cooking"
                >
                  Done!
                  <CheckCircle2 className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={goToNext}
                  className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm bg-purple-600 text-white hover:bg-purple-500 transition-colors"
                  aria-label="Next step"
                >
                  Next
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

/** A single step row in the side-by-side reference view */
function SideBySideStep({ step, index, colorIndex }: { step: CookModeStepType; index: number; colorIndex: number }) {
  const color = getRecipeColor(colorIndex);
  return (
    <div className="flex gap-3">
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white mt-0.5"
        style={{ backgroundColor: color.accent }}
      >
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 leading-relaxed">{step.instruction}</p>
        {step.timing && (
          <p className="mt-1 text-xs font-medium" style={{ color: color.accent }}>
            {step.timing}
          </p>
        )}
      </div>
    </div>
  );
}

export default CookModeDialog;
