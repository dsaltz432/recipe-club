import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import confetti from "canvas-confetti";
import AnniversaryBanner from "@/components/shared/AnniversaryBanner";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const setToday = (date: Date) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
};

describe("AnniversaryBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing outside the anniversary week", () => {
    setToday(new Date(2026, 5, 15));
    const { container } = render(<AnniversaryBanner />);
    expect(container).toBeEmptyDOMElement();
    expect(confetti).not.toHaveBeenCalled();
  });

  it("shows the banner during the anniversary week", () => {
    setToday(new Date(2026, 8, 28, 10));
    render(<AnniversaryBanner />);
    expect(screen.getByText("Happy 6th Anniversary, Recipe Club!")).toBeInTheDocument();
    expect(screen.getByText(/Cooking together since September 29, 2020/)).toBeInTheDocument();
  });

  it("uses 'ago today' copy on the anniversary itself", () => {
    setToday(new Date(2026, 8, 29, 10));
    render(<AnniversaryBanner />);
    expect(screen.getByText(/6 years ago today/)).toBeInTheDocument();
  });

  it("fires a single confetti burst once per session", () => {
    setToday(new Date(2026, 8, 29, 10));
    const { unmount } = render(<AnniversaryBanner />);
    expect(confetti).toHaveBeenCalledTimes(2); // one burst from each side
    expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ disableForReducedMotion: true }));

    unmount();
    vi.mocked(confetti).mockClear();
    render(<AnniversaryBanner />);
    expect(screen.getByText("Happy 6th Anniversary, Recipe Club!")).toBeInTheDocument();
    expect(confetti).not.toHaveBeenCalled();
  });

  it("stays dismissed after the user closes it", () => {
    setToday(new Date(2026, 8, 29, 10));
    const { unmount } = render(<AnniversaryBanner />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss anniversary banner/i }));
    expect(screen.queryByText(/Anniversary, Recipe Club/)).not.toBeInTheDocument();

    unmount();
    sessionStorage.clear();
    vi.mocked(confetti).mockClear();
    render(<AnniversaryBanner />);
    expect(screen.queryByText(/Anniversary, Recipe Club/)).not.toBeInTheDocument();
    expect(confetti).not.toHaveBeenCalled();
  });
});
