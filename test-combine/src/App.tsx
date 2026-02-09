import { useState } from "react";
import { Dashboard } from "./components/Dashboard.tsx";
import { RecipeBrowser } from "./components/RecipeBrowser.tsx";
import type { TestRecipe } from "./data/recipes.ts";

type Tab = "testing" | "recipes";

export function App() {
  const [tab, setTab] = useState<Tab>("recipes");
  const [selectedRecipes, setSelectedRecipes] = useState<TestRecipe[]>([]);

  function handleCombine() {
    if (selectedRecipes.length >= 2) {
      setTab("testing");
    }
  }

  return (
    <div>
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <span className="font-bold text-gray-900 mr-4">
          Combine Test Harness
        </span>
        <button
          onClick={() => setTab("testing")}
          className={`px-3 py-1.5 text-sm rounded ${
            tab === "testing"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Testing
        </button>
        <button
          onClick={() => setTab("recipes")}
          className={`px-3 py-1.5 text-sm rounded ${
            tab === "recipes"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Recipes
        </button>
        {selectedRecipes.length > 0 && (
          <span className="ml-auto text-sm text-gray-600">
            {selectedRecipes.length} recipe{selectedRecipes.length !== 1 ? "s" : ""} selected
          </span>
        )}
      </nav>
      {tab === "testing" ? (
        <Dashboard
          selectedRecipes={selectedRecipes}
          onClearSelection={() => setSelectedRecipes([])}
          onGoToRecipes={() => setTab("recipes")}
        />
      ) : (
        <RecipeBrowser
          selectedRecipes={selectedRecipes}
          onSelectionChange={setSelectedRecipes}
          onCombine={handleCombine}
        />
      )}
    </div>
  );
}
