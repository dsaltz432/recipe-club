import { useState, useMemo } from "react";
import { TEST_RECIPES, type TestRecipe } from "@test-combine/data/recipes.ts";

interface RecipeBrowserProps {
  selectedRecipes: TestRecipe[];
  onSelectionChange: (recipes: TestRecipe[]) => void;
  onCombine: () => void;
}

export function RecipeBrowser({
  selectedRecipes,
  onSelectionChange,
  onCombine,
}: RecipeBrowserProps) {
  const [search, setSearch] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const recipesWithIngredients = TEST_RECIPES.filter((r) => r.ingredients.length > 0);
  const cuisines = [...new Set(recipesWithIngredients.map((r) => r.cuisine))].sort();

  const selectedIds = useMemo(
    () => new Set(selectedRecipes.map((r) => r.id)),
    [selectedRecipes]
  );

  const filtered = TEST_RECIPES.filter((r) => {
    const matchesCuisine =
      cuisineFilter === "all" || r.cuisine === cuisineFilter;
    const matchesSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.ingredients.some((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
      );
    return matchesCuisine && matchesSearch && r.ingredients.length > 0;
  });

  function toggleRecipe(recipe: TestRecipe) {
    if (selectedIds.has(recipe.id)) {
      onSelectionChange(selectedRecipes.filter((r) => r.id !== recipe.id));
    } else {
      onSelectionChange([...selectedRecipes, recipe]);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipe Browser</h1>
        <p className="text-sm text-gray-500 mt-1">
          {recipesWithIngredients.length} recipes across {cuisines.length} cuisines —
          select 2+ recipes then combine them on the Testing tab.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes or ingredients..."
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCuisineFilter("all")}
            className={`px-2 py-1 text-xs rounded ${
              cuisineFilter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({recipesWithIngredients.length})
          </button>
          {cuisines.map((c) => (
            <button
              key={c}
              onClick={() => setCuisineFilter(c)}
              className={`px-2 py-1 text-xs rounded ${
                cuisineFilter === c
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c} ({recipesWithIngredients.filter((r) => r.cuisine === c).length})
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        Showing {filtered.length} recipe{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Selected recipes bar */}
      {selectedRecipes.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              {selectedRecipes.length} recipe
              {selectedRecipes.length !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onSelectionChange([])}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
              <button
                onClick={onCombine}
                disabled={selectedRecipes.length < 2}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Combine & Test
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedRecipes.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-blue-800 rounded-full text-xs border border-blue-200"
              >
                {r.name}
                <button
                  onClick={() => toggleRecipe(r)}
                  className="text-blue-400 hover:text-blue-700 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recipe list */}
      <div className="space-y-2">
        {filtered.map((recipe) => {
          const isExpanded = expandedId === recipe.id;
          const isSelected = selectedIds.has(recipe.id);
          return (
            <div
              key={recipe.id}
              className={`bg-white rounded-lg border shadow-sm ${
                isSelected ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-center px-4 py-3 hover:bg-gray-50">
                {/* Selection checkbox */}
                <button
                  onClick={() => toggleRecipe(recipe)}
                  className={`w-5 h-5 rounded border mr-3 flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : recipe.id)
                  }
                  className="flex-1 text-left flex items-center gap-3"
                >
                  <span className="font-medium text-gray-900">
                    {recipe.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {recipe.cuisine}
                  </span>
                  <span className="text-xs text-gray-400">
                    {recipe.ingredients.length} ingredients
                  </span>
                </button>
                <a
                  href={recipe.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline mr-3 shrink-0"
                >
                  View Recipe
                </a>
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : recipe.id)
                  }
                  className="text-gray-400 text-sm shrink-0"
                >
                  {isExpanded ? "▲" : "▼"}
                </button>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-3 text-xs text-gray-400 mb-2 flex items-center gap-3">
                    <span>
                      id:{" "}
                      <code className="bg-gray-50 px-1 rounded">
                        {recipe.id}
                      </code>
                    </span>
                    <a
                      href={recipe.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {recipe.url}
                    </a>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-1 pr-4">Ingredient</th>
                        <th className="py-1 pr-4">Qty</th>
                        <th className="py-1 pr-4">Unit</th>
                        <th className="py-1 pr-4">Category</th>
                        <th className="py-1">Raw Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.ingredients.map((ing, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1 pr-4 font-medium text-gray-700">
                            {ing.name}
                          </td>
                          <td className="py-1 pr-4 text-gray-600">
                            {ing.quantity ?? "—"}
                          </td>
                          <td className="py-1 pr-4 text-gray-600">
                            {ing.unit ?? "—"}
                          </td>
                          <td className="py-1 pr-4">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                              {ing.category}
                            </span>
                          </td>
                          <td className="py-1 text-gray-500 italic">
                            {ing.rawText}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
