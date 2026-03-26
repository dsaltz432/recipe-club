import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import RecipeInstructions from "@/components/cookmode/RecipeInstructions";

// Mock saveInstructionsEdit
const mockSaveInstructionsEdit = vi.fn();
vi.mock("@/lib/recipeActions", () => ({
  saveInstructionsEdit: (...args: unknown[]) => mockSaveInstructionsEdit(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("RecipeInstructions", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders numbered steps from instructions array", () => {
    const instructions = ["Preheat oven to 350°F", "Mix ingredients", "Bake for 30 minutes"];
    render(<RecipeInstructions instructions={instructions} />);

    expect(screen.getByText("Preheat oven to 350°F")).toBeInTheDocument();
    expect(screen.getByText("Mix ingredients")).toBeInTheDocument();
    expect(screen.getByText("Bake for 30 minutes")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows 'No instructions available' when instructions is empty", () => {
    render(<RecipeInstructions instructions={[]} />);
    expect(screen.getByText("No instructions available")).toBeInTheDocument();
  });

  it("shows 'No instructions available' when instructions is undefined", () => {
    render(<RecipeInstructions />);
    expect(screen.getByText("No instructions available")).toBeInTheDocument();
  });

  it("renders metadata header when servings and times are provided", () => {
    render(
      <RecipeInstructions
        instructions={["Step 1"]}
        servings="4"
        prepTime="10 min"
        cookTime="30 min"
        totalTime="40 min"
      />
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("10 min")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("40 min")).toBeInTheDocument();
  });

  it("does not render metadata section when no metadata is provided", () => {
    render(<RecipeInstructions instructions={["Step 1"]} />);

    expect(screen.queryByText("Servings:")).not.toBeInTheDocument();
    expect(screen.queryByText("Prep:")).not.toBeInTheDocument();
  });

  it("accepts description prop without error", () => {
    const { container } = render(
      <RecipeInstructions
        instructions={["Step 1"]}
        description="A delicious recipe"
      />
    );
    // description prop is accepted but not currently rendered
    expect(container).toBeInTheDocument();
  });

  it("renders only provided metadata fields", () => {
    render(
      <RecipeInstructions
        instructions={["Step 1"]}
        servings="2"
        totalTime="20 min"
      />
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("20 min")).toBeInTheDocument();
    expect(screen.queryByText("Prep:")).not.toBeInTheDocument();
    expect(screen.queryByText("Cook:")).not.toBeInTheDocument();
  });

  it("renders instructions in read-only mode", () => {
    render(<RecipeInstructions instructions={["Boil water", "Cook pasta"]} />);
    expect(screen.getByText("Boil water")).toBeInTheDocument();
    expect(screen.getByText("Cook pasta")).toBeInTheDocument();
  });

  it("shows no pencil icons in non-editable mode", () => {
    render(<RecipeInstructions instructions={["Boil water"]} />);
    expect(screen.queryByRole("button", { name: /edit step/i })).not.toBeInTheDocument();
  });

  it("shows pencil icons in editable mode", () => {
    render(<RecipeInstructions instructions={["Boil water"]} editable recipeId="r1" />);
    expect(screen.getByRole("button", { name: /edit step 1/i })).toBeInTheDocument();
  });

  it("clicking pencil shows textarea with step text", () => {
    render(<RecipeInstructions instructions={["Boil water"]} editable recipeId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /edit step 1/i }));
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Boil water");
  });

  it("saves edited step on check click", async () => {
    mockSaveInstructionsEdit.mockResolvedValue({ success: true });
    const onInstructionsChange = vi.fn();

    render(
      <RecipeInstructions
        instructions={["Boil water"]}
        editable
        recipeId="r1"
        onInstructionsChange={onInstructionsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit step 1/i }));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Boil salted water" } });
    fireEvent.click(screen.getByRole("button", { name: /save step/i }));

    await waitFor(() => {
      expect(mockSaveInstructionsEdit).toHaveBeenCalledWith("r1", ["Boil salted water"]);
      expect(onInstructionsChange).toHaveBeenCalledWith(["Boil salted water"]);
    });
  });

  it("cancels edit on X click", () => {
    render(<RecipeInstructions instructions={["Boil water"]} editable recipeId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /edit step 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel edit/i }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
