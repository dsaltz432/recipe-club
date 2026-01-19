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

export interface ScheduledEvent {
  id: string;
  ingredientId: string;
  eventDate: string;
  eventTime?: string;
  createdBy: string;
  status: "scheduled" | "completed" | "canceled";
  ingredientName?: string;
  ingredientColor?: string;
}
