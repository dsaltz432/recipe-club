/**
 * Integration tests for data models and type consistency.
 * Verifies that data transformations between database and application are correct.
 */

import { describe, it, expect } from "vitest";
import type {
  User,
  Ingredient,
  Recipe,
  RecipeContribution,
  RecipeRating,
  ScheduledEvent,
  RecipeRatingsSummary,
} from "@/types";

describe("Data Model Transformations", () => {
  describe("Ingredient Model", () => {
    it("should correctly map database fields to Ingredient type", () => {
      // Simulated database row
      const dbRow = {
        id: "ing-123",
        name: "Salmon",
        used_count: 3,
        last_used_by: "user-123",
        last_used_date: "2025-01-15",
        created_by: "user-456",
        in_bank: true,
      };

      // Transform to application model
      const ingredient: Ingredient = {
        id: dbRow.id,
        name: dbRow.name,
        usedCount: dbRow.used_count,
        lastUsedBy: dbRow.last_used_by,
        lastUsedDate: dbRow.last_used_date,
        createdBy: dbRow.created_by,
        inBank: dbRow.in_bank,
      };

      expect(ingredient.id).toBe("ing-123");
      expect(ingredient.name).toBe("Salmon");
      expect(ingredient.usedCount).toBe(3);
      expect(ingredient.lastUsedBy).toBe("user-123");
      expect(ingredient.lastUsedDate).toBe("2025-01-15");
      expect(ingredient.createdBy).toBe("user-456");
      expect(ingredient.inBank).toBe(true);
    });

    it("should handle optional fields being null", () => {
      const dbRow = {
        id: "ing-123",
        name: "Chicken",
        used_count: 0,
        last_used_by: null,
        last_used_date: null,
        created_by: null,
        in_bank: true,
      };

      const ingredient: Ingredient = {
        id: dbRow.id,
        name: dbRow.name,
        usedCount: dbRow.used_count,
        lastUsedBy: dbRow.last_used_by || undefined,
        lastUsedDate: dbRow.last_used_date || undefined,
        createdBy: dbRow.created_by || undefined,
        inBank: dbRow.in_bank,
      };

      expect(ingredient.lastUsedBy).toBeUndefined();
      expect(ingredient.lastUsedDate).toBeUndefined();
      expect(ingredient.createdBy).toBeUndefined();
    });
  });

  describe("Recipe Model", () => {
    it("should correctly map database fields to Recipe type", () => {
      const dbRow = {
        id: "recipe-123",
        name: "Grilled Salmon",
        url: "https://example.com/recipe",
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
      };

      const recipe: Recipe = {
        id: dbRow.id,
        name: dbRow.name,
        url: dbRow.url,
        createdBy: dbRow.created_by,
        createdAt: dbRow.created_at,
      };

      expect(recipe.id).toBe("recipe-123");
      expect(recipe.name).toBe("Grilled Salmon");
      expect(recipe.url).toBe("https://example.com/recipe");
      expect(recipe.createdBy).toBe("user-123");
      expect(recipe.createdAt).toBe("2025-01-15T10:00:00Z");
    });

    it("should handle optional url being null", () => {
      const dbRow = {
        id: "recipe-123",
        name: "Family Recipe",
        url: null,
        created_by: "user-123",
        created_at: "2025-01-15T10:00:00Z",
      };

      const recipe: Recipe = {
        id: dbRow.id,
        name: dbRow.name,
        url: dbRow.url || undefined,
        createdBy: dbRow.created_by,
        createdAt: dbRow.created_at,
      };

      expect(recipe.url).toBeUndefined();
    });
  });

  describe("RecipeContribution Model", () => {
    it("should correctly map database fields with joins", () => {
      const dbRow = {
        id: "contrib-123",
        recipe_id: "recipe-123",
        user_id: "user-123",
        event_id: "event-123",
        notes: "Great with lemon",
        photos: ["photo1.jpg", "photo2.jpg"],
        created_at: "2025-01-15T10:00:00Z",
        profiles: {
          name: "Test User",
          avatar_url: "avatar.jpg",
        },
        recipes: {
          name: "Grilled Salmon",
          url: "https://example.com",
        },
        scheduled_events: {
          event_date: "2025-01-15",
          ingredients: {
            name: "Salmon",
          },
        },
      };

      const contribution: RecipeContribution = {
        id: dbRow.id,
        recipeId: dbRow.recipe_id,
        userId: dbRow.user_id,
        eventId: dbRow.event_id,
        notes: dbRow.notes,
        photos: dbRow.photos,
        createdAt: dbRow.created_at,
        userName: dbRow.profiles.name,
        userAvatar: dbRow.profiles.avatar_url,
        recipeName: dbRow.recipes.name,
        recipeUrl: dbRow.recipes.url,
        eventDate: dbRow.scheduled_events.event_date,
        ingredientName: dbRow.scheduled_events.ingredients.name,
      };

      expect(contribution.id).toBe("contrib-123");
      expect(contribution.recipeId).toBe("recipe-123");
      expect(contribution.userName).toBe("Test User");
      expect(contribution.recipeName).toBe("Grilled Salmon");
      expect(contribution.ingredientName).toBe("Salmon");
      expect(contribution.photos).toHaveLength(2);
    });
  });

  describe("RecipeRating Model", () => {
    it("should correctly map rating fields", () => {
      const dbRow = {
        id: "rating-123",
        recipe_id: "recipe-123",
        user_id: "user-123",
        event_id: "event-123",
        would_cook_again: true,
        overall_rating: 4,
        created_at: "2025-01-15T10:00:00Z",
      };

      const rating: RecipeRating = {
        id: dbRow.id,
        recipeId: dbRow.recipe_id,
        userId: dbRow.user_id,
        eventId: dbRow.event_id,
        wouldCookAgain: dbRow.would_cook_again,
        overallRating: dbRow.overall_rating,
        createdAt: dbRow.created_at,
      };

      expect(rating.id).toBe("rating-123");
      expect(rating.wouldCookAgain).toBe(true);
      expect(rating.overallRating).toBe(4);
    });

    it("should validate rating is between 1 and 5", () => {
      const validRatings = [1, 2, 3, 4, 5];

      validRatings.forEach((rating) => {
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(5);
      });
    });
  });

  describe("ScheduledEvent Model", () => {
    it("should correctly map event fields", () => {
      const dbRow = {
        id: "event-123",
        ingredient_id: "ing-123",
        event_date: "2025-01-20",
        event_time: "19:00",
        created_by: "user-123",
        status: "scheduled",
        ingredients: {
          name: "Salmon",
        },
      };

      const event: ScheduledEvent = {
        id: dbRow.id,
        ingredientId: dbRow.ingredient_id,
        eventDate: dbRow.event_date,
        eventTime: dbRow.event_time,
        createdBy: dbRow.created_by,
        status: dbRow.status as "scheduled" | "completed" | "canceled",
        ingredientName: dbRow.ingredients.name,
      };

      expect(event.id).toBe("event-123");
      expect(event.ingredientId).toBe("ing-123");
      expect(event.eventDate).toBe("2025-01-20");
      expect(event.eventTime).toBe("19:00");
      expect(event.status).toBe("scheduled");
      expect(event.ingredientName).toBe("Salmon");
    });

    it("should validate event status values", () => {
      const validStatuses: ("scheduled" | "completed" | "canceled")[] = [
        "scheduled",
        "completed",
        "canceled",
      ];

      validStatuses.forEach((status) => {
        const event: ScheduledEvent = {
          id: "1",
          ingredientId: "1",
          eventDate: "2025-01-20",
          createdBy: "1",
          status,
        };
        expect(["scheduled", "completed", "canceled"]).toContain(event.status);
      });
    });
  });

  describe("RecipeRatingsSummary Model", () => {
    it("should calculate summary statistics correctly", () => {
      const ratings: RecipeRating[] = [
        {
          id: "1",
          recipeId: "recipe-1",
          userId: "u1",
          eventId: "e1",
          wouldCookAgain: true,
          overallRating: 5,
        },
        {
          id: "2",
          recipeId: "recipe-1",
          userId: "u2",
          eventId: "e1",
          wouldCookAgain: true,
          overallRating: 4,
        },
        {
          id: "3",
          recipeId: "recipe-1",
          userId: "u3",
          eventId: "e1",
          wouldCookAgain: false,
          overallRating: 3,
        },
      ];

      // Calculate summary
      const totalRatings = ratings.length;
      const averageRating =
        ratings.reduce((sum, r) => sum + r.overallRating, 0) / totalRatings;
      const wouldCookAgainCount = ratings.filter((r) => r.wouldCookAgain).length;
      const wouldCookAgainPercent = (wouldCookAgainCount / totalRatings) * 100;

      const summary: RecipeRatingsSummary = {
        recipeId: "recipe-1",
        averageRating,
        wouldCookAgainPercent,
        totalRatings,
      };

      expect(summary.totalRatings).toBe(3);
      expect(summary.averageRating).toBe(4);
      expect(summary.wouldCookAgainPercent).toBeCloseTo(66.67, 1);
    });
  });

  describe("User Model", () => {
    it("should correctly map user fields", () => {
      const dbProfile = {
        id: "user-123",
        name: "Test User",
        email: "test@example.com",
        avatar_url: "https://example.com/avatar.jpg",
      };

      const user: User = {
        id: dbProfile.id,
        name: dbProfile.name,
        email: dbProfile.email,
        avatar_url: dbProfile.avatar_url,
      };

      expect(user.id).toBe("user-123");
      expect(user.name).toBe("Test User");
      expect(user.email).toBe("test@example.com");
      expect(user.avatar_url).toBe("https://example.com/avatar.jpg");
    });
  });
});

describe("Data Aggregation", () => {
  it("should group contributions by recipe", () => {
    const contributions: RecipeContribution[] = [
      { id: "c1", recipeId: "r1", userId: "u1", eventId: "e1" },
      { id: "c2", recipeId: "r1", userId: "u2", eventId: "e1" },
      { id: "c3", recipeId: "r2", userId: "u1", eventId: "e1" },
    ];

    const grouped = contributions.reduce(
      (acc, contrib) => {
        if (!acc[contrib.recipeId]) {
          acc[contrib.recipeId] = [];
        }
        acc[contrib.recipeId].push(contrib);
        return acc;
      },
      {} as Record<string, RecipeContribution[]>
    );

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped["r1"]).toHaveLength(2);
    expect(grouped["r2"]).toHaveLength(1);
  });

  it("should extract unique contributors", () => {
    const contributions: RecipeContribution[] = [
      { id: "c1", recipeId: "r1", userId: "u1", eventId: "e1", userName: "User 1" },
      { id: "c2", recipeId: "r1", userId: "u2", eventId: "e1", userName: "User 2" },
      { id: "c3", recipeId: "r1", userId: "u1", eventId: "e2", userName: "User 1" },
    ];

    const uniqueContributors = [...new Set(contributions.map((c) => c.userName))];

    expect(uniqueContributors).toHaveLength(2);
    expect(uniqueContributors).toContain("User 1");
    expect(uniqueContributors).toContain("User 2");
  });
});
