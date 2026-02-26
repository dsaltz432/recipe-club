import { useState } from "react";
import { ShoppingCart, Loader2, RefreshCw, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RecipeIngredient, RecipeContent, SmartGroceryItem, GroceryCategory, Recipe } from "@/types";
import { filterSmartPantryItems, CATEGORY_ORDER } from "@/lib/groceryList";
import { SHOW_PARSE_BUTTONS } from "@/lib/constants";
import GroceryCategoryGroup from "./GroceryCategoryGroup";
import GroceryExportMenu from "./GroceryExportMenu";
import type { GroceryItemEdit } from "./GroceryItemRow";

interface GroceryListSectionProps {
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  recipeContentMap: Record<string, RecipeContent>;
  onParseRecipe: (recipeId: string) => Promise<void>;
  eventName: string;
  isLoading?: boolean;
  pantryItems?: string[];
  smartGroceryItems?: SmartGroceryItem[] | null;
  isCombining?: boolean;
  editable?: boolean;
  onEditItem?: (originalName: string, edits: GroceryItemEdit) => void;
  onRemoveItem?: (itemName: string) => void;
  onAddItem?: (item: { name: string; totalQuantity?: number; unit?: string }) => void;
  displayNameMap?: Record<string, string>;
  combineError?: string | null;
}

function groupSmartByCategory(
  items: SmartGroceryItem[]
): Map<GroceryCategory, SmartGroceryItem[]> {
  const map = new Map<GroceryCategory, SmartGroceryItem[]>();
  for (const category of CATEGORY_ORDER) {
    const categoryItems = items.filter((item) => item.category === category);
    if (categoryItems.length > 0) {
      map.set(category, categoryItems);
    }
  }
  return map;
}

const GroceryListSection = ({
  recipes,
  recipeIngredients,
  recipeContentMap,
  onParseRecipe,
  eventName,
  isLoading,
  pantryItems = [],
  smartGroceryItems,
  isCombining,
  editable,
  onEditItem,
  onRemoveItem,
  onAddItem,
  displayNameMap,
  combineError,
}: GroceryListSectionProps) => {
  const [parsingRecipeId, setParsingRecipeId] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");

  // Smart grocery grouping (with pantry filtering)
  const filteredSmartItems = smartGroceryItems && pantryItems.length > 0
    ? filterSmartPantryItems(smartGroceryItems, pantryItems)
    : smartGroceryItems;
  const smartGrouped = filteredSmartItems ? groupSmartByCategory(filteredSmartItems) : null;

  const handleParse = async (recipeId: string) => {
    setParsingRecipeId(recipeId);
    try {
      await onParseRecipe(recipeId);
    } finally {
      setParsingRecipeId(null);
    }
  };

  const handleAddItem = () => {
    const trimmedName = newItemName.trim();
    if (!trimmedName) return;
    const parsedQty = newItemQuantity.trim() ? Number(newItemQuantity.trim()) : undefined;
    const trimmedUnit = newItemUnit.trim() || undefined;
    onAddItem?.({ name: trimmedName, totalQuantity: parsedQty, unit: trimmedUnit });
    setNewItemName("");
    setNewItemQuantity("");
    setNewItemUnit("");
    setIsAddingItem(false);
  };

  const handleAddItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddItem();
    } else if (e.key === "Escape") {
      setIsAddingItem(false);
    }
  };

  const recipesWithUrl = recipes.filter((r) => r.url);
  const hasAnyIngredients = recipeIngredients.length > 0;

  // Group ingredients by recipe for per-recipe tabs
  const ingredientsByRecipe = new Map<string, RecipeIngredient[]>();
  for (const ing of recipeIngredients) {
    const existing = ingredientsByRecipe.get(ing.recipeId) || [];
    existing.push(ing);
    ingredientsByRecipe.set(ing.recipeId, existing);
  }

  // Recipes that have parsed ingredients (for per-recipe tabs)
  const recipesWithIngredients = recipes.filter(
    (r) => (ingredientsByRecipe.get(r.id)?.length ?? 0) > 0
  );

  return (
    <Card className="bg-white/90 backdrop-blur-sm border border-purple/10">
      <CardContent className="pt-4 sm:pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-purple" />
            <h2 className="font-display text-lg sm:text-xl font-semibold">Grocery List</h2>
          </div>
          {hasAnyIngredients && (
            <GroceryExportMenu
              items={filteredSmartItems || []}
              eventName={eventName}
            />
          )}
        </div>

        {/* Parse buttons for unparsed recipes */}
        {SHOW_PARSE_BUTTONS && recipesWithUrl.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {recipesWithUrl.map((recipe) => {
              const content = recipeContentMap[recipe.id];
              const isParsing = parsingRecipeId === recipe.id || content?.status === "parsing";
              const isParsed = content?.status === "completed";
              const isFailed = content?.status === "failed";

              return (
                <div key={recipe.id} className="flex items-center gap-1.5">
                  {!isParsed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleParse(recipe.id)}
                      disabled={isParsing}
                      className="text-xs"
                    >
                      {isParsing ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        <>Parse "{recipe.name}"</>
                      )}
                    </Button>
                  )}
                  {isParsed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleParse(recipe.id)}
                      disabled={parsingRecipeId === recipe.id}
                      className="text-xs text-gray-500"
                      title="Re-parse recipe"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${parsingRecipeId === recipe.id ? "animate-spin" : ""}`} />
                      {recipe.name}
                    </Button>
                  )}
                  {isFailed && (
                    <span className="flex items-center text-xs text-red-500">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Failed
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple" />
          </div>
        )}

        {!isLoading && !hasAnyIngredients && (
          <p className="text-sm text-gray-500 text-center py-4">
            No ingredients parsed yet. Click "Parse" on a recipe above to generate the grocery list.
          </p>
        )}

        {!isLoading && hasAnyIngredients && (
          <Tabs defaultValue="combined" className="w-full">
            <div className="overflow-x-auto">
              <TabsList className="mb-3 inline-flex w-auto">
                <TabsTrigger value="combined">Combined</TabsTrigger>
                {recipesWithIngredients.map((recipe) => (
                  <TabsTrigger key={recipe.id} value={recipe.id} className="whitespace-nowrap">
                    {recipe.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="combined">
              {isCombining && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-purple mr-2" />
                  <span className="text-sm text-muted-foreground">Combining ingredients...</span>
                </div>
              )}

              {!isCombining && smartGrouped && (
                <>
                  {Array.from(smartGrouped.entries()).map(([category, items]) => (
                    <GroceryCategoryGroup
                      key={category}
                      category={category}
                      items={items}
                      editable={editable}
                      onEditItem={onEditItem}
                      onRemoveItem={onRemoveItem}
                    />
                  ))}
                </>
              )}

              {!isCombining && !smartGrouped && combineError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-md border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">
                    Failed to combine ingredients: {combineError}
                  </p>
                </div>
              )}
            </TabsContent>

            {recipesWithIngredients.map((recipe) => {
              const recipeIngs = ingredientsByRecipe.get(recipe.id)!;
              const recipeItems: SmartGroceryItem[] = recipeIngs.map((ing) => ({
                name: ing.name.toLowerCase().trim(),
                displayName: displayNameMap?.[ing.name] ?? ing.name,
                totalQuantity: ing.quantity ?? undefined,
                unit: ing.unit ?? undefined,
                category: ing.category,
                sourceRecipes: [recipe.name],
              }));
              const filteredRecipeItems = pantryItems.length > 0
                ? filterSmartPantryItems(recipeItems, pantryItems)
                : recipeItems;
              const recipeGrouped = groupSmartByCategory(filteredRecipeItems);

              return (
                <TabsContent key={recipe.id} value={recipe.id}>
                  {Array.from(recipeGrouped.entries()).map(([category, items]) => (
                    <GroceryCategoryGroup
                      key={`${recipe.id}-${category}`}
                      category={category}
                      items={items}
                      editable={editable}
                      onEditItem={onEditItem}
                      onRemoveItem={onRemoveItem}
                    />
                  ))}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {editable && !isLoading && hasAnyIngredients && (
          <div className="mt-3 border-t pt-3">
            {!isAddingItem ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingItem(true)}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add item
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(e.target.value)}
                  placeholder="Qty"
                  className="w-16 h-7 text-sm"
                  onKeyDown={handleAddItemKeyDown}
                  aria-label="New item quantity"
                />
                <Input
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  placeholder="Unit"
                  className="w-20 h-7 text-sm"
                  onKeyDown={handleAddItemKeyDown}
                  aria-label="New item unit"
                />
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name"
                  className="flex-1 h-7 text-sm"
                  onKeyDown={handleAddItemKeyDown}
                  aria-label="New item name"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs"
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingItem(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default GroceryListSection;
