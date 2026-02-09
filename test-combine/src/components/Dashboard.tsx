import { useState } from "react";
import { smartCombine } from "@test-combine/lib/api.ts";
import type { TestRecipe } from "@test-combine/data/recipes.ts";
import { GroceryTable } from "./GroceryTable.tsx";
import type { SmartGroceryItem } from "@/types/index.ts";

interface DashboardProps {
  selectedRecipes: TestRecipe[];
  onClearSelection: () => void;
  onGoToRecipes: () => void;
}

export function Dashboard({
  selectedRecipes,
  onClearSelection,
  onGoToRecipes,
}: DashboardProps) {
  const [combining, setCombining] = useState(false);
  const [smartResult, setSmartResult] = useState<SmartGroceryItem[] | null>(
    null
  );
  const [combinedRecipes, setCombinedRecipes] = useState<TestRecipe[]>([]);
  const [hasCombined, setHasCombined] = useState(false);

  async function handleCombine() {
    if (selectedRecipes.length < 2) return;
    setCombining(true);
    setCombinedRecipes(selectedRecipes);
    setSmartResult(null);
    setHasCombined(false);
    try {
      const smart = await smartCombine(selectedRecipes);
      setSmartResult(smart);
    } catch (err) {
      console.error("Combine failed:", err);
    } finally {
      setCombining(false);
      setHasCombined(true);
    }
  }

  function handleClear() {
    setSmartResult(null);
    setCombinedRecipes([]);
    setHasCombined(false);
    onClearSelection();
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Combine Ingredients Test Harness
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Select recipes on the Recipes tab, then combine and review results
          here.
        </p>
      </div>

      {/* ===== SELECTED RECIPES + COMBINE ===== */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Selected Recipes
          </h2>
          <button
            onClick={onGoToRecipes}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {selectedRecipes.length === 0
              ? "Go to Recipes tab to select"
              : "Edit selection"}
          </button>
        </div>

        {selectedRecipes.length === 0 ? (
          <div className="text-center text-gray-400 py-6">
            No recipes selected. Go to the{" "}
            <button
              onClick={onGoToRecipes}
              className="text-blue-600 hover:underline"
            >
              Recipes tab
            </button>{" "}
            to pick 2+ recipes.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {selectedRecipes.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
                >
                  {r.name}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCombine}
                disabled={selectedRecipes.length < 2 || combining}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {combining
                  ? "Combining..."
                  : `Combine ${selectedRecipes.length} Recipes`}
              </button>
              {hasCombined && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                >
                  Clear
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== LOADING STATE ===== */}
      {combining && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          <p className="text-sm text-gray-600">
            Combining {combinedRecipes.length} recipes...
          </p>
        </div>
      )}

      {/* ===== COMBINE RESULTS ===== */}
      {!combining && hasCombined && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Combine Results
            </h2>
            <span className="text-sm text-gray-500">
              {combinedRecipes.map((r) => r.name).join(" + ")}
            </span>
          </div>

          <GroceryTable recipes={combinedRecipes} smartItems={smartResult} />
        </div>
      )}

      {/* Empty state */}
      {!hasCombined && !combining && selectedRecipes.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          Go to the{" "}
          <button
            onClick={onGoToRecipes}
            className="text-blue-600 hover:underline"
          >
            Recipes tab
          </button>{" "}
          to select recipes, then come back here to combine and test them.
        </div>
      )}
    </div>
  );
}
