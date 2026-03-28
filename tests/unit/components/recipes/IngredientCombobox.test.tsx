import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import IngredientCombobox from "@/components/recipes/IngredientCombobox";
import type { Ingredient } from "@/types";

const makeIngredient = (id: string, name: string): Ingredient => ({
  id,
  name,
  usedCount: 1,
  inBank: true,
});

const ingredients: Ingredient[] = [
  makeIngredient("1", "Garlic"),
  makeIngredient("2", "Basil"),
  makeIngredient("3", "Tomato"),
  makeIngredient("4", "Olive Oil"),
];

describe("IngredientCombobox", () => {
  it("shows 'All Ingredients' when no ingredient is selected", () => {
    render(
      <IngredientCombobox ingredients={ingredients} value="all" onChange={vi.fn()} />
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("All Ingredients");
  });

  it("shows the selected ingredient name in the trigger", () => {
    render(
      <IngredientCombobox ingredients={ingredients} value="2" onChange={vi.fn()} />
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Basil");
  });

  it("opens the dropdown when the trigger is clicked", async () => {
    render(
      <IngredientCombobox ingredients={ingredients} value="all" onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search ingredients...")).toBeInTheDocument();
    });
  });

  it("renders all ingredients in the list", async () => {
    render(
      <IngredientCombobox ingredients={ingredients} value="all" onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByText("Garlic")).toBeInTheDocument();
      expect(screen.getByText("Basil")).toBeInTheDocument();
      expect(screen.getByText("Tomato")).toBeInTheDocument();
      expect(screen.getByText("Olive Oil")).toBeInTheDocument();
    });
  });

  it("filters ingredients based on search input", async () => {
    render(
      <IngredientCombobox ingredients={ingredients} value="all" onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => screen.getByPlaceholderText("Search ingredients..."));

    fireEvent.change(screen.getByPlaceholderText("Search ingredients..."), {
      target: { value: "gar" },
    });

    expect(screen.getByText("Garlic")).toBeInTheDocument();
    expect(screen.queryByText("Basil")).not.toBeInTheDocument();
    expect(screen.queryByText("Tomato")).not.toBeInTheDocument();
  });

  it("shows 'No ingredients found' when search has no matches", async () => {
    render(
      <IngredientCombobox ingredients={ingredients} value="all" onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => screen.getByPlaceholderText("Search ingredients..."));

    fireEvent.change(screen.getByPlaceholderText("Search ingredients..."), {
      target: { value: "zzz" },
    });

    expect(screen.getByText("No ingredients found")).toBeInTheDocument();
  });

  it("calls onChange with ingredient id when an ingredient is selected", async () => {
    const onChange = vi.fn();
    render(
      <IngredientCombobox ingredients={ingredients} value="all" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => screen.getByText("Garlic"));

    fireEvent.click(screen.getByText("Garlic"));
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("calls onChange with 'all' when selected ingredient is clicked again", async () => {
    const onChange = vi.fn();
    render(
      <IngredientCombobox ingredients={ingredients} value="1" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => screen.getByRole("listbox"));

    const selectedOption = screen.getByRole("option", { name: /garlic/i, selected: true });
    fireEvent.click(selectedOption);
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("calls onChange with 'all' when 'All Ingredients' is selected", async () => {
    const onChange = vi.fn();
    render(
      <IngredientCombobox ingredients={ingredients} value="2" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => screen.getByText("All Ingredients"));

    fireEvent.click(screen.getByText("All Ingredients"));
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("calls onChange with 'all' when the clear button is clicked", async () => {
    const onChange = vi.fn();
    render(
      <IngredientCombobox ingredients={ingredients} value="3" onChange={onChange} />
    );
    const clearBtn = screen.getByLabelText("Clear ingredient filter");
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("all");
  });
});
