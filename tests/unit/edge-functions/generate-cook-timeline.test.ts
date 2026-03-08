import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEnvGet,
  createMockSupabaseClient,
  createAnthropicResponse,
  createEdgeRequest,
  parseResponse,
} from "@tests/helpers/edge-function-setup";

// ---------------------------------------------------------------------------
// Set up Deno globals and mocks
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
  await import("@edge/generate-cook-timeline/index.ts");
}

function createBuilder(data: unknown = null, error: { message: string } | null = null) {
  const builder: Record<string, unknown> = {};
  for (const m of [
    "select", "eq", "neq", "order", "limit", "insert", "update", "delete",
    "upsert", "single", "maybeSingle", "filter", "in",
  ] as const) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(onFulfilled);
  return builder;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockSteps = [
  {
    recipeId: "recipe-1",
    recipeName: "Pasta",
    instruction: "Boil water in a large pot",
    timing: "10 minutes",
    category: "active",
  },
  {
    recipeId: "recipe-2",
    recipeName: "Salad",
    instruction: "Chop all vegetables into bite-sized pieces",
    timing: "5 minutes",
    category: "prep",
  },
];

const baseBody = {
  eventId: "event-123",
  recipeIds: ["recipe-1", "recipe-2"],
};

// Table builders — reset per-test via setupDefaultSupabaseMock
let cacheBuilder: ReturnType<typeof createBuilder>;
let recipesBuilder: ReturnType<typeof createBuilder>;
let contentBuilder: ReturnType<typeof createBuilder>;

function setupDefaultSupabaseMock(cacheData: unknown = null) {
  cacheBuilder = createBuilder(cacheData);
  recipesBuilder = createBuilder([
    { id: "recipe-1", name: "Pasta" },
    { id: "recipe-2", name: "Salad" },
  ]);
  contentBuilder = createBuilder([
    {
      recipe_id: "recipe-1",
      instructions: ["Boil water", "Cook pasta for 8 minutes"],
      prep_time: "5 min",
      cook_time: "10 min",
      total_time: "15 min",
    },
    {
      recipe_id: "recipe-2",
      instructions: ["Chop vegetables", "Mix with dressing"],
      prep_time: "5 min",
      cook_time: null,
      total_time: "5 min",
    },
  ]);

  mockSupabase.from.mockImplementation((table: string) => {
    switch (table) {
      case "cook_mode_timelines":
        return cacheBuilder;
      case "recipes":
        return recipesBuilder;
      case "recipe_content":
        return contentBuilder;
      default:
        return createBuilder(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("generate-cook-timeline edge function", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    mockEnvGet.mockImplementation(createMockEnvGet().getMockImplementation()!);
    setupDefaultSupabaseMock();
    await loadHandler();
  });

  it("returns 'ok' with CORS headers for OPTIONS preflight", async () => {
    const req = createEdgeRequest(null, "OPTIONS");
    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 400 when recipeIds is missing", async () => {
    const req = createEdgeRequest({ eventId: "event-123" });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(400);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("recipeIds is required");
  });

  it("returns 400 when recipeIds is empty array", async () => {
    const req = createEdgeRequest({ eventId: "event-123", recipeIds: [] });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(400);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("recipeIds is required");
  });

  it("returns CORS headers on 400 error response", async () => {
    const req = createEdgeRequest({ eventId: "event-123", recipeIds: [] });
    const { headers } = await parseResponse(await handler(req));

    expect(headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns cached timeline when recipe_ids_hash matches", async () => {
    setupDefaultSupabaseMock({ steps: mockSteps });

    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, steps: mockSteps });
    // Anthropic API should NOT have been called on cache hit
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls Anthropic API on cache miss and returns steps", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(mockSteps)),
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });
    expect((data as { steps: unknown[] }).steps).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("stores result in cook_mode_timelines after cache miss", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(mockSteps)),
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = createEdgeRequest(baseBody);
    await handler(req);

    expect(cacheBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-123",
        steps: mockSteps,
      }),
    );
  });

  it("handles Anthropic API failure gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse("Internal Server Error", false),
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toBeDefined();
  });

  it("returns CORS headers on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(mockSteps)),
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = createEdgeRequest(baseBody);
    const { headers } = await parseResponse(await handler(req));

    expect(headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
