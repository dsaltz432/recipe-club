import type { SmartGroceryItem, GroceryCategory } from "@/types/index.ts";
import type { TestRecipe } from "@test-combine/data/recipes.ts";
import { formatGroceryItem, GROCERY_CATEGORIES, CATEGORY_ORDER } from "@/lib/groceryList.ts";

interface GroceryTableProps {
  recipes: TestRecipe[];
  smartItems: SmartGroceryItem[] | null;
}

function groupSmart(items: SmartGroceryItem[]): Map<GroceryCategory, SmartGroceryItem[]> {
  const map = new Map<GroceryCategory, SmartGroceryItem[]>();
  for (const cat of CATEGORY_ORDER) {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) map.set(cat, catItems);
  }
  return map;
}

export function GroceryTable({ recipes, smartItems }: GroceryTableProps) {
  const smartGrouped = smartItems ? groupSmart(smartItems) : null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left column: Per-recipe ingredients */}
      <div>
        <h4 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          Per-Recipe Ingredients
        </h4>
        {recipes.map((recipe) => (
          <div key={recipe.id} className="mb-4">
            <div className="text-sm font-medium text-blue-700 mb-1">
              {recipe.name}
            </div>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="text-sm text-gray-700 pl-2 py-0.5">
                {ing.rawText}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Right column: Smart combine result */}
      <div>
        <h4 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          Combined Ingredients
          {smartItems ? ` (${smartItems.length} items)` : ""}
        </h4>
        {!smartItems ? (
          <div className="text-sm text-gray-400 italic">
            Not available (edge function skipped or failed)
          </div>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const items = smartGrouped!.get(cat);
            if (!items) return null;
            return (
              <div key={cat} className="mb-3">
                <div className="text-xs font-medium text-green-600 mb-1">
                  {GROCERY_CATEGORIES[cat]}
                </div>
                {items.map((item, i) => (
                  <div key={i} className="text-sm text-gray-700 pl-2 py-0.5">
                    {formatGroceryItem(item)}
                    {item.sourceRecipes.length > 1 && (
                      <span className="text-xs text-gray-400 ml-1">
                        ({item.sourceRecipes.length} recipes)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
