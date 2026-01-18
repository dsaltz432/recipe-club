# Ingredient Reuse, Recipe Contributions & Ratings Proposal

## Overview

This document outlines three major architectural changes to Recipe Club:

1. **Recipe Contributions** (Part 1) - Separate recipe definitions (name + URL) from user contributions (notes + photos), allowing multiple club members to add their own notes/photos to the same recipe.

2. **Recipe Ratings** (Part 1B) - During event completion, prompt club members to rate each recipe with two metrics: "would cook again" (yes/no) and overall rating (1-5 stars).

3. **Ingredient Reuse** (Part 2) - Allow ingredients to be used multiple times, tracking usage count instead of a boolean "used" flag. Usage count increments only when events are completed.

---

## Part 1: Recipe Contributions Architecture

### Current State

Currently, the `recipes` table stores everything together:
- `name`, `url` (the recipe itself)
- `notes`, `photos` (user's contribution)
- `user_id`, `event_date`, `ingredient_id` (context)

This means if two people make the same recipe, they create duplicate entries with the same name/URL.

### New Architecture

Split into two tables:

#### `recipes` table (canonical recipe definitions)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Recipe name (e.g., "Chicken Piccata") |
| `url` | text | Recipe URL (nullable for custom recipes) |
| `created_by` | uuid | FK to profiles - who first added it |
| `created_at` | timestamptz | When first added |

#### `recipe_contributions` table (user submissions)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `recipe_id` | uuid | FK to recipes |
| `user_id` | uuid | FK to profiles - who made this contribution |
| `event_id` | uuid | FK to scheduled_events (replaces event_date) |
| `notes` | text | User's notes/variations |
| `photos` | text[] | User's photos |
| `created_at` | timestamptz | When submitted |

### Benefits

1. **Reusable recipes** - If Sarah makes "Chicken Piccata" for Capers event and later for Lemon event, it's the same recipe with two contributions
2. **Multiple contributors** - If both Sarah and Hannah make "Chicken Piccata", each has their own notes/photos but it's recognized as the same recipe
3. **Recipe history** - Can see all times a recipe has been made across events
4. **Cleaner data** - No duplicate name/URL entries

### Database Migration for Recipes

```sql
-- Part 1: Create new tables

-- Create recipes table (canonical recipe definitions)
CREATE TABLE recipes_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, url) -- Prevent exact duplicates
);

-- Create recipe_contributions table
CREATE TABLE recipe_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes_new(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  event_id UUID REFERENCES scheduled_events(id) ON DELETE CASCADE,
  notes TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each user can only have one contribution per recipe per event
  UNIQUE(recipe_id, user_id, event_id)
);

-- Create indexes for common queries
CREATE INDEX idx_recipe_contributions_recipe ON recipe_contributions(recipe_id);
CREATE INDEX idx_recipe_contributions_user ON recipe_contributions(user_id);
CREATE INDEX idx_recipe_contributions_event ON recipe_contributions(event_id);

-- Part 2: Migrate existing data

-- Insert unique recipes
INSERT INTO recipes_new (name, url, created_by, created_at)
SELECT DISTINCT ON (name, COALESCE(url, ''))
  name,
  url,
  user_id as created_by,
  created_at
FROM recipes
ORDER BY name, COALESCE(url, ''), created_at ASC;

-- Insert contributions (need to map old event_date to event_id)
INSERT INTO recipe_contributions (recipe_id, user_id, event_id, notes, photos, created_at)
SELECT
  rn.id as recipe_id,
  r.user_id,
  se.id as event_id,
  r.notes,
  r.photos,
  r.created_at
FROM recipes r
JOIN recipes_new rn ON rn.name = r.name AND COALESCE(rn.url, '') = COALESCE(r.url, '')
JOIN scheduled_events se ON se.event_date = r.event_date AND se.ingredient_id = r.ingredient_id;

-- Part 3: Swap tables
DROP TABLE recipes;
ALTER TABLE recipes_new RENAME TO recipes;

-- Part 4: Set up RLS policies for new tables
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_contributions ENABLE ROW LEVEL SECURITY;

-- Recipes: anyone can view, authenticated can insert
CREATE POLICY "Anyone can view recipes" ON recipes
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert recipes" ON recipes
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own recipes or admins can update any" ON recipes
FOR UPDATE USING (created_by = auth.uid() OR current_user_is_admin());

-- Contributions: anyone can view, users manage their own
CREATE POLICY "Anyone can view contributions" ON recipe_contributions
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert contributions" ON recipe_contributions
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own contributions" ON recipe_contributions
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own contributions or admins can delete any" ON recipe_contributions
FOR DELETE USING (user_id = auth.uid() OR current_user_is_admin());
```

### Updated TypeScript Types

```typescript
// src/types/index.ts

export interface Recipe {
  id: string;
  name: string;
  url?: string;
  createdBy?: string;
  createdAt?: string;
  // Aggregated data (populated by joins)
  contributionCount?: number;
  contributors?: string[];
}

export interface RecipeContribution {
  id: string;
  recipeId: string;
  userId: string;
  eventId: string;
  notes?: string;
  photos?: string[];
  createdAt?: string;
  // Joined data
  userName?: string;
  userAvatar?: string;
  recipeName?: string;
  recipeUrl?: string;
  eventDate?: string;
  ingredientName?: string;
}

// For displaying in event details
export interface EventRecipeWithContributions {
  recipe: Recipe;
  contributions: RecipeContribution[];
}
```

### Updated Supabase Types

```typescript
// src/integrations/supabase/types.ts

recipes: {
  Row: {
    id: string;
    name: string;
    url: string | null;
    created_by: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    name: string;
    url?: string | null;
    created_by?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    name?: string;
    url?: string | null;
    created_by?: string | null;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "recipes_created_by_fkey";
      columns: ["created_by"];
      referencedRelation: "profiles";
      referencedColumns: ["id"];
    }
  ];
};

recipe_contributions: {
  Row: {
    id: string;
    recipe_id: string;
    user_id: string | null;
    event_id: string | null;
    notes: string | null;
    photos: string[] | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    recipe_id: string;
    user_id?: string | null;
    event_id?: string | null;
    notes?: string | null;
    photos?: string[] | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    recipe_id?: string;
    user_id?: string | null;
    event_id?: string | null;
    notes?: string | null;
    photos?: string[] | null;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "recipe_contributions_recipe_id_fkey";
      columns: ["recipe_id"];
      referencedRelation: "recipes";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "recipe_contributions_user_id_fkey";
      columns: ["user_id"];
      referencedRelation: "profiles";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "recipe_contributions_event_id_fkey";
      columns: ["event_id"];
      referencedRelation: "scheduled_events";
      referencedColumns: ["id"];
    }
  ];
};
```

### Code Changes for Recipe Contributions

#### RecipeClubEvents Component Updates

The event details dialog needs significant changes to support the new model:

**Loading recipes for an event:**
```typescript
// Fetch recipes with their contributions for an event
const loadEventRecipes = async (eventId: string) => {
  // Get all contributions for this event with recipe and user details
  const { data, error } = await supabase
    .from("recipe_contributions")
    .select(`
      *,
      recipes (*),
      profiles (name, avatar_url)
    `)
    .eq("event_id", eventId);

  if (error) throw error;

  // Group by recipe
  const recipeMap = new Map<string, EventRecipeWithContributions>();

  data?.forEach((contribution) => {
    const recipeId = contribution.recipe_id;
    if (!recipeMap.has(recipeId)) {
      recipeMap.set(recipeId, {
        recipe: {
          id: contribution.recipes.id,
          name: contribution.recipes.name,
          url: contribution.recipes.url,
          createdBy: contribution.recipes.created_by,
        },
        contributions: [],
      });
    }

    recipeMap.get(recipeId)!.contributions.push({
      id: contribution.id,
      recipeId: contribution.recipe_id,
      userId: contribution.user_id,
      eventId: contribution.event_id,
      notes: contribution.notes,
      photos: contribution.photos,
      userName: contribution.profiles?.name,
      userAvatar: contribution.profiles?.avatar_url,
    });
  });

  return Array.from(recipeMap.values());
};
```

**Adding a recipe with contribution:**
```typescript
const handleSubmitRecipe = async () => {
  if (!recipeName.trim()) {
    toast.error("Please enter a recipe name");
    return;
  }

  setIsSubmitting(true);
  try {
    // Step 1: Check if recipe already exists (by name + url)
    let recipeId: string;

    const { data: existingRecipe } = await supabase
      .from("recipes")
      .select("id")
      .eq("name", recipeName.trim())
      .eq("url", recipeUrl.trim() || null)
      .single();

    if (existingRecipe) {
      recipeId = existingRecipe.id;
    } else {
      // Create new recipe
      const { data: newRecipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          name: recipeName.trim(),
          url: recipeUrl.trim() || null,
          created_by: userId,
        })
        .select("id")
        .single();

      if (recipeError) throw recipeError;
      recipeId = newRecipe.id;
    }

    // Step 2: Create contribution
    const { error: contributionError } = await supabase
      .from("recipe_contributions")
      .insert({
        recipe_id: recipeId,
        user_id: userId,
        event_id: event.eventId,
        notes: notes.trim() || null,
        photos: photos.length > 0 ? photos : null,
      });

    if (contributionError) throw contributionError;

    toast.success("Recipe added!");
    // ... reset form ...
    onRecipesChanged?.();
  } catch (error) {
    console.error("Error saving recipe:", error);
    toast.error("Failed to save recipe");
  } finally {
    setIsSubmitting(false);
  }
};
```

**Recipe autocomplete when adding:**
```tsx
// When adding a recipe, show existing recipes as suggestions
const RecipeAutocomplete = ({ value, onChange, onSelect }) => {
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    const searchRecipes = async () => {
      const { data } = await supabase
        .from("recipes")
        .select("id, name, url")
        .ilike("name", `%${value}%`)
        .limit(10);

      setSuggestions(data || []);
    };

    const debounce = setTimeout(searchRecipes, 300);
    return () => clearTimeout(debounce);
  }, [value]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="Recipe name..."
      />

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          {suggestions.map((recipe) => (
            <button
              key={recipe.id}
              className="w-full px-3 py-2 text-left hover:bg-gray-50"
              onClick={() => {
                onSelect(recipe);
                setIsOpen(false);
              }}
            >
              <div className="font-medium">{recipe.name}</div>
              {recipe.url && (
                <div className="text-xs text-muted-foreground truncate">
                  {recipe.url}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Updated event card display:**
```tsx
// Group recipes and show contributions under each
{eventRecipes.map(({ recipe, contributions }) => (
  <div key={recipe.id} className="p-4 rounded-lg bg-gray-50 space-y-3">
    {/* Recipe header */}
    <div className="flex items-start justify-between">
      <div>
        <h4 className="font-semibold">{recipe.name}</h4>
        {recipe.url && (
          <a
            href={recipe.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple hover:underline flex items-center gap-1"
          >
            View recipe <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {contributions.length} contribution{contributions.length !== 1 ? "s" : ""}
      </span>
    </div>

    {/* Contributions */}
    <div className="space-y-2 pl-4 border-l-2 border-purple/20">
      {contributions.map((contribution) => (
        <div key={contribution.id} className="flex items-start gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={contribution.userAvatar} />
            <AvatarFallback>{contribution.userName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{contribution.userName}</span>
              {contribution.userId === userId && (
                <span className="text-xs bg-purple/10 text-purple px-1.5 py-0.5 rounded">You</span>
              )}
            </div>
            {contribution.notes && (
              <p className="text-sm text-muted-foreground mt-1">{contribution.notes}</p>
            )}
            {contribution.photos && contribution.photos.length > 0 && (
              <div className="flex gap-1 mt-2">
                {contribution.photos.map((photo, idx) => (
                  <img
                    key={idx}
                    src={photo}
                    alt=""
                    className="h-16 w-16 object-cover rounded"
                  />
                ))}
              </div>
            )}
          </div>
          {contribution.userId === userId && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>

    {/* Add your contribution button (if user hasn't contributed to this recipe) */}
    {!contributions.some((c) => c.userId === userId) && (
      <Button
        variant="outline"
        size="sm"
        className="text-purple border-purple/30"
        onClick={() => openAddContributionDialog(recipe)}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add your notes/photos
      </Button>
    )}
  </div>
))}
```

---

## Part 1B: Recipe Ratings

### Overview

When an event is completed, each club member should be prompted to rate the recipes from that event. This provides valuable feedback and helps identify favorite recipes over time.

### Rating Scales

Each rating includes two components:
1. **Would cook again** (boolean) - "Would you make this recipe again?"
2. **Overall rating** (1-5) - Star rating for the recipe

### Database Schema

#### `recipe_ratings` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `recipe_id` | uuid | FK to recipes |
| `user_id` | uuid | FK to profiles - who rated |
| `event_id` | uuid | FK to scheduled_events - which event context |
| `would_cook_again` | boolean | Would make this recipe again |
| `overall_rating` | integer | 1-5 star rating |
| `created_at` | timestamptz | When rated |

**Constraints:**
- Each user can only rate a recipe once per event
- `overall_rating` must be between 1 and 5

### Database Migration for Ratings

```sql
-- Create recipe_ratings table
CREATE TABLE recipe_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID NOT NULL REFERENCES scheduled_events(id) ON DELETE CASCADE,
  would_cook_again BOOLEAN NOT NULL,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each user can only rate a recipe once per event
  UNIQUE(recipe_id, user_id, event_id)
);

-- Create indexes
CREATE INDEX idx_recipe_ratings_recipe ON recipe_ratings(recipe_id);
CREATE INDEX idx_recipe_ratings_user ON recipe_ratings(user_id);
CREATE INDEX idx_recipe_ratings_event ON recipe_ratings(event_id);

-- RLS policies
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings" ON recipe_ratings
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert ratings" ON recipe_ratings
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON recipe_ratings
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON recipe_ratings
FOR DELETE USING (auth.uid() = user_id);
```

### TypeScript Types

```typescript
// src/types/index.ts

export interface RecipeRating {
  id: string;
  recipeId: string;
  userId: string;
  eventId: string;
  wouldCookAgain: boolean;
  overallRating: number; // 1-5
  createdAt?: string;
  // Joined data
  userName?: string;
  recipeName?: string;
}

// Aggregated rating data for display
export interface RecipeRatingsSummary {
  recipeId: string;
  averageRating: number;
  wouldCookAgainPercent: number;
  totalRatings: number;
}
```

### Supabase Types

```typescript
// src/integrations/supabase/types.ts

recipe_ratings: {
  Row: {
    id: string;
    recipe_id: string;
    user_id: string;
    event_id: string;
    would_cook_again: boolean;
    overall_rating: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    recipe_id: string;
    user_id: string;
    event_id: string;
    would_cook_again: boolean;
    overall_rating: number;
    created_at?: string;
  };
  Update: {
    id?: string;
    recipe_id?: string;
    user_id?: string;
    event_id?: string;
    would_cook_again?: boolean;
    overall_rating?: number;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "recipe_ratings_recipe_id_fkey";
      columns: ["recipe_id"];
      referencedRelation: "recipes";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "recipe_ratings_user_id_fkey";
      columns: ["user_id"];
      referencedRelation: "profiles";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "recipe_ratings_event_id_fkey";
      columns: ["event_id"];
      referencedRelation: "scheduled_events";
      referencedColumns: ["id"];
    }
  ];
};
```

### Event Completion Flow

When an admin clicks "Complete Event", instead of immediately marking the event as completed:

1. **Show rating dialog** - Modal prompts all club members to rate recipes
2. **List all recipes** from the event with rating inputs
3. **Allow skipping** - Users can skip rating if they didn't try a recipe
4. **Submit ratings** - Save all ratings
5. **Complete event** - Mark event as completed after ratings submitted

#### Rating Dialog Component

```tsx
interface RatingDialogProps {
  event: ScheduledEvent;
  recipes: EventRecipeWithContributions[];
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const EventRatingDialog = ({ event, recipes, userId, onComplete, onCancel }: RatingDialogProps) => {
  const [ratings, setRatings] = useState<Map<string, { wouldCookAgain: boolean | null; rating: number | null }>>(
    new Map()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRatingChange = (recipeId: string, field: 'wouldCookAgain' | 'rating', value: boolean | number) => {
    setRatings((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(recipeId) || { wouldCookAgain: null, rating: null };
      newMap.set(recipeId, { ...current, [field]: value });
      return newMap;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Insert ratings for recipes that were rated
      const ratingsToInsert = Array.from(ratings.entries())
        .filter(([_, r]) => r.wouldCookAgain !== null && r.rating !== null)
        .map(([recipeId, r]) => ({
          recipe_id: recipeId,
          user_id: userId,
          event_id: event.id,
          would_cook_again: r.wouldCookAgain,
          overall_rating: r.rating,
        }));

      if (ratingsToInsert.length > 0) {
        const { error } = await supabase
          .from("recipe_ratings")
          .insert(ratingsToInsert);
        if (error) throw error;
      }

      onComplete();
    } catch (error) {
      console.error("Error submitting ratings:", error);
      toast.error("Failed to submit ratings");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rate the Recipes</DialogTitle>
          <DialogDescription>
            How did you like the recipes from this event? Your ratings help everyone discover great recipes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {recipes.map(({ recipe }) => (
            <div key={recipe.id} className="p-4 border rounded-lg space-y-4">
              <div>
                <h4 className="font-semibold">{recipe.name}</h4>
                {recipe.url && (
                  <a href={recipe.url} target="_blank" className="text-sm text-purple hover:underline">
                    View recipe
                  </a>
                )}
              </div>

              {/* Would cook again */}
              <div className="flex items-center gap-4">
                <span className="text-sm">Would you make this again?</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={ratings.get(recipe.id)?.wouldCookAgain === true ? "default" : "outline"}
                    onClick={() => handleRatingChange(recipe.id, 'wouldCookAgain', true)}
                    className={ratings.get(recipe.id)?.wouldCookAgain === true ? "bg-green-500" : ""}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" /> Yes
                  </Button>
                  <Button
                    size="sm"
                    variant={ratings.get(recipe.id)?.wouldCookAgain === false ? "default" : "outline"}
                    onClick={() => handleRatingChange(recipe.id, 'wouldCookAgain', false)}
                    className={ratings.get(recipe.id)?.wouldCookAgain === false ? "bg-red-500" : ""}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" /> No
                  </Button>
                </div>
              </div>

              {/* Star rating */}
              <div className="flex items-center gap-4">
                <span className="text-sm">Overall rating:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRatingChange(recipe.id, 'rating', star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          (ratings.get(recipe.id)?.rating || 0) >= star
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Skip Ratings
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-purple hover:bg-purple-dark">
            {isSubmitting ? "Submitting..." : "Submit Ratings & Complete Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### Displaying Ratings

#### On Recipe Cards (aggregated)

```tsx
const RecipeRatingDisplay = ({ recipeId }: { recipeId: string }) => {
  const [summary, setSummary] = useState<RecipeRatingsSummary | null>(null);

  useEffect(() => {
    const loadRatings = async () => {
      const { data } = await supabase
        .from("recipe_ratings")
        .select("overall_rating, would_cook_again")
        .eq("recipe_id", recipeId);

      if (data && data.length > 0) {
        const avgRating = data.reduce((sum, r) => sum + r.overall_rating, 0) / data.length;
        const wouldCookAgainCount = data.filter((r) => r.would_cook_again).length;
        setSummary({
          recipeId,
          averageRating: Math.round(avgRating * 10) / 10,
          wouldCookAgainPercent: Math.round((wouldCookAgainCount / data.length) * 100),
          totalRatings: data.length,
        });
      }
    };
    loadRatings();
  }, [recipeId]);

  if (!summary) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span>{summary.averageRating}</span>
        <span className="text-muted-foreground">({summary.totalRatings})</span>
      </div>
      <div className="flex items-center gap-1 text-green-600">
        <ThumbsUp className="h-4 w-4" />
        <span>{summary.wouldCookAgainPercent}%</span>
      </div>
    </div>
  );
};
```

#### In Event Details (individual ratings)

Show each user's rating for the recipe in the event context.

---

## Part 2: Ingredient Reuse

### Database Changes

### Schema Migration

Run this SQL in the Supabase SQL Editor:

```sql
-- Migration: Change ingredients from boolean is_used to integer used_count
-- and rename used_date to last_used_date

-- Step 1: Add new columns
ALTER TABLE ingredients
ADD COLUMN used_count INTEGER DEFAULT 0,
ADD COLUMN last_used_date TIMESTAMPTZ;

-- Step 2: Migrate existing data
UPDATE ingredients
SET
  used_count = CASE WHEN is_used = true THEN 1 ELSE 0 END,
  last_used_date = used_date;

-- Step 3: Rename used_by to last_used_by for clarity
ALTER TABLE ingredients RENAME COLUMN used_by TO last_used_by;

-- Step 4: Drop old columns
ALTER TABLE ingredients DROP COLUMN is_used;
ALTER TABLE ingredients DROP COLUMN used_date;

-- Step 5: Add NOT NULL constraint now that data is migrated
ALTER TABLE ingredients ALTER COLUMN used_count SET NOT NULL;
```

### Updated Backfill Script

The historical recipe data is stored in [`scripts/backfill-history.sql`](../scripts/backfill-history.sql). This script needs to be updated to work with the new schema.

**Current data in backfill script:**
- 14 unique ingredients (Almond, Pickle, Soy Sauce, Potato, Soup, Pie, Broccoli, Capers, Kale, Lemon, Tofu, Cornmeal, Beef, Cucumber)
- 14 events spanning 2023-06-18 to 2026-01-12
- 27 recipe entries from Sarah and Hannah

**Changes needed to backfill script:**

The script should be updated to:
1. Use `used_count` and `last_used_date` instead of `is_used` and `used_date`
2. Set `in_bank: false` for historical ingredients (they can be re-added later)
3. Insert into the new `recipes` table (canonical definitions)
4. Insert into `recipe_contributions` table (user submissions)

**Updated backfill script structure:**

```sql
-- Recipe Club History Backfill Script
-- Updated for: used_count on ingredients, recipes + recipe_contributions split
-- Run this in the Supabase SQL Editor AFTER running all migrations

-- Uses historical data from scripts/backfill-history.sql
-- Temp table structure updated:
CREATE TEMP TABLE history_data (
  event_date DATE,
  theme TEXT,
  participant TEXT,
  recipe_url TEXT,
  recipe_name TEXT  -- renamed from recipe_notes for clarity
);

-- INSERT historical data here (see scripts/backfill-history.sql for full data)
-- ...

-- Calculate used_count per ingredient
CREATE TEMP TABLE ingredient_usage AS
SELECT
  theme,
  COUNT(DISTINCT event_date) as used_count,
  MAX(event_date) as last_used_date
FROM history_data
GROUP BY theme;

-- 1. INSERT INGREDIENTS (with used_count, in_bank=false for historical)
INSERT INTO ingredients (name, used_count, last_used_date, in_bank)
SELECT
  iu.theme,
  iu.used_count,
  iu.last_used_date,
  false  -- Historical ingredients not in active bank
FROM ingredient_usage iu
WHERE NOT EXISTS (
  SELECT 1 FROM ingredients WHERE ingredients.name = iu.theme
)
ON CONFLICT DO NOTHING;

-- 2. INSERT SCHEDULED EVENTS (completed status)
INSERT INTO scheduled_events (event_date, ingredient_id, status)
SELECT DISTINCT
  h.event_date,
  i.id as ingredient_id,
  'completed' as status
FROM history_data h
JOIN ingredients i ON i.name = h.theme
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_events se
  WHERE se.event_date = h.event_date AND se.ingredient_id = i.id
);

-- 3. INSERT RECIPES (canonical recipe definitions - deduplicated)
INSERT INTO recipes (name, url, created_by, created_at)
SELECT DISTINCT ON (h.recipe_name, COALESCE(h.recipe_url, ''))
  h.recipe_name as name,
  h.recipe_url as url,
  u.user_id as created_by,
  h.event_date as created_at
FROM history_data h
LEFT JOIN user_mapping u ON u.participant = h.participant
ORDER BY h.recipe_name, COALESCE(h.recipe_url, ''), h.event_date ASC
ON CONFLICT (name, url) DO NOTHING;

-- 4. INSERT RECIPE CONTRIBUTIONS (link recipes to events/users)
INSERT INTO recipe_contributions (recipe_id, user_id, event_id, notes, created_at)
SELECT
  r.id as recipe_id,
  u.user_id,
  se.id as event_id,
  CASE WHEN h.recipe_url IS NULL THEN h.recipe_name ELSE NULL END as notes,
  h.event_date as created_at
FROM history_data h
LEFT JOIN user_mapping u ON u.participant = h.participant
JOIN recipes r ON r.name = h.recipe_name
  AND COALESCE(r.url, '') = COALESCE(h.recipe_url, '')
JOIN ingredients i ON i.name = h.theme
JOIN scheduled_events se ON se.event_date = h.event_date
  AND se.ingredient_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_contributions rc
  WHERE rc.recipe_id = r.id AND rc.event_id = se.id
  AND (rc.user_id = u.user_id OR (rc.user_id IS NULL AND u.user_id IS NULL))
);

-- 5. SUMMARY
SELECT 'Ingredients' as entity, COUNT(*) as count FROM ingredients
UNION ALL SELECT 'Events', COUNT(*) FROM scheduled_events
UNION ALL SELECT 'Recipes', COUNT(*) FROM recipes
UNION ALL SELECT 'Contributions', COUNT(*) FROM recipe_contributions;
```

> **Note:** The full backfill script with all historical data should be updated in `scripts/backfill-history.sql` when implementing this proposal.

---

## Code Changes

### 1. TypeScript Types

#### `src/types/index.ts`

```typescript
// BEFORE
export interface Ingredient {
  id: string;
  name: string;
  isUsed: boolean;
  usedBy?: string;
  usedDate?: string;
  createdBy?: string;
}

// AFTER
export interface Ingredient {
  id: string;
  name: string;
  usedCount: number;
  lastUsedBy?: string;
  lastUsedDate?: string;
  createdBy?: string;
  inBank: boolean; // Whether this ingredient is in the active bank
}
```

#### `src/integrations/supabase/types.ts`

Update the `ingredients` table definition:

```typescript
// BEFORE
ingredients: {
  Row: {
    id: string;
    name: string;
    is_used: boolean;
    used_by: string | null;
    used_date: string | null;
    created_by: string | null;
    created_at: string;
  };
  // ... Insert and Update types similar
}

// AFTER
ingredients: {
  Row: {
    id: string;
    name: string;
    used_count: number;
    last_used_by: string | null;
    last_used_date: string | null;
    created_by: string | null;
    created_at: string;
    in_bank: boolean;
  };
  // ... Insert and Update types similar
}
```

> **Note:** We add an `in_bank` boolean column to track whether an ingredient is currently in the wheel's ingredient bank. This separates "historical ingredients" from "active ingredients".

**Additional migration for `in_bank`:**
```sql
ALTER TABLE ingredients ADD COLUMN in_bank BOOLEAN DEFAULT true;
```

---

### 2. IngredientBank Component

#### `src/components/ingredients/IngredientBank.tsx`

**Key Changes:**

1. **Data mapping** - Update to use new column names
2. **Autocomplete dropdown** - When typing, show suggestions from:
   - Ingredients in the bank (green indicator)
   - Historical ingredients not in bank (amber indicator, "Add to bank")
3. **Visual display** - Color intensity based on `usedCount`
4. **Remove behavior** - Sets `in_bank: false` instead of deleting

```typescript
// Updated data mapping (around line 46)
setIngredients(
  data.map((i) => ({
    id: i.id,
    name: i.name,
    usedCount: i.used_count,
    lastUsedBy: i.last_used_by || undefined,
    lastUsedDate: i.last_used_date || undefined,
    createdBy: i.created_by || undefined,
    inBank: i.in_bank,
  }))
);

// Filter for wheel: only ingredients in the bank
const bankIngredients = ingredients.filter((i) => i.inBank);

// Visual styling based on usage count
const getUsageStyle = (usedCount: number) => {
  if (usedCount === 0) return "bg-white border-border";
  if (usedCount === 1) return "bg-purple/5 border-purple/20";
  if (usedCount === 2) return "bg-purple/10 border-purple/30";
  if (usedCount >= 3) return "bg-purple/20 border-purple/40";
  return "bg-white border-border";
};

// Usage badge
const getUsageBadge = (usedCount: number) => {
  if (usedCount === 0) return null;
  return (
    <span className="text-xs text-purple/70">
      Used {usedCount}x
    </span>
  );
};
```

**New Autocomplete Component:**

```tsx
// New component for ingredient input with autocomplete
interface IngredientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (ingredient: Ingredient | string) => void;
  allIngredients: Ingredient[]; // All ingredients (historical + bank)
  bankIngredients: Ingredient[]; // Only those in the bank
  placeholder?: string;
}

const IngredientAutocomplete = ({
  value,
  onChange,
  onSelect,
  allIngredients,
  bankIngredients,
  placeholder = "Add ingredient...",
}: IngredientAutocompleteProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const filteredIngredients = allIngredients.filter((i) =>
    i.name.toLowerCase().includes(value.toLowerCase())
  );

  const inBankSet = new Set(bankIngredients.map((i) => i.id));

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />

      {isOpen && value && filteredIngredients.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredIngredients.map((ingredient) => {
            const isInBank = inBankSet.has(ingredient.id);
            return (
              <button
                key={ingredient.id}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                  isInBank ? "text-gray-400" : ""
                }`}
                onClick={() => {
                  onSelect(ingredient);
                  setIsOpen(false);
                }}
                disabled={isInBank}
              >
                <span>{ingredient.name}</span>
                <span className="text-xs">
                  {isInBank ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" /> In bank
                    </span>
                  ) : ingredient.usedCount > 0 ? (
                    <span className="text-amber-600">
                      Used {ingredient.usedCount}x · Add to bank
                    </span>
                  ) : (
                    <span className="text-gray-400">Add to bank</span>
                  )}
                </span>
              </button>
            );
          })}

          {/* Option to create new ingredient */}
          {!filteredIngredients.some(
            (i) => i.name.toLowerCase() === value.toLowerCase()
          ) && (
            <button
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-purple border-t"
              onClick={() => {
                onSelect(value);
                setIsOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Create "{value}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};
```

**Updated ingredient list display:**

```tsx
{filteredIngredients
  .filter((i) => i.inBank)
  .map((ingredient) => (
    <div
      key={ingredient.id}
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${getUsageStyle(ingredient.usedCount)}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{ingredient.name}</span>
        {getUsageBadge(ingredient.usedCount)}
      </div>
      {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => removeFromBank(ingredient.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  ))}
```

---

### 3. IngredientWheel Component

#### `src/components/wheel/IngredientWheel.tsx`

**Key Changes:**

1. **Filter only bank ingredients** for the wheel
2. **Visual differentiation** - Wheel segments have color intensity based on usage
3. **Do NOT increment `used_count` on schedule** - Only mark the ingredient-event association
4. **Add scheduled event association** without changing ingredient counts

```typescript
// Line 43: Filter for bank ingredients only
const bankIngredients = ingredients.filter((i) => i.inBank);
const hasEnoughIngredients = bankIngredients.length >= MIN_INGREDIENTS_TO_SPIN;

// Updated wheel colors based on usage
const getSegmentColor = (ingredient: Ingredient, baseColor: string) => {
  // Darken color based on usage count
  const usageMultiplier = Math.min(ingredient.usedCount * 0.1, 0.4);
  return baseColor; // Keep simple for now, or implement color darkening
};

// Line 144-152: Remove the ingredient update on schedule
// REMOVE THIS:
// await supabase
//   .from("ingredients")
//   .update({
//     is_used: true,
//     used_by: userId,
//     used_date: new Date().toISOString(),
//   })
//   .eq("id", selectedIngredient.id);

// Keep only the scheduled_events insert (already exists)
```

**Updated wheel segment rendering with usage indicators:**

```tsx
// In renderWheel(), add visual indication for used ingredients
{bankIngredients.map((ingredient, i) => {
  const segmentCenterAngle = segmentAngle * i + segmentAngle / 2;
  // ... existing positioning code ...

  return (
    <div
      key={ingredient.id}
      className="absolute text-[11px] font-bold text-white"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${textRotation}deg)`,
        textShadow: "1px 1px 2px rgba(0,0,0,0.7)",
        whiteSpace: "nowrap",
        // Slightly fade text for frequently used ingredients
        opacity: ingredient.usedCount > 2 ? 0.85 : 1,
      }}
    >
      {ingredient.name}
      {ingredient.usedCount > 0 && (
        <span className="ml-1 text-[9px] opacity-75">
          ({ingredient.usedCount})
        </span>
      )}
    </div>
  );
})}
```

---

### 4. RecipeClubEvents Component

#### `src/components/events/RecipeClubEvents.tsx`

**Key Changes:**

1. **Increment `used_count` on event completion** (not on schedule)
2. **Cancel event** - Do NOT decrement count (event was created, just cancelled)
3. **Complete event** - Increment count, update `last_used_date` and `last_used_by`

```typescript
// Updated completeEvent function (around line 215)
const completeEvent = async (eventId: string) => {
  if (!isAdmin) {
    toast.error("Only admins can complete events");
    return;
  }

  try {
    // Get the event to find ingredient_id
    const { data: eventData, error: fetchError } = await supabase
      .from("scheduled_events")
      .select("ingredient_id")
      .eq("id", eventId)
      .single();

    if (fetchError) throw fetchError;

    // Update event status to completed
    await supabase
      .from("scheduled_events")
      .update({ status: "completed" })
      .eq("id", eventId);

    // Increment the ingredient's used_count
    if (eventData.ingredient_id) {
      // First get current count
      const { data: ingredientData } = await supabase
        .from("ingredients")
        .select("used_count")
        .eq("id", eventData.ingredient_id)
        .single();

      // Then increment
      await supabase
        .from("ingredients")
        .update({
          used_count: (ingredientData?.used_count || 0) + 1,
          last_used_date: new Date().toISOString(),
          last_used_by: userId,
        })
        .eq("id", eventData.ingredient_id);
    }

    toast.success("Event marked as completed!");
    loadEvents();
    onEventChange?.();
  } catch (error) {
    console.error("Error completing event:", error);
    toast.error("Failed to complete event");
  }
};

// Updated cancelEvent function (around line 158)
// Remove the ingredient update - cancelling doesn't change usage history
const cancelEvent = async (eventId: string) => {
  // ... existing code ...

  try {
    // ... existing code to get eventData ...

    // Delete calendar event if exists
    // ... existing code ...

    // Delete recipes for this event
    // ... existing code ...

    // REMOVE THIS BLOCK - don't reset ingredient on cancel:
    // await supabase
    //   .from("ingredients")
    //   .update({
    //     is_used: false,
    //     used_by: null,
    //     used_date: null,
    //   })
    //   .eq("id", eventData.ingredient_id as string);

    // Delete the event row
    // ... existing code ...

    toast.success("Event cancelled!");
    // ... rest of function ...
  }
};
```

---

### 5. Dashboard Component

#### `src/pages/Dashboard.tsx`

**Key Changes:**

Update ingredient mapping to use new field names:

```typescript
// Updated loadIngredients function (around line 90)
const loadIngredients = async () => {
  try {
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (data) {
      setIngredients(
        data.map((i) => ({
          id: i.id,
          name: i.name,
          usedCount: i.used_count,
          lastUsedBy: i.last_used_by || undefined,
          lastUsedDate: i.last_used_date || undefined,
          createdBy: i.created_by || undefined,
          inBank: i.in_bank,
        }))
      );
    }
  } catch (error) {
    console.error("Error loading ingredients:", error);
  }
};
```

---

## Visual Design Summary

### Ingredient Bank List

| Used Count | Background Color | Border | Badge |
|------------|------------------|--------|-------|
| 0 (never)  | `white` | `border-border` | None |
| 1 | `purple/5` | `purple/20` | "Used 1x" |
| 2 | `purple/10` | `purple/30` | "Used 2x" |
| 3+ | `purple/20` | `purple/40` | "Used Nx" |

### Autocomplete Dropdown

| State | Indicator | Action |
|-------|-----------|--------|
| In bank | Green checkmark + "In bank" | Disabled (already added) |
| Used before, not in bank | Amber "Used Nx · Add to bank" | Click to add to bank |
| Never used, not in bank | Gray "Add to bank" | Click to add to bank |
| New ingredient | Purple "+ Create [name]" | Click to create and add |

### Wheel Segments

- All segments use the standard wheel colors
- Ingredient name shows usage count in parentheses: "Almond (2)"
- Slightly reduced opacity for heavily-used ingredients (3+)

---

## Implementation Order

### Phase 1: Database Migrations (Run in this order)

1. **Ingredients schema migration**
   ```sql
   -- Add used_count, last_used_date, in_bank columns
   -- Drop is_used, used_date columns
   -- See "Part 2: Ingredient Reuse > Schema Migration"
   ```

2. **Recipes schema migration**
   ```sql
   -- Create recipes_new table
   -- Create recipe_contributions table
   -- Migrate existing data
   -- Drop old recipes table, rename new
   -- See "Part 1: Recipe Contributions > Database Migration"
   ```

3. **Recipe ratings schema migration**
   ```sql
   -- Create recipe_ratings table
   -- See "Part 1B: Recipe Ratings > Database Migration"
   ```

4. **Run backfill script** (if you have historical data)
   ```sql
   -- See "Updated Backfill Script" section
   ```

### Phase 2: TypeScript Types

5. **Update `src/types/index.ts`**
   - Update `Ingredient` interface (usedCount, lastUsedDate, inBank)
   - Add `Recipe` interface (name, url, createdBy)
   - Add `RecipeContribution` interface
   - Add `EventRecipeWithContributions` interface
   - Add `RecipeRating` interface
   - Add `RecipeRatingsSummary` interface

6. **Update `src/integrations/supabase/types.ts`**
   - Update `ingredients` table types
   - Update `recipes` table types
   - Add `recipe_contributions` table types
   - Add `recipe_ratings` table types

### Phase 3: Core Components

7. **Update `src/pages/Dashboard.tsx`**
   - Update ingredient data mapping

8. **Update `src/components/ingredients/IngredientBank.tsx`**
   - Add autocomplete for ingredient input
   - Update visual display with usage count badges
   - Change remove behavior to set `in_bank: false`

9. **Update `src/components/wheel/IngredientWheel.tsx`**
   - Filter to only `inBank` ingredients
   - Remove ingredient update on schedule (count stays same)
   - Add usage count indicator on wheel labels

10. **Update `src/components/events/RecipeClubEvents.tsx`**
    - New data loading for recipes + contributions
    - New recipe submission flow (find-or-create recipe, then add contribution)
    - New UI for grouped recipes with contributions
    - Add "Add your notes/photos" button for existing recipes
    - Update event completion flow to show rating dialog
    - Increment `used_count` only on event completion (after ratings)

11. **Create `src/components/recipes/RecipeAutocomplete.tsx`** (new component)
    - Autocomplete search for existing recipes
    - Shows recipe name + URL preview

12. **Create `src/components/events/EventRatingDialog.tsx`** (new component)
    - Rating dialog shown during event completion
    - Two rating inputs per recipe: would cook again + star rating
    - Submit ratings then complete event

13. **Create `src/components/recipes/RecipeRatingDisplay.tsx`** (new component)
    - Shows aggregated rating summary (avg stars, % would cook again)
    - Used on recipe cards and in event details

### Phase 4: Supporting Components

14. **Update `src/components/recipes/RecipeHub.tsx`** (if exists)
    - Update to work with new recipe + contributions structure
    - Show rating summaries on recipe cards

15. **Update any other components** that reference the old recipe structure

---

## Testing Checklist

### Ingredient Reuse
- [ ] New ingredient can be added to bank
- [ ] Historical ingredient (not in bank) can be re-added to bank via autocomplete
- [ ] Autocomplete shows correct visual categories:
  - [ ] Green "In bank" for ingredients already in bank
  - [ ] Amber "Used Nx · Add to bank" for historical ingredients
  - [ ] Purple "+ Create" for new ingredients
- [ ] Wheel shows only bank ingredients (inBank = true)
- [ ] Wheel displays usage count in parentheses for used ingredients
- [ ] Scheduling event does NOT increment used_count
- [ ] Completing event DOES increment used_count (after ratings)
- [ ] Cancelling event does NOT change used_count
- [ ] Visual indicators (background color) show correct usage levels
- [ ] Removing ingredient from bank sets in_bank=false (not deleted)
- [ ] Removed ingredient can be re-added later

### Recipe Contributions
- [ ] Can add a new recipe (creates recipe + contribution)
- [ ] Recipe autocomplete shows existing recipes when typing
- [ ] Selecting existing recipe reuses it (only creates contribution)
- [ ] Multiple users can add contributions to same recipe
- [ ] Same user can contribute to same recipe in different events
- [ ] Each contribution shows user's name/avatar/notes/photos
- [ ] User can edit their own contribution
- [ ] User can delete their own contribution
- [ ] Admin can delete any contribution
- [ ] "Add your notes/photos" button appears for recipes user hasn't contributed to
- [ ] Event details groups contributions by recipe

### Recipe Ratings
- [ ] Rating dialog appears when admin clicks "Complete Event"
- [ ] All recipes from event are listed in rating dialog
- [ ] Can select "Would cook again" (Yes/No) for each recipe
- [ ] Can select star rating (1-5) for each recipe
- [ ] Can skip rating individual recipes (leave unrated)
- [ ] "Skip Ratings" button completes event without ratings
- [ ] "Submit Ratings & Complete Event" saves ratings and completes event
- [ ] Ratings are correctly linked to recipe, user, and event
- [ ] Users can only rate each recipe once per event (unique constraint)
- [ ] Aggregated ratings display shows:
  - [ ] Average star rating
  - [ ] Percentage who would cook again
  - [ ] Total number of ratings
- [ ] Ratings appear on recipe cards in Recipe Hub
- [ ] Individual ratings appear in event details

### Data Migration
- [ ] Backfill script populates ingredients with correct used_count
- [ ] Backfill script creates canonical recipes without duplicates
- [ ] Backfill script creates contributions linked to correct events/users
- [ ] Historical data is preserved and accessible

---

## Rollback Plan

If issues arise after migration:

1. **Keep backup** of current `recipes` table before migration
2. **Recipe rollback** (if needed):
   ```sql
   -- Re-create old recipes table from backup
   -- Drop recipe_contributions
   -- Drop new recipes table
   ```

3. **Ingredients rollback** (if needed):
   ```sql
   ALTER TABLE ingredients ADD COLUMN is_used BOOLEAN DEFAULT false;
   ALTER TABLE ingredients ADD COLUMN used_date TIMESTAMPTZ;
   UPDATE ingredients SET is_used = (used_count > 0), used_date = last_used_date;
   ALTER TABLE ingredients DROP COLUMN used_count;
   ALTER TABLE ingredients DROP COLUMN last_used_date;
   ALTER TABLE ingredients DROP COLUMN in_bank;
   ALTER TABLE ingredients RENAME COLUMN last_used_by TO used_by;
   ```

4. **Recipe ratings rollback** (if needed):
   ```sql
   DROP TABLE IF EXISTS recipe_ratings;
   ```

---

## Future Enhancements

After this implementation, consider:

1. **Recipe tags** - Categorize recipes (vegetarian, quick, etc.)
2. **Favorite recipes** - Users can bookmark recipes
3. **Recipe comments** - Threaded discussion on recipes
4. **Ingredient weighting** - Reduce probability of frequently-used ingredients on wheel
5. **Rating analytics** - Dashboard showing top-rated recipes, most "would cook again" recipes
6. **Recipe recommendations** - Suggest recipes based on past ratings
