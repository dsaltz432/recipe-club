import { Play, Pause, RotateCcw, CheckCircle2, Bell } from "lucide-react";
import { formatCountdown } from "@/lib/parseTimingSeconds";
import { cn } from "@/lib/utils";

export interface StepTimerState {
  initial: number;   // total seconds from parsed timing
  remaining: number; // seconds left
  running: boolean;
  done: boolean;
}

interface StepTimerProps {
  state: StepTimerState;
  accentColor: string; // CSS color string from cookModeColors
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

const RING_SIZE = 72;   // SVG viewBox size
const RING_RADIUS = 28; // circle radius
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * An inline countdown timer for a cook mode step.
 * Renders a circular progress ring + MM:SS + controls.
 */
const StepTimer = ({ state, accentColor, onStart, onPause, onReset }: StepTimerProps) => {
  const { initial, remaining, running, done } = state;

  const progress = initial > 0 ? remaining / initial : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  if (done) {
    return (
      <div
        className="flex items-center gap-2.5 mt-3 pl-8 animate-in fade-in slide-in-from-bottom-1"
        role="status"
        aria-label="Timer complete"
      >
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
          style={{
            backgroundColor: `${accentColor}22`,
            border: `1px solid ${accentColor}55`,
            color: accentColor,
          }}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Timer done!
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded"
          aria-label="Reset timer"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 mt-3 pl-8" aria-label={`Step timer: ${formatCountdown(remaining)} remaining`}>
      {/* Circular progress ring */}
      <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="5"
          />
          {/* Progress */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={accentColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: running ? "stroke-dashoffset 1s linear" : "none" }}
          />
        </svg>
        {/* Countdown text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-sm font-mono font-bold tabular-nums",
              remaining <= 10 && running ? "text-red-400" : "text-white"
            )}
          >
            {formatCountdown(remaining)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {running ? (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: `${accentColor}22`,
              border: `1px solid ${accentColor}44`,
              color: accentColor,
            }}
            aria-label="Pause timer"
          >
            <Pause className="h-3.5 w-3.5" />
            Pause
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: `${accentColor}22`,
              border: `1px solid ${accentColor}44`,
              color: accentColor,
            }}
            aria-label={remaining < initial ? "Resume timer" : "Start timer"}
          >
            <Play className="h-3.5 w-3.5" />
            {remaining < initial ? "Resume" : "Start"}
          </button>
        )}
        {remaining < initial && !running && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1.5 rounded"
            aria-label="Reset timer"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
        <Bell className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
};

export default StepTimer;
