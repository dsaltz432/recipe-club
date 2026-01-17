import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EventWithRecipes, Recipe } from "@/types";
import { format, parseISO } from "date-fns";
import { ExternalLink, Calendar, BookOpen } from "lucide-react";

interface AllRecipesProps {
  events: EventWithRecipes[];
  userId: string;
}

type FilterType = "all" | "mine" | "others";

const AllRecipes = ({ events, userId }: AllRecipesProps) => {
  const [filter, setFilter] = useState<FilterType>("all");

  // Flatten all recipes from all events
  const allRecipes = events.flatMap((event) =>
    event.recipes.map((recipe) => ({
      ...recipe,
      eventDate: event.eventDate,
    }))
  );

  // Filter recipes based on selection
  const filteredRecipes = allRecipes.filter((recipe) => {
    if (filter === "mine") return recipe.userId === userId;
    if (filter === "others") return recipe.userId !== userId;
    return true;
  });

  // Group by event date
  const recipesByDate = filteredRecipes.reduce((acc, recipe) => {
    const date = recipe.eventDate;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(recipe);
    return acc;
  }, {} as Record<string, (Recipe & { eventDate: string })[]>);

  // Sort dates descending (most recent first)
  const sortedDates = Object.keys(recipesByDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  if (allRecipes.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No recipes yet. Spin the wheel and lock in your first recipe!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2 justify-center">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className={filter === "all" ? "bg-purple hover:bg-purple-dark" : ""}
        >
          All ({allRecipes.length})
        </Button>
        <Button
          variant={filter === "mine" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("mine")}
          className={filter === "mine" ? "bg-purple hover:bg-purple-dark" : ""}
        >
          My Recipes ({allRecipes.filter((r) => r.userId === userId).length})
        </Button>
        <Button
          variant={filter === "others" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("others")}
          className={filter === "others" ? "bg-purple hover:bg-purple-dark" : ""}
        >
          Others' Recipes ({allRecipes.filter((r) => r.userId !== userId).length})
        </Button>
      </div>

      {/* Recipes List */}
      {filteredRecipes.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              No recipes match your filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-6 pr-4">
            {sortedDates.map((date) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    {format(parseISO(date), "MMMM d, yyyy")}
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recipesByDate[date].map((recipe) => (
                    <Card
                      key={recipe.id}
                      className="bg-white border hover:border-purple/50 transition-colors"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={recipe.userAvatar} />
                            <AvatarFallback>
                              {recipe.userName?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm text-muted-foreground truncate">
                                {recipe.userName}
                              </span>
                              {recipe.userId === userId && (
                                <span className="text-xs bg-purple/10 text-purple px-2 py-0.5 rounded-full shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="font-medium truncate" title={recipe.name}>
                              {recipe.name}
                            </p>
                            {recipe.url && (
                              <a
                                href={recipe.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-purple hover:underline flex items-center gap-1 mt-1"
                              >
                                View recipe
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {recipe.notes && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {recipe.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default AllRecipes;
