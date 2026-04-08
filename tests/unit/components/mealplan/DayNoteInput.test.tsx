import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import DayNoteInput from "@/components/mealplan/DayNoteInput";

describe("DayNoteInput", () => {
  const defaultProps = {
    dayOfWeek: 1,
    note: "",
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders add note button when note is empty", () => {
    render(<DayNoteInput {...defaultProps} />);

    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
  });

  it("renders note text when note is provided", () => {
    render(<DayNoteInput {...defaultProps} note="Eating out tonight" />);

    expect(screen.getByText("Eating out tonight")).toBeInTheDocument();
  });

  it("enters edit mode when add note button is clicked", () => {
    render(<DayNoteInput {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    expect(screen.getByRole("textbox", { name: /day note/i })).toBeInTheDocument();
  });

  it("enters edit mode when existing note is clicked", () => {
    render(<DayNoteInput {...defaultProps} note="Leftovers" />);

    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));

    const input = screen.getByRole("textbox", { name: /day note/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Leftovers");
  });

  it("saves note when Enter is pressed", async () => {
    render(<DayNoteInput {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    const input = screen.getByRole("textbox", { name: /day note/i });
    fireEvent.change(input, { target: { value: "Date night" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(1, "Date night");
    });
  });

  it("saves note when save button is clicked", async () => {
    render(<DayNoteInput {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    const input = screen.getByRole("textbox", { name: /day note/i });
    fireEvent.change(input, { target: { value: "Busy day" } });
    fireEvent.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(1, "Busy day");
    });
  });

  it("cancels editing when Escape is pressed", () => {
    render(<DayNoteInput {...defaultProps} note="Original note" />);

    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));
    const input = screen.getByRole("textbox", { name: /day note/i });
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(defaultProps.onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original note")).toBeInTheDocument();
  });

  it("cancels editing when cancel button is clicked", () => {
    render(<DayNoteInput {...defaultProps} note="Keep this" />);

    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(defaultProps.onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Keep this")).toBeInTheDocument();
  });

  it("does not call onSave if note is unchanged", async () => {
    render(<DayNoteInput {...defaultProps} note="Same text" />);

    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));
    fireEvent.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() => {
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  it("trims whitespace before saving", async () => {
    render(<DayNoteInput {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    const input = screen.getByRole("textbox", { name: /day note/i });
    fireEvent.change(input, { target: { value: "  Trimmed  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(1, "Trimmed");
    });
  });

  it("saves with empty string when note is cleared", async () => {
    render(<DayNoteInput {...defaultProps} note="Delete me" />);

    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));
    const input = screen.getByRole("textbox", { name: /day note/i });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(1, "");
    });
  });

  it("resets to view mode when dayOfWeek prop changes", () => {
    const { rerender } = render(<DayNoteInput {...defaultProps} note="Monday note" />);

    fireEvent.click(screen.getByRole("button", { name: /edit note/i }));
    expect(screen.getByRole("textbox", { name: /day note/i })).toBeInTheDocument();

    // Simulate switching day
    rerender(<DayNoteInput dayOfWeek={2} note="Tuesday note" onSave={defaultProps.onSave} />);

    expect(screen.queryByRole("textbox", { name: /day note/i })).not.toBeInTheDocument();
    expect(screen.getByText("Tuesday note")).toBeInTheDocument();
  });
});
