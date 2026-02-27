import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ChevronDown, ChevronUp, MessageSquare, Camera, Star, Pencil, Trash2, Plus, Loader2, ListChecks } from "lucide-react";
import type { Recipe, RecipeNote, RecipeRatingsSummary, RecipeIngredient, RecipeContent } from "@/types";
import { GROCERY_CATEGORIES, CATEGORY_ORDER, isPantryItem } from "@/lib/groceryList";
import { getLightBackgroundColor, getBorderColor, getDarkerTextColor } from "@/lib/ingredientColors";
import { DEFAULT_PANTRY_ITEMS } from "@/lib/pantry";

// Helper to render stars with half-star support
const renderStars = (rating: number, starSize = "h-4 w-4") => {
  return [1, 2, 3, 4, 5].map((star) => {
    if (rating >= star) {
      // Full star
      return <Star key={star} className={`${starSize} fill-yellow-400 text-yellow-400`} />;
    } else if (rating >= star - 0.5) {
      // Half star - use relative positioning to overlay half-filled on empty
      return (
        <div key={star} className={`${starSize} relative`}>
          <Star className={`${starSize} text-gray-300 absolute`} />
          <div className="overflow-hidden w-1/2">
            <Star className={`${starSize} fill-yellow-400 text-yellow-400`} />
          </div>
        </div>
      );
    } else {
      // Empty star
      return <Star key={star} className={`${starSize} text-gray-300`} />;
    }
  });
};

interface RecipeWithNotes extends Recipe {
  notes: RecipeNote[];
  ingredientName?: string;
  ingredientColor?: string;
  ratingSummary?: RecipeRatingsSummary;
  isPersonal?: boolean;
}

export type RecipeCardRecipe = RecipeWithNotes;

interface RecipeCardProps {
  recipe: RecipeWithNotes;
  onEdit?: (recipe: RecipeWithNotes) => void;
  onDelete?: (recipeId: string) => void;
  onEditRating?: (recipe: RecipeWithNotes) => void;
  onAddNote?: (recipe: RecipeWithNotes) => void;
  onEditIngredients?: (recipe: RecipeWithNotes) => void;
  ingredients?: RecipeIngredient[];
  pantryItems?: string[];
  contentStatus?: RecipeContent["status"];
  onParseRecipe?: (recipeId: string) => void;
}

const RecipeCard = ({ recipe, onEdit, onDelete, onEditRating, onAddNote, onEditIngredients, ingredients, pantryItems, contentStatus, onParseRecipe }: RecipeCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);

  const allPantryItems = pantryItems && pantryItems.length > 0
    ? [...new Set([...DEFAULT_PANTRY_ITEMS, ...pantryItems])]
    : DEFAULT_PANTRY_ITEMS;
  const filteredIngredients = ingredients?.filter(
    (ing) => !isPantryItem(ing.name, allPantryItems, ing.unit)
  );
  const hasIngredients = filteredIngredients && filteredIngredients.length > 0;
  const hasDetails = recipe.notes.length > 0;

  // Get colors from ingredient
  const bgColor = recipe.ingredientColor ? getLightBackgroundColor(recipe.ingredientColor) : undefined;
  const borderColor = recipe.ingredientColor ? getBorderColor(recipe.ingredientColor) : undefined;
  const themeColor = recipe.ingredientColor ? getDarkerTextColor(recipe.ingredientColor) : "#9b87f5";

  return (
    <Card
      className="backdrop-blur-sm overflow-hidden"
      style={{
        backgroundColor: bgColor || "rgba(255, 255, 255, 0.8)",
        borderColor: borderColor || undefined,
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Recipe submitter avatar */}
          {recipe.createdByName && (
            <Avatar
              className="h-9 w-9"
              style={{ boxShadow: `0 0 0 2px ${borderColor || "rgba(155, 135, 245, 0.2)"}` }}
            >
              <AvatarImage src={recipe.createdByAvatar} />
              <AvatarFallback
                style={{
                  backgroundColor: bgColor || "rgba(155, 135, 245, 0.1)",
                  color: themeColor,
                }}
              >
                {recipe.createdByName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="font-display text-lg font-semibold truncate flex-1">{recipe.name}</h3>
              {/* Action buttons in header */}
              {(recipe.url || onAddNote || onEditIngredients || onDelete || onEdit) && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {recipe.url && (
                    <a
                      href={recipe.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-7 w-7 p-0 rounded-md hover:bg-accent"
                      aria-label="Open recipe URL"
                    >
                      <ExternalLink className="h-3.5 w-3.5" style={{ color: themeColor }} />
                    </a>
                  )}
                  {onAddNote && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onAddNote(recipe)}
                      aria-label="Add note"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onEditIngredients && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      aria-label="Edit ingredients"
                      onClick={() => onEditIngredients(recipe)}
                    >
                      <ListChecks className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      aria-label="Edit recipe"
                      onClick={() => onEdit(recipe)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      aria-label="Delete recipe"
                      onClick={() => onDelete(recipe.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {recipe.createdByName && (
                <span className="text-xs text-muted-foreground">
                  by {recipe.createdByName}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Badges row */}
        {(recipe.isPersonal || recipe.ingredientName) && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {recipe.isPersonal && (
              <Badge variant="outline" className="border-purple text-purple bg-purple/5">
                Personal
              </Badge>
            )}
            {recipe.ingredientName && (
              <Badge
                variant="outline"
                style={{
                  borderColor: themeColor,
                  color: themeColor,
                  backgroundColor: bgColor || undefined,
                }}
              >
                {recipe.ingredientName}
              </Badge>
            )}
          </div>
        )}

        {/* Rating display */}
        {recipe.ratingSummary && recipe.ratingSummary.totalRatings > 0 && (
          <div className="flex flex-col gap-1 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {renderStars(recipe.ratingSummary.averageRating)}
              </div>
              <span className="text-sm font-medium">
                {Number.isInteger(recipe.ratingSummary.averageRating)
                  ? recipe.ratingSummary.averageRating
                  : recipe.ratingSummary.averageRating.toFixed(1)}/5
              </span>
              {recipe.eventId && onEditRating && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-1"
                  aria-label="Edit rating"
                  onClick={() => onEditRating(recipe)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            {recipe.ratingSummary.memberRatings.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                <span>Make again:</span>
                {recipe.ratingSummary.memberRatings.map((member, idx) => (
                  <span key={idx} className={member.wouldCookAgain ? "text-green-600" : "text-red-500"}>
                    {member.initial}: {member.wouldCookAgain ? "Yes" : "No"}
                    {idx < recipe.ratingSummary!.memberRatings.length - 1 && ","}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick stats */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3 items-center">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {recipe.notes.length} {recipe.notes.length !== 1 ? "notes" : "note"}
          </span>
          {recipe.notes.some((n) => n.photos && n.photos.length > 0) && (
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {recipe.notes.reduce((sum, n) => sum + (n.photos?.length || 0), 0)} photos
            </span>
          )}
        </div>

        {/* Ingredients Section */}
        {contentStatus === "parsing" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Parsing ingredients...
          </div>
        ) : contentStatus === "failed" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <span>Parsing failed</span>
            {recipe.url && onParseRecipe && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onParseRecipe(recipe.id)}
              >
                Retry
              </Button>
            )}
          </div>
        ) : hasIngredients ? (
          <div className="mb-3">
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => setIngredientsExpanded(!ingredientsExpanded)}
              aria-label={ingredientsExpanded ? "Collapse ingredients" : "Expand ingredients"}
            >
              {ingredientsExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              <span>{filteredIngredients!.length} ingredient{filteredIngredients!.length !== 1 ? "s" : ""}</span>
            </button>
            {ingredientsExpanded && (
              <div className="mt-2 space-y-2 pl-1">
                {CATEGORY_ORDER.filter((cat) =>
                  filteredIngredients!.some((ing) => ing.category === cat)
                ).map((cat) => (
                  <div key={cat}>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {GROCERY_CATEGORIES[cat]}
                    </div>
                    <ul className="space-y-0.5">
                      {filteredIngredients!
                        .filter((ing) => ing.category === cat)
                        .map((ing) => (
                          <li key={ing.id} className="text-sm">
                            {ing.quantity ? `${ing.quantity} ` : ""}{ing.unit ? `${ing.unit} ` : ""}{ing.name}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : recipe.url && contentStatus !== "completed" && onParseRecipe ? (
          <div className="mb-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onParseRecipe(recipe.id)}
            >
              Parse Ingredients
            </Button>
          </div>
        ) : null}

        {/* Expandable Details */}
        {hasDetails && (
          <>
            {isExpanded && (
              <div className="space-y-3 mt-3 pt-3 border-t">
                {/* Notes from contributors */}
                {recipe.notes.some((n) => n.notes || (n.photos && n.photos.length > 0)) && (
                  <div className="space-y-3">
                    {recipe.notes
                      .filter((n) => n.notes || (n.photos && n.photos.length > 0))
                      .map((note) => (
                        <div
                          key={note.id}
                          className="pl-3 border-l-2 space-y-1"
                          style={{ borderLeftColor: borderColor || "rgba(155, 135, 245, 0.2)" }}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={note.userAvatar} />
                              <AvatarFallback>
                                {note.userName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {note.userName}'s Notes
                            </span>
                          </div>
                          {note.notes && (
                            <p className="text-sm text-muted-foreground">
                              {note.notes}
                            </p>
                          )}
                          {note.photos && note.photos.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {note.photos.map((photo, idx) => (
                                <img
                                  key={idx}
                                  src={photo}
                                  alt={`${recipe.name} photo ${idx + 1}`}
                                  className="h-20 w-20 object-cover rounded-md flex-shrink-0"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show More
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RecipeCard;
