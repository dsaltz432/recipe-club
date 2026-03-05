import { useState } from "react";
import { Loader2, RefreshCw, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { RecipeIngredient, RecipeContent, SmartGroceryItem, GroceryCategory, Recipe, GeneralGroceryItem } from "@/types";
import { filterSmartPantryItems, CATEGORY_ORDER } from "@/lib/groceryList";
import { SHOW_PARSE_BUTTONS } from "@/lib/constants";
import GroceryCategoryGroup from "./GroceryCategoryGroup";
import GroceryExportMenu from "./GroceryExportMenu";
import type { GroceryItemEdit } from "./GroceryItemRow";
import AddIngredientInput from "./AddIngredientInput";

export interface ParsedGroceryItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
}

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
  onEditItemText?: (originalName: string, newText: string, sourceRecipeId?: string) => void;
  onRemoveItem?: (itemName: string, sourceRecipeId?: string) => void;
  onAddItem?: (item: { name: string; totalQuantity?: number; unit?: string }) => void;
  perRecipeItems?: Record<string, SmartGroceryItem[]>;
  combineError?: string | null;
  checkedItems?: Set<string>;
  onToggleChecked?: (itemName: string) => void;
  generalItems?: GeneralGroceryItem[];
  onAddGeneralItemDirect?: (item: { name: string; quantity?: string; unit?: string }) => Promise<void>;
  onBulkParseGroceryText?: (text: string) => Promise<ParsedGroceryItem[]>;
  hasPendingChanges?: boolean;
  onRecombine?: () => Promise<void> | void;
  isAddingGeneral?: boolean;
  onAddingGeneralChange?: (v: boolean) => void;
  onAddItemsToRecipe?: (recipeId: string, text: string) => Promise<void>;
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
  onEditItemText,
  onRemoveItem,
  onAddItem,
  perRecipeItems,
  combineError,
  checkedItems,
  onToggleChecked,
  generalItems = [],
  onAddGeneralItemDirect,
  onBulkParseGroceryText,
  hasPendingChanges,
  onRecombine,
  isAddingGeneral: externalIsAdding,
  onAddingGeneralChange,
  onAddItemsToRecipe,
}: GroceryListSectionProps) => {
  const [parsingRecipeId, setParsingRecipeId] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  // General tab state
  const [localIsParsing, setLocalIsParsing] = useState(false);
  const isParsing = externalIsAdding ?? localIsParsing;
  const setIsParsing = onAddingGeneralChange ?? setLocalIsParsing;
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

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

  const existingGeneralNames = new Set(generalItems.map((item) => item.name.toLowerCase()));

  // AI-processed General items — render these just like a recipe tab
  const generalSmartItems = perRecipeItems?.["General"] ?? [];
  const filteredGeneralItems = pantryItems.length > 0
    ? filterSmartPantryItems(generalSmartItems, pantryItems)
    : generalSmartItems;
  const generalGrouped = groupSmartByCategory(filteredGeneralItems);

  const handleBulkAdd = async (text: string) => {
    if (!onBulkParseGroceryText || !onAddGeneralItemDirect) return;
    setIsParsing(true);
    try {
      const items = await onBulkParseGroceryText(text);
      for (const item of items) {
        const isDuplicate = existingGeneralNames.has(item.name.toLowerCase());
        if (isDuplicate) continue;
        await onAddGeneralItemDirect({
          name: item.name,
          quantity: item.quantity != null ? String(item.quantity) : undefined,
          unit: item.unit ?? undefined,
        });
      }
      await onRecombine?.();
    } catch {
      toast.error("Failed to add items. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const recipesWithUrl = recipes.filter((r) => r.url);
  const hasAnyIngredients = recipeIngredients.length > 0;
  const hasGeneralTab = !!onBulkParseGroceryText;

  // Controlled tab: use explicit selection if set, otherwise default
  const defaultTab = hasAnyIngredients ? "combined" : "general";
  const effectiveTab = activeTab ?? defaultTab;

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

        {!isLoading && !hasAnyIngredients && !hasGeneralTab && (
          <p className="text-sm text-gray-500 text-center py-4">
            No ingredients parsed yet. Click "Parse" on a recipe above to generate the grocery list.
          </p>
        )}

        {!isLoading && (hasAnyIngredients || hasGeneralTab) && (
          <Tabs value={effectiveTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="overflow-x-auto">
                <TabsList className="inline-flex w-auto">
                  {hasAnyIngredients && <TabsTrigger value="combined">Combined</TabsTrigger>}
                  {recipesWithIngredients.map((recipe) => (
                    <TabsTrigger key={recipe.id} value={recipe.id} className="whitespace-nowrap max-w-[120px] truncate sm:max-w-none">
                      {recipe.name}
                    </TabsTrigger>
                  ))}
                  {hasGeneralTab && <TabsTrigger value="general">General</TabsTrigger>}
                </TabsList>
              </div>
              <div className="flex items-center gap-2">
                {hasPendingChanges && !isCombining && !isParsing && onRecombine && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRecombine}
                    className="text-xs border-purple/30 text-purple hover:bg-purple/5 animate-in fade-in duration-300"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reprocess
                  </Button>
                )}
                <GroceryExportMenu
                  items={filteredSmartItems || []}
                  eventName={eventName}
                  checkedItems={checkedItems}
                />
              </div>
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
                      checkedItems={checkedItems}
                      onToggleChecked={onToggleChecked}
                    />
                  ))}
                </>
              )}

              {!isCombining && !smartGrouped && combineError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-md border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">
                    {combineError}
                  </p>
                </div>
              )}
            </TabsContent>

            {recipesWithIngredients.map((recipe) => {
              const recipeItems = perRecipeItems?.[recipe.id] ?? perRecipeItems?.[recipe.name] ?? [];
              const filteredRecipeItems = pantryItems.length > 0
                ? filterSmartPantryItems(recipeItems, pantryItems)
                : recipeItems;
              const recipeGrouped = groupSmartByCategory(filteredRecipeItems);

              return (
                <TabsContent key={recipe.id} value={recipe.id}>
                  {isCombining && recipeItems.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Combining ingredients...</span>
                    </div>
                  ) : (
                    Array.from(recipeGrouped.entries()).map(([category, items]) => (
                      <GroceryCategoryGroup
                        key={`${recipe.id}-${category}`}
                        category={category}
                        items={items}
                        editable={editable}
                        onEditItem={onEditItem}
                        onEditItemText={onEditItemText ? (orig, text) => onEditItemText(orig, text, recipe.id) : undefined}
                        onRemoveItem={onRemoveItem ? (name) => onRemoveItem(name, recipe.id) : undefined}
                        checkedItems={checkedItems}
                        onToggleChecked={onToggleChecked}
                      />
                    ))
                  )}
                  {onAddItemsToRecipe && (
                    <AddIngredientInput
                      onSubmit={(text) => onAddItemsToRecipe(recipe.id, text)}
                      placeholder="Add ingredient, e.g. 2 tbsp olive oil"
                      className="mt-3 border-t pt-3"
                    />
                  )}
                </TabsContent>
              );
            })}

            {hasGeneralTab && (
              <TabsContent value="general">
                <div className="relative">
                  {/* Loading overlay */}
                  {isParsing && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-md">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-purple" />
                        <span className="text-sm font-medium text-muted-foreground">Adding ingredients...</span>
                      </div>
                    </div>
                  )}

                  {generalItems.length === 0 && !isParsing ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No items yet. Add items below to include them in your grocery list.
                    </p>
                  ) : (
                    !isParsing && isCombining && generalSmartItems.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Combining ingredients...</span>
                      </div>
                    ) : !isParsing ? (
                      Array.from(generalGrouped.entries()).map(([category, items]) => (
                        <GroceryCategoryGroup
                          key={`general-${category}`}
                          category={category}
                          items={items}
                          onEditItemText={onEditItemText}
                          onRemoveItem={onRemoveItem}
                          checkedItems={checkedItems}
                          onToggleChecked={onToggleChecked}
                        />
                      ))
                    ) : null
                  )}

                  {/* Add general items */}
                  <AddIngredientInput
                    onSubmit={handleBulkAdd}
                    className="mt-3 border-t pt-3"
                  />
                </div>
              </TabsContent>
            )}
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
                  name="new-grocery-qty"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(e.target.value)}
                  placeholder="Qty"
                  className="w-16 h-9 sm:h-7 text-sm"
                  onKeyDown={handleAddItemKeyDown}
                  aria-label="New item quantity"
                />
                <Input
                  name="new-grocery-unit"
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  placeholder="Unit"
                  className="w-20 h-9 sm:h-7 text-sm"
                  onKeyDown={handleAddItemKeyDown}
                  aria-label="New item unit"
                />
                <Input
                  name="new-grocery-name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name"
                  className="flex-1 h-9 sm:h-7 text-sm"
                  onKeyDown={handleAddItemKeyDown}
                  aria-label="New item name"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-9 sm:h-7 text-xs"
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingItem(false)}
                  className="h-9 sm:h-7 text-xs"
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
