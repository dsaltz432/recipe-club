import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import AddIngredientInput from "@/components/recipes/AddIngredientInput";

describe("AddIngredientInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a textarea and Add button", () => {
    render(<AddIngredientInput onSubmit={vi.fn()} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add/ })).toBeInTheDocument();
  });

  it("Add button is disabled when textarea is empty", () => {
    render(<AddIngredientInput onSubmit={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Add/ });
    expect(button).toBeDisabled();
  });

  it("Add button is enabled when textarea has text", () => {
    render(<AddIngredientInput onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2 cups flour" } });

    expect(screen.getByRole("button", { name: /Add/ })).not.toBeDisabled();
  });

  it("calls onSubmit with textarea text when Add is clicked", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddIngredientInput onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2 cups flour" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("2 cups flour");
    });
  });

  it("clears textarea after successful submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddIngredientInput onSubmit={onSubmit} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "1 lb chicken" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("shows loading spinner while submitting", async () => {
    let resolveSubmit: () => void;
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );

    render(<AddIngredientInput onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "eggs" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(screen.getByText("Adding ingredients...")).toBeInTheDocument();
    });

    resolveSubmit!();
  });

  it("disables button and textarea while submitting", async () => {
    let resolveSubmit: () => void;
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );

    render(<AddIngredientInput onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "eggs" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    resolveSubmit!();
  });

  it("uses custom placeholder when provided", () => {
    render(<AddIngredientInput onSubmit={vi.fn()} placeholder="Custom placeholder text" />);

    expect(screen.getByPlaceholderText("Custom placeholder text")).toBeInTheDocument();
  });

  it("does not call onSubmit when text is only whitespace", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddIngredientInput onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
