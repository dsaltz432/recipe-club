export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  isUsed: boolean;
  usedBy?: string;
  usedDate?: string;
  createdBy?: string;
}

export interface Recipe {
  id: string;
  name: string;
  url?: string;
  notes?: string;
  userId: string;
  ingredientId: string;
  eventDate: string;
  createdAt?: string;
  userName?: string;
  userAvatar?: string;
  ingredientName?: string;
}

export interface WheelItem {
  id: string;
  label: string;
}

export interface ScheduledEvent {
  id: string;
  ingredientId: string;
  eventDate: string;
  createdBy: string;
  status: "scheduled" | "completed" | "canceled";
  ingredientName?: string;
}

export interface EventWithRecipes {
  eventDate: string;
  eventId?: string;
  recipes: Recipe[];
  participantCount: number;
}
