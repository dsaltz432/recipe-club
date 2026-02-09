/* eslint-disable react-refresh/only-export-components */
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChefHat,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Camera,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { User, Recipe, RecipeNote, EventRecipeWithNotes, RecipeRatingsSummary } from "@/types";

export interface EventRecipeWithRatings extends EventRecipeWithNotes {
  ratingSummary?: RecipeRatingsSummary;
}

// Helper to render stars with half-star support
export const renderStars = (rating: number, starSize = "h-4 w-4") => {
  return [1, 2, 3, 4, 5].map((star) => {
    if (rating >= star) {
      return <Star key={star} className={`${starSize} fill-yellow-400 text-yellow-400`} />;
    } else if (rating >= star - 0.5) {
      return (
        <div key={star} className={`${starSize} relative`}>
          <Star className={`${starSize} text-gray-300 absolute`} />
          <div className="overflow-hidden w-1/2">
            <Star className={`${starSize} fill-yellow-400 text-yellow-400`} />
          </div>
        </div>
      );
    } else {
      return <Star key={star} className={`${starSize} text-gray-300`} />;
    }
  });
};

interface EventRecipesTabProps {
  recipesWithNotes: EventRecipeWithRatings[];
  user: User | null;
  userIsAdmin: boolean;
  expandedRecipeNotes: Set<string>;
  deletingNoteId: string | null;
  onToggleRecipeNotes: (recipeId: string) => void;
  onAddRecipeClick: () => void;
  onEditRecipeClick: (recipe: Recipe) => void;
  onAddNotesClick: (recipe: Recipe) => void;
  onEditNoteClick: (note: RecipeNote) => void;
  onDeleteNoteClick: (note: RecipeNote) => void;
  onDeleteRecipeClick: (recipe: Recipe) => void;
}

const EventRecipesTab = ({
  recipesWithNotes,
  user,
  userIsAdmin,
  expandedRecipeNotes,
  deletingNoteId,
  onToggleRecipeNotes,
  onAddRecipeClick,
  onEditRecipeClick,
  onAddNotesClick,
  onEditNoteClick,
  onDeleteNoteClick,
  onDeleteRecipeClick,
}: EventRecipesTabProps) => {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg sm:text-xl font-semibold">
          Recipes ({recipesWithNotes.length})
        </h2>
        {userIsAdmin && (
          <Button
            onClick={onAddRecipeClick}
            className="bg-gradient-to-r from-purple to-purple-dark hover:from-purple-dark hover:to-purple text-white shadow-md"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            <span>Add Recipe</span>
          </Button>
        )}
      </div>

      {recipesWithNotes.length === 0 ? (
        <Card className="bg-white/90 backdrop-blur-sm border-2 border-dashed border-purple/20">
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <div className="w-16 h-16 rounded-full bg-purple/10 flex items-center justify-center mb-4">
              <ChefHat className="h-8 w-8 text-purple" />
            </div>
            <p className="text-muted-foreground text-center text-sm sm:text-base">
              No recipes locked in yet. Be the first to add one!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {recipesWithNotes.map(({ recipe, notes, ratingSummary }) => {
            const hasUserNote = notes.some((n) => n.userId === user?.id);

            return (
              <Card
                key={recipe.id}
                className="bg-white/90 backdrop-blur-sm border border-purple/10 shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-3 sm:py-4 sm:px-6 space-y-3">
                  {/* Recipe header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                      {recipe.createdByName && (
                        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 ring-2 ring-purple/20">
                          <AvatarImage src={recipe.createdByAvatar} />
                          <AvatarFallback className="bg-purple/10 text-purple text-xs">
                            {recipe.createdByName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base sm:text-lg truncate">
                          {recipe.name}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {recipe.createdByName && (
                            <span className="text-xs text-muted-foreground">
                              by {recipe.createdByName}
                            </span>
                          )}
                          {recipe.url && (
                            <a
                              href={recipe.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs sm:text-sm text-purple hover:text-purple-dark hover:underline flex items-center gap-1 font-medium"
                            >
                              View recipe <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {/* Rating display */}
                        {ratingSummary && ratingSummary.totalRatings > 0 && (
                          <div className="flex flex-col gap-1 mt-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {renderStars(
                                  ratingSummary.averageRating,
                                  "h-3.5 w-3.5 sm:h-4 sm:w-4"
                                )}
                              </div>
                              <span className="text-xs sm:text-sm font-medium">
                                {Number.isInteger(ratingSummary.averageRating)
                                  ? ratingSummary.averageRating
                                  : ratingSummary.averageRating.toFixed(1)}
                                /5
                              </span>
                            </div>
                            {ratingSummary.memberRatings &&
                              ratingSummary.memberRatings.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                                  <span>Make again:</span>
                                  {ratingSummary.memberRatings.map((member, idx) => (
                                    <span
                                      key={idx}
                                      className={
                                        member.wouldCookAgain
                                          ? "text-green-600"
                                          : "text-red-500"
                                      }
                                    >
                                      {member.initial}:{" "}
                                      {member.wouldCookAgain ? "Yes" : "No"}
                                      {idx < ratingSummary.memberRatings!.length - 1 && ","}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      {notes.length > 0 && (
                        <span className="text-[10px] sm:text-xs bg-purple/10 text-purple px-2 py-0.5 rounded-full font-medium">
                          {notes.length} {notes.length !== 1 ? "notes" : "note"}
                        </span>
                      )}
                      {(recipe.createdBy === user?.id || userIsAdmin) && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={() => onEditRecipeClick(recipe)}
                          >
                            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeleteRecipeClick(recipe)}
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expandable Notes Section */}
                  {notes.length > 0 && (
                    <>
                      {expandedRecipeNotes.has(recipe.id) && (
                        <>
                          <Separator className="bg-purple/10" />
                          <div className="space-y-3">
                            {notes.map((note) => (
                              <div
                                key={note.id}
                                className="flex items-start gap-2 sm:gap-3 pl-2 sm:pl-3 border-l-2 border-purple/30"
                              >
                                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 ring-2 ring-purple/10">
                                  <AvatarImage src={note.userAvatar} />
                                  <AvatarFallback className="bg-purple/10 text-purple text-xs">
                                    {note.userName?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    <span className="font-medium text-sm sm:text-base">
                                      {note.userName}'s Notes
                                    </span>
                                    {note.photos && note.photos.length > 0 && (
                                      <span className="flex items-center gap-0.5 text-[10px] sm:text-xs text-muted-foreground">
                                        <Camera className="h-3 w-3" />
                                        {note.photos.length}
                                      </span>
                                    )}
                                  </div>
                                  {note.notes && (
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                      {note.notes}
                                    </p>
                                  )}
                                  {note.photos && note.photos.length > 0 && (
                                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1 -mx-1 px-1">
                                      {note.photos.map((photo, idx) => (
                                        <img
                                          key={idx}
                                          src={photo}
                                          alt=""
                                          className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg shadow-sm shrink-0"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {note.userId === user?.id && (
                                  <div className="flex gap-0.5 sm:gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 sm:h-8 sm:w-8"
                                      onClick={() => onEditNoteClick(note)}
                                    >
                                      <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 sm:h-8 sm:w-8"
                                      disabled={deletingNoteId === note.id}
                                      onClick={() => onDeleteNoteClick(note)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Toggle notes button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                        onClick={() => onToggleRecipeNotes(recipe.id)}
                      >
                        {expandedRecipeNotes.has(recipe.id) ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Hide Notes
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Show Notes ({notes.length})
                          </>
                        )}
                      </Button>
                    </>
                  )}

                  {/* Add notes button */}
                  {!hasUserNote && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-purple border-purple/30"
                      onClick={() => onAddNotesClick(recipe)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add notes
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventRecipesTab;
