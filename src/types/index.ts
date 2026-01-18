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
}

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

export interface RecipeRatingsSummary {
  recipeId: string;
  averageRating: number;
  wouldCookAgainPercent: number;
  totalRatings: number;
}

export interface EventRecipeWithContributions {
  recipe: Recipe;
  contributions: RecipeContribution[];
}

export interface ScheduledEvent {
  id: string;
  ingredientId: string;
  eventDate: string;
  eventTime?: string;
  createdBy: string;
  status: "scheduled" | "completed" | "canceled";
  ingredientName?: string;
}
