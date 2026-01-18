import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ChevronDown, ChevronUp, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Recipe, RecipeContribution } from "@/types";

interface RecipeWithContributions extends Recipe {
  contributions: RecipeContribution[];
  ingredientName?: string;
}

interface RecipeCardProps {
  recipe: RecipeWithContributions;
  userId: string;
}

const RecipeCard = ({ recipe, userId }: RecipeCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasDetails = recipe.url || recipe.contributions.length > 0;
  const uniqueContributors = [...new Set(recipe.contributions.map((c) => c.userName))];

  return (
    <Card className="bg-white/80 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Multi-avatar stack for contributors */}
          <div className="flex -space-x-2">
            {recipe.contributions.slice(0, 3).map((c) => (
              <Avatar key={c.id} className="h-8 w-8 border-2 border-white">
                <AvatarImage src={c.userAvatar} />
                <AvatarFallback>{c.userName?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            ))}
            {recipe.contributions.length > 3 && (
              <div className="h-8 w-8 rounded-full bg-purple/20 border-2 border-white flex items-center justify-center text-xs text-purple font-medium">
                +{recipe.contributions.length - 3}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {uniqueContributors.length === 1
                  ? uniqueContributors[0]
                  : `${uniqueContributors.length} people`}
              </span>
              {recipe.contributions.some((c) => c.userId === userId) && (
                <Badge variant="secondary" className="text-xs bg-purple/10 text-purple">
                  You
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {recipe.contributions[0]?.eventDate &&
                format(parseISO(recipe.contributions[0].eventDate), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <h3 className="font-display text-lg font-semibold mb-2">{recipe.name}</h3>

        {recipe.ingredientName && (
          <Badge variant="outline" className="mb-3">
            {recipe.ingredientName}
          </Badge>
        )}

        {/* Quick stats */}
        <div className="flex gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {recipe.contributions.length} contribution{recipe.contributions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Expandable Details */}
        {hasDetails && (
          <>
            {isExpanded && (
              <div className="space-y-3 mt-3 pt-3 border-t">
                {recipe.url && (
                  <a
                    href={recipe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple hover:underline flex items-center gap-1"
                  >
                    View recipe
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {/* Notes from contributors */}
                {recipe.contributions.some((c) => c.notes || (c.photos && c.photos.length > 0)) && (
                  <div className="space-y-3">
                    {recipe.contributions
                      .filter((c) => c.notes || (c.photos && c.photos.length > 0))
                      .map((contribution) => (
                        <div
                          key={contribution.id}
                          className="pl-3 border-l-2 border-purple/20 space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={contribution.userAvatar} />
                              <AvatarFallback>
                                {contribution.userName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {contribution.userName}'s Notes
                            </span>
                            {contribution.userId === userId && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-purple/10 text-purple h-4"
                              >
                                You
                              </Badge>
                            )}
                          </div>
                          {contribution.notes && (
                            <p className="text-sm text-muted-foreground">
                              {contribution.notes}
                            </p>
                          )}
                          {contribution.photos && contribution.photos.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {contribution.photos.map((photo, idx) => (
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
