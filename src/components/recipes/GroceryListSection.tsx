import { useState } from "react";
import { Loader2, RefreshCw, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { RecipeIngredient, SmartGroceryItem, GroceryCategory, Recipe, GeneralGroceryItem } from "@/types";
import { filterSmartPantryItems, CATEGORY_ORDER } from "@/lib/groceryList";
import GroceryCategoryGroup from "./GroceryCategoryGroup";
import GroceryExportMenu from "./GroceryExportMenu";
import GroceryItemRow from "./GroceryItemRow";
import type { GroceryItemEdit } from "./GroceryItemRow";
import AddIngredientInput from "./AddIngredientInput";

const RECIPE_COLORS = [
  "bg-blue-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-violet-400",
  "bg-cyan-400",
  "bg-orange-400",
  "bg-teal-400",
];

export interface ParsedGroceryItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
}

interface GroceryListSectionProps {
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
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
  onAddGeneralItemDirect?: (item: { name: string; quantity?: string; unit?: string; category?: string }) => Promise<void>;
  onBulkParseGroceryText?: (text: string) => Promise<ParsedGroceryItem[]>;
  hasPendingChanges?: boolean;
  onRecombine?: () => Promise<void> | void;
  isAddingGeneral?: boolean;
  onAddingGeneralChange?: (v: boolean) => void;
  onAddItemsToRecipe?: (recipeId: string, text: string) => Promise<void>;
  onRemoveGeneralItem?: (itemId: string) => Promise<void>;
  onUpdateGeneralItem?: (itemId: string, updates: { name?: string; quantity?: string; unit?: string }) => Promise<void>;
}

const CheckedSummary = ({
  items,
  checkedItems,
  onToggleChecked,
  recipeColorMap,
}: {
  items: SmartGroceryItem[];
  checkedItems: Set<string>;
  onToggleChecked?: (name: string) => void;
  recipeColorMap?: Record<string, string>;
}) => {
  const checked = items.filter((i) => checkedItems.has(i.name));
  if (checked.length === 0) return null;
  return (
    <details className="mb-3">
      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-500 px-2 py-1 select-none">
        {checked.length} item{checked.length !== 1 ? "s" : ""} checked
      </summary>
      <div className="opacity-50 mt-1">
        {checked.map((item, index) => (
          <GroceryItemRow
            key={`checked-${item.name}-${index}`}
            item={item}
            isChecked={true}
            onToggleChecked={onToggleChecked ? () => onToggleChecked(item.name) : undefined}
            recipeColorMap={recipeColorMap}
          />
        ))}
      </div>
    </details>
  );
};

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
        await onAddGeneralItemDirect({
          name: item.name,
          quantity: item.quantity != null ? String(item.quantity) : undefined,
          unit: item.unit ?? undefined,
          category: item.category,
        });
      }
      // Items appear immediately in display state — Reprocess button shown for AI dedup
    } catch {
      toast.error("Failed to add items. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

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

  // Color map for combined tab: recipe name → color class
  const recipeColorMap: Record<string, string> = {};
  const colorNames = [...recipesWithIngredients.map((r) => r.name), "General"];
  colorNames.forEach((name, i) => {
    recipeColorMap[name] = RECIPE_COLORS[i % RECIPE_COLORS.length];
  });

  return (
    <Card className="bg-white/90 backdrop-blur-sm border border-purple/10">
      <CardContent className="pt-4 sm:pt-6 pb-4">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              {/* Mobile: Select + export on one row */}
              <div className="flex sm:hidden items-center gap-2">
                <div className="flex-1">
                  <Select value={effectiveTab} onValueChange={setActiveTab}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hasAnyIngredients && <SelectItem value="combined">Combined</SelectItem>}
                      {recipesWithIngredients.map((recipe) => (
                        <SelectItem key={recipe.id} value={recipe.id}>{recipe.name}</SelectItem>
                      ))}
                      {hasGeneralTab && <SelectItem value="general">General</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {hasPendingChanges && !isCombining && !isParsing && onRecombine && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRecombine}
                      className="text-xs border-purple/30 text-purple hover:bg-purple/5 animate-in fade-in duration-300"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Recombine
                    </Button>
                  )}
                  <GroceryExportMenu
                    items={filteredSmartItems || []}
                    eventName={eventName}
                    checkedItems={checkedItems}
                  />
                </div>
              </div>
              {/* Desktop: TabsList */}
              <div className="hidden sm:block overflow-x-auto">
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
              {/* Desktop: Recombine + export */}
              <div className="hidden sm:flex items-center gap-2">
                {hasPendingChanges && !isCombining && !isParsing && onRecombine && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRecombine}
                    className="text-xs border-purple/30 text-purple hover:bg-purple/5 animate-in fade-in duration-300"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Recombine
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
                  {checkedItems && filteredSmartItems && (
                    <CheckedSummary
                      items={filteredSmartItems}
                      checkedItems={checkedItems}
                      onToggleChecked={onToggleChecked}
                      recipeColorMap={recipeColorMap}
                    />
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs text-muted-foreground">
                    {colorNames.filter((name) => recipeColorMap[name]).map((name) => (
                      <span key={name} className="flex items-center gap-1">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${recipeColorMap[name]}`} />
                        {name}
                      </span>
                    ))}
                  </div>
                  {Array.from(smartGrouped.entries()).map(([category, items]) => (
                    <GroceryCategoryGroup
                      key={category}
                      category={category}
                      items={items}
                      checkedItems={checkedItems}
                      onToggleChecked={onToggleChecked}
                      recipeColorMap={recipeColorMap}
                    />
                  ))}
                </>
              )}

              {!isCombining && !smartGrouped && combineError && (
                <div className="flex items-center justify-between gap-3 p-3 bg-red-50 rounded-md border border-red-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">
                      Couldn't combine grocery items. Try again or check individual recipe tabs.
                    </p>
                  </div>
                  {onRecombine && (
                    <Button variant="outline" size="sm" onClick={onRecombine} className="shrink-0 text-xs">
                      Try Again
                    </Button>
                  )}
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
                    <>
                      {checkedItems && (
                        <CheckedSummary
                          items={filteredRecipeItems}
                          checkedItems={checkedItems}
                          onToggleChecked={onToggleChecked}
                        />
                      )}
                    {Array.from(recipeGrouped.entries()).map(([category, items]) => (
                      <GroceryCategoryGroup
                        key={`${recipe.id}-${category}`}
                        category={category}
                        items={items.map((i) => ({ ...i, sourceRecipes: [] }))}
                        editable={editable}
                        onEditItem={onEditItem}
                        onEditItemText={onEditItemText ? (orig, text) => onEditItemText(orig, text, recipe.id) : undefined}
                        onRemoveItem={onRemoveItem ? (name) => onRemoveItem(name, recipe.id) : undefined}
                        checkedItems={checkedItems}
                        onToggleChecked={onToggleChecked}
                      />
                    ))}
                    </>
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
                      <>
                        {checkedItems && (
                          <CheckedSummary
                            items={filteredGeneralItems}
                            checkedItems={checkedItems}
                            onToggleChecked={onToggleChecked}
                          />
                        )}
                      {Array.from(generalGrouped.entries()).map(([category, items]) => (
                        <GroceryCategoryGroup
                          key={`general-${category}`}
                          category={category}
                          items={items.map((i) => ({ ...i, sourceRecipes: [] }))}
                          onEditItemText={onEditItemText}
                          onRemoveItem={onRemoveItem}
                          checkedItems={checkedItems}
                          onToggleChecked={onToggleChecked}
                        />
                      ))}
                      </>
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
