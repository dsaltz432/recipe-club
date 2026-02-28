import { useState } from "react";
import { Loader2, RefreshCw, AlertCircle, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RecipeIngredient, RecipeContent, SmartGroceryItem, GroceryCategory, Recipe, GeneralGroceryItem } from "@/types";
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
  perRecipeItems?: Record<string, SmartGroceryItem[]>;
  combineError?: string | null;
  checkedItems?: Set<string>;
  onToggleChecked?: (itemName: string) => void;
  generalItems?: GeneralGroceryItem[];
  onAddGeneralItem?: (item: { name: string; quantity?: string; unit?: string }) => void;
  onRemoveGeneralItem?: (itemId: string) => void;
  onUpdateGeneralItem?: (itemId: string, updates: { name?: string; quantity?: string; unit?: string }) => void;
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
  perRecipeItems,
  combineError,
  checkedItems,
  onToggleChecked,
  generalItems = [],
  onAddGeneralItem,
  onRemoveGeneralItem,
  onUpdateGeneralItem,
}: GroceryListSectionProps) => {
  const [parsingRecipeId, setParsingRecipeId] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  // General tab state
  const [newGeneralName, setNewGeneralName] = useState("");
  const [newGeneralQty, setNewGeneralQty] = useState("");
  const [newGeneralUnit, setNewGeneralUnit] = useState("");
  const [editingGeneralId, setEditingGeneralId] = useState<string | null>(null);
  const [editGeneralName, setEditGeneralName] = useState("");
  const [editGeneralQty, setEditGeneralQty] = useState("");
  const [editGeneralUnit, setEditGeneralUnit] = useState("");

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

  const handleAddGeneral = () => {
    const trimmedName = newGeneralName.trim();
    if (!trimmedName) return;
    onAddGeneralItem?.({
      name: trimmedName,
      quantity: newGeneralQty.trim() || undefined,
      unit: newGeneralUnit.trim() || undefined,
    });
    setNewGeneralName("");
    setNewGeneralQty("");
    setNewGeneralUnit("");
  };

  const handleAddGeneralKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddGeneral();
  };

  const startEditGeneral = (item: GeneralGroceryItem) => {
    setEditingGeneralId(item.id);
    setEditGeneralName(item.name);
    setEditGeneralQty(item.quantity ?? "");
    setEditGeneralUnit(item.unit ?? "");
  };

  const saveEditGeneral = () => {
    if (!editingGeneralId || !editGeneralName.trim()) return;
    onUpdateGeneralItem?.(editingGeneralId, {
      name: editGeneralName.trim(),
      quantity: editGeneralQty.trim() || undefined,
      unit: editGeneralUnit.trim() || undefined,
    });
    setEditingGeneralId(null);
  };

  const cancelEditGeneral = () => {
    setEditingGeneralId(null);
  };

  const handleEditGeneralKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEditGeneral();
    else if (e.key === "Escape") cancelEditGeneral();
  };

  const recipesWithUrl = recipes.filter((r) => r.url);
  const hasAnyIngredients = recipeIngredients.length > 0;
  const hasGeneralTab = !!onAddGeneralItem;

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
          <Tabs defaultValue={hasAnyIngredients ? "combined" : "general"} className="w-full">
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
              <GroceryExportMenu
                items={filteredSmartItems || []}
                eventName={eventName}
              />
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
                    Failed to combine ingredients. Please try again later or contact your administrator.
                  </p>
                </div>
              )}
            </TabsContent>

            {recipesWithIngredients.map((recipe) => {
              const recipeItems = perRecipeItems?.[recipe.name] ?? [];
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
                        onRemoveItem={onRemoveItem}
                        checkedItems={checkedItems}
                        onToggleChecked={onToggleChecked}
                      />
                    ))
                  )}
                </TabsContent>
              );
            })}

            {hasGeneralTab && (
              <TabsContent value="general">
                {generalItems.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No items yet. Add items below to include them in your grocery list.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {generalItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-gray-50 group">
                        {editingGeneralId === item.id ? (
                          <>
                            <Input
                              value={editGeneralQty}
                              onChange={(e) => setEditGeneralQty(e.target.value)}
                              placeholder="Qty"
                              className="w-16 h-7 text-sm"
                              onKeyDown={handleEditGeneralKeyDown}
                              aria-label="Edit quantity"
                            />
                            <Input
                              value={editGeneralUnit}
                              onChange={(e) => setEditGeneralUnit(e.target.value)}
                              placeholder="Unit"
                              className="w-20 h-7 text-sm"
                              onKeyDown={handleEditGeneralKeyDown}
                              aria-label="Edit unit"
                            />
                            <Input
                              value={editGeneralName}
                              onChange={(e) => setEditGeneralName(e.target.value)}
                              placeholder="Item name"
                              className="flex-1 h-7 text-sm"
                              onKeyDown={handleEditGeneralKeyDown}
                              aria-label="Edit name"
                            />
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={saveEditGeneral} aria-label="Save edit">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400" onClick={cancelEditGeneral} aria-label="Cancel edit">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {onToggleChecked && (
                              <button
                                type="button"
                                onClick={() => onToggleChecked(item.name)}
                                className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                  checkedItems?.has(item.name) ? "bg-purple border-purple" : "border-gray-300 hover:border-gray-400"
                                }`}
                                aria-label={checkedItems?.has(item.name) ? "Uncheck item" : "Check item"}
                              >
                                {checkedItems?.has(item.name) && <Check className="h-3 w-3 text-white" />}
                              </button>
                            )}
                            <span className={`flex-1 text-sm ${checkedItems?.has(item.name) ? "line-through opacity-50" : ""}`}>
                              {item.quantity && <span>{item.quantity} </span>}
                              {item.unit && <span>{item.unit} </span>}
                              {item.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-gray-400 opacity-0 group-hover:opacity-100 md:opacity-0"
                              onClick={() => startEditGeneral(item)}
                              aria-label="Edit general item"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 opacity-0 group-hover:opacity-100 md:opacity-0"
                              onClick={() => onRemoveGeneralItem?.(item.id)}
                              aria-label="Remove general item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add general item input */}
                <div className="mt-3 border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newGeneralQty}
                      onChange={(e) => setNewGeneralQty(e.target.value)}
                      placeholder="Qty"
                      className="w-16 h-9 sm:h-7 text-sm"
                      onKeyDown={handleAddGeneralKeyDown}
                      aria-label="General item quantity"
                    />
                    <Input
                      value={newGeneralUnit}
                      onChange={(e) => setNewGeneralUnit(e.target.value)}
                      placeholder="Unit"
                      className="w-20 h-9 sm:h-7 text-sm"
                      onKeyDown={handleAddGeneralKeyDown}
                      aria-label="General item unit"
                    />
                    <Input
                      value={newGeneralName}
                      onChange={(e) => setNewGeneralName(e.target.value)}
                      placeholder="Add item..."
                      className="flex-1 h-9 sm:h-7 text-sm"
                      onKeyDown={handleAddGeneralKeyDown}
                      aria-label="General item name"
                    />
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleAddGeneral}
                      className="h-9 sm:h-7 text-xs"
                      disabled={!newGeneralName.trim()}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
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
