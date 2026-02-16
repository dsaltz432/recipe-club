import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEnvGet,
  createMockSupabaseClient,
  createAnthropicResponse,
  createEdgeRequest,
  parseResponse,
} from "@tests/helpers/edge-function-setup";

// ---------------------------------------------------------------------------
// Set up Deno globals before any module loads
// ---------------------------------------------------------------------------
const mockEnvGet = createMockEnvGet();
const mockServe = vi.fn();
const mockSupabase = createMockSupabaseClient();

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: vi.fn() } };
});

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({
  serve: (fn: (req: Request) => Promise<Response>) => {
    mockServe(fn);
  },
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: () => mockSupabase,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let handler: (req: Request) => Promise<Response>;

async function loadHandler() {
  vi.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: mockEnvGet } };
  mockServe.mockImplementation((fn: (req: Request) => Promise<Response>) => {
    handler = fn;
  });
  await import("@edge/generate-meal-suggestions/index.ts");
}

const sampleBody = {
  userId: "user-123",
  preferences: {
    dietaryRestrictions: [],
    cuisinePreferences: ["Italian"],
    dislikedIngredients: [],
    householdSize: 2,
    cookingSkill: "intermediate",
    maxCookTimeMinutes: 45,
  },
  currentPlanItems: [
    { dayOfWeek: 1, mealType: "dinner", name: "Tacos" },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("generate-meal-suggestions edge function", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    mockEnvGet.mockImplementation(
      createMockEnvGet().getMockImplementation()!,
    );

    // Reset Supabase mock state
    mockSupabase.from.mockImplementation(() => {
      const builder: Record<string, unknown> = {};
      const chainMethods = ["select", "eq", "order", "limit", "single", "maybeSingle", "insert", "update", "delete", "upsert", "neq", "filter"] as const;
      for (const m of chainMethods) {
        builder[m] = vi.fn().mockReturnValue(builder);
      }
      builder.then = (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      return builder;
    });

    await loadHandler();
  });

  it("returns 'ok' with CORS headers for OPTIONS preflight", async () => {
    const req = createEdgeRequest(null, "OPTIONS");
    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    mockEnvGet.mockImplementation(
      createMockEnvGet({ ANTHROPIC_API_KEY: undefined }).getMockImplementation()!,
    );
    await loadHandler();

    const req = createEdgeRequest(sampleBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("ANTHROPIC_API_KEY");
  });

  it("returns 500 when userId is missing", async () => {
    const req = createEdgeRequest({ ...sampleBody, userId: undefined });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("userId is required");
  });

  it("returns suggestions from a successful AI response with past recipes and ratings", async () => {
    // Mock Supabase to return past recipes and ratings
    const recipesBuilder: Record<string, unknown> = {};
    const ratingsBuilder: Record<string, unknown> = {};

    for (const b of [recipesBuilder, ratingsBuilder]) {
      const chainMethods = ["select", "eq", "order", "limit"] as const;
      for (const m of chainMethods) {
        b[m] = vi.fn().mockReturnValue(b);
      }
    }

    recipesBuilder.then = (onFulfilled?: (v: unknown) => unknown) =>
      Promise.resolve({ data: [{ name: "Pasta Carbonara", url: "https://example.com" }], error: null }).then(onFulfilled);
    ratingsBuilder.then = (onFulfilled?: (v: unknown) => unknown) =>
      Promise.resolve({ data: [{ overall_rating: 5, recipes: { name: "Pasta Carbonara" } }], error: null }).then(onFulfilled);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "recipes") return recipesBuilder;
      if (table === "recipe_ratings") return ratingsBuilder;
      return recipesBuilder;
    });

    const aiSuggestions = {
      suggestions: [
        { name: "Risotto", cuisine: "Italian", timeEstimate: "40 min", reason: "Fits your Italian preference" },
      ],
      chatResponse: "Here's a great Italian dish!",
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(aiSuggestions)),
    );

    const req = createEdgeRequest({ ...sampleBody, chatMessage: "Give me Italian ideas" });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, chatResponse: "Here's a great Italian dish!" });
    expect((data as { suggestions: unknown[] }).suggestions).toHaveLength(1);
    expect((data as { suggestions: Array<{ name: string }> }).suggestions[0].name).toBe("Risotto");
    // Suggestions should have IDs added
    expect((data as { suggestions: Array<{ id: string }> }).suggestions[0].id).toMatch(/^suggestion-/);
  });

  it("defaults to empty arrays when Supabase returns null data", async () => {
    // Supabase returns null data by default in our mock
    const aiSuggestions = {
      suggestions: [{ name: "Soup", cuisine: "American", timeEstimate: "20 min", reason: "Quick and easy" }],
      chatResponse: "Try this!",
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(aiSuggestions)),
    );

    const req = createEdgeRequest(sampleBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });
    expect((data as { suggestions: unknown[] }).suggestions).toHaveLength(1);
  });

  it("uses default 'Suggest some meals' message when no chatMessage provided", async () => {
    const aiSuggestions = {
      suggestions: [],
      chatResponse: "Here are suggestions!",
    };

    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(aiSuggestions)),
    );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...sampleBody, chatMessage: undefined });
    await handler(req);

    // Check the body sent to Anthropic includes the default message
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain("Suggest some meals for my weekly plan.");
  });

  it("uses fallback response when AI returns unparseable JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse("Not valid JSON at all {{{"),
    );

    const req = createEdgeRequest(sampleBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      suggestions: [],
      chatResponse: "I had trouble generating suggestions. Please try again.",
    });
  });

  it("returns 500 when AI API responds with non-ok status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse("rate limited", false),
    );

    const req = createEdgeRequest(sampleBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to generate suggestions");
  });

  it("filters out ratings with null recipes", async () => {
    const ratingsBuilder: Record<string, unknown> = {};
    const chainMethods = ["select", "eq", "order", "limit"] as const;
    for (const m of chainMethods) {
      ratingsBuilder[m] = vi.fn().mockReturnValue(ratingsBuilder);
    }
    ratingsBuilder.then = (onFulfilled?: (v: unknown) => unknown) =>
      Promise.resolve({
        data: [
          { overall_rating: 5, recipes: { name: "Good Recipe" } },
          { overall_rating: 4, recipes: null }, // null recipes should be filtered
        ],
        error: null,
      }).then(onFulfilled);

    const recipesBuilder: Record<string, unknown> = {};
    for (const m of chainMethods) {
      recipesBuilder[m] = vi.fn().mockReturnValue(recipesBuilder);
    }
    recipesBuilder.then = (onFulfilled?: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(onFulfilled);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "recipe_ratings") return ratingsBuilder;
      return recipesBuilder;
    });

    const aiSuggestions = { suggestions: [], chatResponse: "Done!" };
    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(aiSuggestions)),
    );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(sampleBody);
    await handler(req);

    // Verify the prompt sent to AI only includes the non-null rating
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain("Good Recipe (5/5)");
    expect(body.messages[0].content).not.toContain("null");
  });

  it("covers all preference template branches and empty meal plan", async () => {
    const aiSuggestions = {
      suggestions: [{ name: "Soup", cuisine: "Any", timeEstimate: "20 min", reason: "Easy" }],
      chatResponse: "Here!",
    };
    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(aiSuggestions)),
    );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({
      userId: "user-123",
      preferences: {
        dietaryRestrictions: ["vegan", "gluten-free"],
        cuisinePreferences: [],
        dislikedIngredients: ["mushrooms"],
        householdSize: 1,
        cookingSkill: "beginner",
        maxCookTimeMinutes: 30,
      },
      currentPlanItems: [],
    });

    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].content).toContain("vegan, gluten-free");
    expect(body.messages[0].content).toContain("Open to all");
    expect(body.messages[0].content).toContain("mushrooms");
    expect(body.messages[0].content).toContain("Empty - no meals planned yet");
  });

  it("uses all fallbacks when AI content is empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    );

    const req = createEdgeRequest(sampleBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      suggestions: [],
      chatResponse: "Here are some suggestions for you!",
    });
  });

  it("returns 'Unknown error' when a non-Error is thrown", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue("string rejection");

    const req = createEdgeRequest(sampleBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false, error: "Unknown error" });
  });
});
