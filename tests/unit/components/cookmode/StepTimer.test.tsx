import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import StepTimer from "@/components/cookmode/StepTimer";
import type { StepTimerState } from "@/components/cookmode/StepTimer";

const ACCENT = "#a855f7";

const idleState: StepTimerState = {
  initial: 900,   // 15 minutes
  remaining: 900,
  running: false,
  done: false,
};

const runningState: StepTimerState = {
  initial: 900,
  remaining: 750,  // 12:30 remaining
  running: true,
  done: false,
};

const pausedState: StepTimerState = {
  initial: 900,
  remaining: 600,  // 10:00 remaining
  running: false,
  done: false,
};

const doneState: StepTimerState = {
  initial: 900,
  remaining: 0,
  running: false,
  done: true,
};

describe("StepTimer — idle state", () => {
  it("shows 'Start' button when timer has not started", () => {
    render(
      <StepTimer
        state={idleState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /start timer/i })).toBeInTheDocument();
  });

  it("displays full time (15:00) when not started", () => {
    render(
      <StepTimer
        state={idleState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText("15:00")).toBeInTheDocument();
  });

  it("does not show Pause button when idle", () => {
    render(
      <StepTimer
        state={idleState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /pause timer/i })).not.toBeInTheDocument();
  });

  it("calls onStart when Start button is clicked", () => {
    const onStart = vi.fn();
    render(
      <StepTimer
        state={idleState}
        accentColor={ACCENT}
        onStart={onStart}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /start timer/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});

describe("StepTimer — running state", () => {
  it("shows 'Pause' button when running", () => {
    render(
      <StepTimer
        state={runningState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /pause timer/i })).toBeInTheDocument();
  });

  it("displays current remaining time", () => {
    render(
      <StepTimer
        state={runningState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText("12:30")).toBeInTheDocument();
  });

  it("calls onPause when Pause button is clicked", () => {
    const onPause = vi.fn();
    render(
      <StepTimer
        state={runningState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={onPause}
        onReset={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /pause timer/i }));
    expect(onPause).toHaveBeenCalledOnce();
  });
});

describe("StepTimer — paused state", () => {
  it("shows 'Resume' button when paused mid-countdown", () => {
    render(
      <StepTimer
        state={pausedState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /resume timer/i })).toBeInTheDocument();
  });

  it("shows Reset button when paused mid-countdown", () => {
    render(
      <StepTimer
        state={pausedState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /reset timer/i })).toBeInTheDocument();
  });

  it("calls onReset when Reset button is clicked", () => {
    const onReset = vi.fn();
    render(
      <StepTimer
        state={pausedState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={onReset}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /reset timer/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("StepTimer — done state", () => {
  it("shows 'Timer done!' when complete", () => {
    render(
      <StepTimer
        state={doneState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText(/timer done/i)).toBeInTheDocument();
  });

  it("shows Reset button on completion", () => {
    render(
      <StepTimer
        state={doneState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /reset timer/i })).toBeInTheDocument();
  });

  it("does not show Start or Pause when done", () => {
    render(
      <StepTimer
        state={doneState}
        accentColor={ACCENT}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /start timer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause timer/i })).not.toBeInTheDocument();
  });
});
