import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@tests/utils";
import userEvent from "@testing-library/user-event";
import { RecipeDetailTabs } from "@/components/shared/RecipeDetailTabs";

describe("RecipeDetailTabs", () => {
  it("renders all three tab triggers", () => {
    render(
      <RecipeDetailTabs
        recipesContent={<div>Recipes content</div>}
        groceryContent={<div>Grocery content</div>}
        pantryContent={<div>Pantry content</div>}
      />
    );

    expect(screen.getByRole("tab", { name: /Recipes/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Groceries/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Pantry/ })).toBeInTheDocument();
  });

  it("shows recipesContent by default", () => {
    render(
      <RecipeDetailTabs
        recipesContent={<div>Recipes content</div>}
        groceryContent={<div>Grocery content</div>}
        pantryContent={<div>Pantry content</div>}
      />
    );

    expect(screen.getByText("Recipes content")).toBeInTheDocument();
  });

  it("shows groceryContent when Groceries tab is clicked", async () => {
    const user = userEvent.setup();

    render(
      <RecipeDetailTabs
        recipesContent={<div>Recipes content</div>}
        groceryContent={<div>Grocery content</div>}
        pantryContent={<div>Pantry content</div>}
      />
    );

    await user.click(screen.getByRole("tab", { name: /Groceries/ }));

    await waitFor(() => {
      expect(screen.getByText("Grocery content")).toBeInTheDocument();
    });
  });

  it("shows pantryContent when Pantry tab is clicked", async () => {
    const user = userEvent.setup();

    render(
      <RecipeDetailTabs
        recipesContent={<div>Recipes content</div>}
        groceryContent={<div>Grocery content</div>}
        pantryContent={<div>Pantry content</div>}
      />
    );

    await user.click(screen.getByRole("tab", { name: /Pantry/ }));

    await waitFor(() => {
      expect(screen.getByText("Pantry content")).toBeInTheDocument();
    });
  });

  it("unmounts recipesContent when switching to another tab", async () => {
    const user = userEvent.setup();

    render(
      <RecipeDetailTabs
        recipesContent={<div>Recipes content</div>}
        groceryContent={<div>Grocery content</div>}
        pantryContent={<div>Pantry content</div>}
      />
    );

    await user.click(screen.getByRole("tab", { name: /Groceries/ }));

    expect(screen.queryByText("Recipes content")).not.toBeInTheDocument();
  });
});
