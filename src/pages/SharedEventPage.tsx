import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseInstructions } from "@/lib/recipeActions";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChefHat,
  CalendarDays,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Camera,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import RecipeIngredientList from "@/components/recipes/RecipeIngredientList";
import RecipeInstructions from "@/components/cookmode/RecipeInstructions";
import RecipeTips from "@/components/recipes/RecipeTips";
import PhotoLightbox from "@/components/shared/PhotoLightbox";
import type { LightboxPhoto } from "@/components/shared/PhotoLightbox";
import CookModeDialog from "@/components/cookmode/CookModeDialog";
import { useCookMode } from "@/hooks/useCookMode";
import type { RecipeContent, RecipeIngredient } from "@/types";

interface SharedRecipe {
  id: string;
  name: string;
  url?: string;
  createdByName?: string;
  notes: Array<{
    id: string;
    userId: string;
    userName: string;
    notes?: string;
    photos?: string[];
  }>;
  content?: RecipeContent;
  ingredients: RecipeIngredient[];
}

interface SharedEvent {
  id: string;
  title?: string;
  eventDate: string;
  eventTime?: string;
  createdByName?: string;
  recipes: SharedRecipe[];
}

const SharedEventPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<SharedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showCookMode, setShowCookMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setCurrentUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!eventId) return;

    const load = async () => {
      setIsLoading(true);
      try {
        // Load event — anon users can only read if is_shared = true (enforced by RLS policy)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: eventData, error: eventError } = await (supabase as any)
          .from("scheduled_events")
          .select("id, title, event_date, event_time, profiles:created_by (name)")
          .eq("id", eventId)
          .maybeSingle();

        if (eventError || !eventData) {
          setNotFound(true);
          return;
        }

        const creator = (eventData as Record<string, unknown>).profiles as { name: string | null } | null;

        // Load meal_plan_items to find linked recipes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mealItems } = await (supabase as any)
          .from("meal_plan_items")
          .select("recipe_id")
          .or(`event_id.eq.${eventId}`);

        const linkedRecipeIds: string[] = (mealItems ?? [])
          .map((m: Record<string, unknown>) => m.recipe_id as string)
          .filter(Boolean);

        let orFilter = `event_id.eq.${eventId}`;
        if (linkedRecipeIds.length > 0) {
          orFilter += `,id.in.(${linkedRecipeIds.join(",")})`;
        }

        // Load recipes
        const { data: recipesData, error: recipesError } = await supabase
          .from("recipes")
          .select("id, name, url, profiles:created_by (name)")
          .or(orFilter)
          .order("created_at", { ascending: true });

        if (recipesError) throw recipesError;

        const recipeIds = (recipesData ?? []).map((r) => r.id);

        // Load notes, content, and ingredients in parallel
        const [notesResult, contentResult, ingredientsResult] = await Promise.all([
          recipeIds.length > 0
            ? supabase
                .from("recipe_notes")
                .select("id, recipe_id, user_id, notes, photos, profiles:user_id (name)")
                .in("recipe_id", recipeIds)
            : Promise.resolve({ data: [] }),
          recipeIds.length > 0
            ? supabase
                .from("recipe_content")
                .select("*")
                .in("recipe_id", recipeIds)
            : Promise.resolve({ data: [] }),
          recipeIds.length > 0
            ? supabase
                .from("recipe_ingredients")
                .select("*")
                .in("recipe_id", recipeIds)
            : Promise.resolve({ data: [] }),
        ]);

        // Build content map
        const contentMap = new Map<string, RecipeContent>();
        for (const row of (contentResult.data ?? [])) {
          contentMap.set(row.recipe_id, {
            id: row.id,
            recipeId: row.recipe_id,
            description: row.description ?? undefined,
            servings: row.servings ?? undefined,
            prepTime: row.prep_time ?? undefined,
            cookTime: row.cook_time ?? undefined,
            totalTime: row.total_time ?? undefined,
            instructions: parseInstructions(row.instructions),
            sourceTitle: row.source_title ?? undefined,
            parsedAt: row.parsed_at ?? undefined,
            status: row.status as RecipeContent["status"],
            errorMessage: row.error_message ?? undefined,
            createdAt: row.created_at ?? undefined,
          });
        }

        // Build ingredients map
        const ingredientsMap = new Map<string, RecipeIngredient[]>();
        for (const row of (ingredientsResult.data ?? [])) {
          if (!ingredientsMap.has(row.recipe_id)) ingredientsMap.set(row.recipe_id, []);
          ingredientsMap.get(row.recipe_id)!.push({
            id: row.id,
            recipeId: row.recipe_id,
            name: row.name,
            quantity: row.quantity ?? undefined,
            unit: row.unit ?? undefined,
            category: row.category as RecipeIngredient["category"],
            rawText: row.raw_text ?? undefined,
            sortOrder: row.sort_order ?? undefined,
            createdAt: row.created_at ?? undefined,
          });
        }

        // Build notes map
        const notesMap = new Map<string, SharedRecipe["notes"]>();
        for (const note of (notesResult.data ?? [])) {
          const n = note as typeof note & { profiles: { name: string | null } | null };
          if (!notesMap.has(note.recipe_id)) notesMap.set(note.recipe_id, []);
          notesMap.get(note.recipe_id)!.push({
            id: note.id,
            userId: note.user_id,
            userName: n.profiles?.name ?? "Someone",
            notes: note.notes ?? undefined,
            photos: (note.photos as string[] | null) ?? undefined,
          });
        }

        const recipes: SharedRecipe[] = (recipesData ?? []).map((r) => {
          const rCreator = r.profiles as { name: string | null } | null;
          return {
            id: r.id,
            name: r.name,
            url: r.url ?? undefined,
            createdByName: rCreator?.name ?? undefined,
            notes: notesMap.get(r.id) ?? [],
            content: contentMap.get(r.id),
            ingredients: ingredientsMap.get(r.id) ?? [],
          };
        });

        const ed = eventData as Record<string, unknown>;
        setEvent({
          id: ed.id as string,
          title: (ed.title as string | null) ?? undefined,
          eventDate: ed.event_date as string,
          eventTime: (ed.event_time as string | null) ?? undefined,
          createdByName: creator?.name ?? undefined,
          recipes,
        });
      } catch (err) {
        console.error("Error loading shared event:", err);
        toast.error("Failed to load event");
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [eventId]);

  const toggleRecipe = (recipeId: string) => {
    setExpandedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) { next.delete(recipeId); } else { next.add(recipeId); }
      return next;
    });
  };

  const toggleNotes = (recipeId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) { next.delete(recipeId); } else { next.add(recipeId); }
      return next;
    });
  };

  const openLightbox = (photos: string[], index: number) => {
    setLightboxPhotos(photos.map((src) => ({ src, alt: "Recipe photo" })));
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Cook mode setup
  const cookModeRecipes = useMemo(
    () =>
      (event?.recipes ?? [])
        .filter((r) => r.content?.instructions && r.content.instructions.length > 0)
        .map((r) => ({
          id: r.id,
          name: r.name,
          instructions: r.content!.instructions,
        })),
    [event?.recipes]
  );

  const cookMode = useCookMode({
    eventId: event?.id,
    recipes: cookModeRecipes,
  });

  const handleStartCookMode = async () => {
    setShowCookMode(true);
    if (cookMode.timeline.length === 0) {
      await cookMode.generateTimeline();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50/30 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50/30 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <ChefHat className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold">Event not found</h1>
          <p className="text-muted-foreground text-sm">
            This event may not exist or hasn't been shared publicly.
          </p>
          <Link to="/">
            <Button variant="outline">Go to Recipe Club</Button>
          </Link>
        </div>
      </div>
    );
  }

  const formattedDate = (() => {
    try {
      return format(parseISO(event.eventDate), "EEEE, MMMM d, yyyy");
    } catch {
      return event.eventDate;
    }
  })();

  const hasCookableRecipes = cookModeRecipes.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50/30">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
            <ChefHat className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-purple-700 text-sm">Recipe Club Hub</span>
          {!currentUserId && (
            <Link to="/" className="ml-auto">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7 px-3">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Event header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {event.title ?? "Shared Meal"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-purple-500" />
              {formattedDate}
              {event.eventTime && ` at ${event.eventTime.slice(0, 5)}`}
            </span>
            {event.createdByName && (
              <span className="flex items-center gap-1.5">
                <span>by {event.createdByName}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4 text-purple-500" />
            <span>{event.recipes.length} {event.recipes.length === 1 ? "recipe" : "recipes"}</span>
          </div>
        </div>

        {/* Cook mode button */}
        {hasCookableRecipes && (
          <Button
            onClick={handleStartCookMode}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white gap-2"
          >
            <UtensilsCrossed className="h-4 w-4" />
            Cook Mode
          </Button>
        )}

        {/* Recipes */}
        {event.recipes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 flex flex-col items-center text-center gap-2">
              <ChefHat className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No recipes in this event yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {event.recipes.map((recipe) => {
              const recipeExpanded = expandedRecipes.has(recipe.id);
              const notesExpanded = expandedNotes.has(recipe.id);
              const totalPhotos = recipe.notes.reduce(
                (sum, n) => sum + (n.photos?.length ?? 0),
                0
              );
              const hasIngredients = recipe.ingredients.length > 0;
              const hasInstructions =
                recipe.content?.instructions && recipe.content.instructions.length > 0;

              return (
                <Card key={recipe.id} className="bg-white/90 border border-purple-100 shadow-sm">
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* Recipe header — clickable to expand/collapse */}
                    <button
                      className="w-full flex items-start justify-between gap-2 text-left"
                      onClick={() => toggleRecipe(recipe.id)}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        {recipeExpanded ? (
                          <ChevronUp className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <h2 className="font-semibold text-base sm:text-lg text-gray-900 leading-tight">
                            {recipe.name}
                          </h2>
                          {recipe.createdByName && (
                            <p className="text-xs text-muted-foreground">
                              Added by {recipe.createdByName}
                            </p>
                          )}
                        </div>
                      </div>
                      {recipe.url && (
                        <a
                          href={recipe.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                            <ExternalLink className="h-3 w-3" />
                            Recipe link
                          </Button>
                        </a>
                      )}
                    </button>

                    {recipeExpanded && (
                      <div className="space-y-4">
                        {/* Meta: servings, times */}
                        {recipe.content && (
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {recipe.content.servings && (
                              <span>Serves {recipe.content.servings}</span>
                            )}
                            {recipe.content.prepTime && (
                              <span>Prep {recipe.content.prepTime}</span>
                            )}
                            {recipe.content.cookTime && (
                              <span>Cook {recipe.content.cookTime}</span>
                            )}
                            {recipe.content.totalTime && (
                              <span>Total {recipe.content.totalTime}</span>
                            )}
                          </div>
                        )}

                        {/* Ingredients */}
                        {hasIngredients && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Ingredients</h3>
                            <RecipeIngredientList
                              recipeId={recipe.id}
                              userId={currentUserId ?? ""}
                              editable={false}
                            />
                          </div>
                        )}

                        {/* Instructions */}
                        {hasInstructions && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Instructions</h3>
                            <RecipeInstructions
                              instructions={recipe.content!.instructions}
                              servings={recipe.content!.servings}
                              prepTime={recipe.content!.prepTime}
                              cookTime={recipe.content!.cookTime}
                              totalTime={recipe.content!.totalTime}
                            />
                          </div>
                        )}

                        {/* Tips */}
                        <RecipeTips recipeId={recipe.id} userId={currentUserId ?? undefined} />

                        {/* Notes toggle */}
                        {recipe.notes.length > 0 && (
                          <div>
                            <button
                              className="flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-800"
                              onClick={() => toggleNotes(recipe.id)}
                            >
                              {notesExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              Notes & Photos
                              {totalPhotos > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-normal">
                                  <Camera className="h-3 w-3" />
                                  {totalPhotos}
                                </span>
                              )}
                            </button>

                            {notesExpanded && (
                              <div className="mt-3 space-y-3">
                                {recipe.notes.map((note) => (
                                  <div
                                    key={note.id}
                                    className="rounded-lg bg-purple-50/50 border border-purple-100 p-3 space-y-2"
                                  >
                                    <p className="text-xs font-medium text-purple-700">
                                      {note.userName}
                                    </p>
                                    {note.notes && (
                                      <p className="text-sm text-gray-700">{note.notes}</p>
                                    )}
                                    {note.photos && note.photos.length > 0 && (
                                      <div className="flex gap-2 overflow-x-auto pb-1">
                                        {note.photos.map((photo, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() => openLightbox(note.photos!, idx)}
                                            className="shrink-0"
                                            aria-label={`View photo ${idx + 1}`}
                                          >
                                            <img
                                              src={photo}
                                              alt={`Photo ${idx + 1}`}
                                              className="h-20 w-20 object-cover rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                                            />
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs gap-1.5">
              <ChefHat className="h-3.5 w-3.5" />
              Powered by Recipe Club Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* Photo lightbox */}
      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Cook mode */}
      <CookModeDialog
        open={showCookMode}
        onClose={() => setShowCookMode(false)}
        steps={cookMode.timeline}
        recipeNames={new Map(event.recipes.map((r) => [r.id, r.name]))}
        loading={cookMode.loading}
        error={cookMode.error ?? undefined}
        ingredientsByRecipe={cookMode.ingredientsByRecipe}
        userId={currentUserId ?? undefined}
      />
    </div>
  );
};

export default SharedEventPage;
