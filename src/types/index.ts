export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  usedCount: number;
  lastUsedBy?: string;
  lastUsedDate?: string;
  createdBy?: string;
  inBank: boolean;
  color?: string;
}

export interface Recipe {
  id: string;
  name: string;
  url?: string;
  eventId?: string;
  ingredientId?: string;
  createdBy?: string;
  createdAt?: string;
  // Joined data
  createdByName?: string;
  createdByAvatar?: string;
  // Aggregated data (populated by joins)
  notesCount?: number;
  contributors?: string[];
}

export interface RecipeNote {
  id: string;
  recipeId: string;
  userId: string;
  notes?: string;
  photos?: string[];
  createdAt?: string;
  // Joined data
  userName?: string;
  userAvatar?: string;
}

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

export interface MemberRating {
  initial: string;
  wouldCookAgain: boolean;
}

export interface RecipeRatingsSummary {
  recipeId: string;
  averageRating: number;
  wouldCookAgainPercent: number;
  totalRatings: number;
  memberRatings: MemberRating[];
}

export interface EventRecipeWithNotes {
  recipe: Recipe;
  notes: RecipeNote[];
}

export type GroceryCategory =
  | "produce"
  | "meat_seafood"
  | "dairy"
  | "pantry"
  | "spices"
  | "frozen"
  | "bakery"
  | "beverages"
  | "condiments"
  | "other";

export interface RecipeContent {
  id: string;
  recipeId: string;
  description?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  instructions?: string[];
  sourceTitle?: string;
  parsedAt?: string;
  status: "pending" | "parsing" | "completed" | "failed";
  errorMessage?: string;
  createdAt?: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: GroceryCategory;
  rawText?: string;
  sortOrder?: number;
  createdAt?: string;
}

export interface CombinedGroceryItem {
  name: string;
  totalQuantity?: number;
  unit?: string;
  category: GroceryCategory;
  sourceRecipes: string[];
}

export interface PantryItem {
  id: string;
  userId: string;
  name: string;
  createdAt?: string;
}

export interface SmartGroceryItem {
  name: string;
  displayName: string;
  totalQuantity?: number;
  unit?: string;
  category: GroceryCategory;
  sourceRecipes: string[];
}

export interface MealPlan {
  id: string;
  userId: string;
  name: string;
  weekStart: string;
  status: "draft" | "active" | "completed" | "archived";
  createdAt?: string;
}

export interface MealPlanItem {
  id: string;
  planId: string;
  recipeId?: string;
  dayOfWeek: number; // 0=Sunday..6=Saturday
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  customName?: string;
  customUrl?: string;
  sortOrder: number;
  eventId?: string;
  cookedAt?: string;
  // Joined data
  recipeName?: string;
  recipeUrl?: string;
}

export interface ScheduledEvent {
  id: string;
  ingredientId?: string;
  eventDate: string;
  eventTime?: string;
  createdBy: string;
  status: "scheduled" | "completed" | "canceled";
  type?: "club" | "personal";
  ingredientName?: string;
  ingredientColor?: string;
}
