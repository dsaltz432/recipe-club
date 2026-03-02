import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEnvGet,
  createAnthropicResponse,
  createEdgeRequest,
  parseResponse,
} from "@tests/helpers/edge-function-setup";

// ---------------------------------------------------------------------------
// Set up Deno globals before any module loads
// ---------------------------------------------------------------------------
const mockEnvGet = createMockEnvGet();

const mockServe = vi.fn();

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = {
    env: { get: vi.fn() },
  };
});

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({
  serve: (fn: (req: Request) => Promise<Response>) => {
    mockServe(fn);
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let handler: (req: Request) => Promise<Response>;

async function loadHandler() {
  vi.resetModules();

  // Reassign mock env get each time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: mockEnvGet } };

  mockServe.mockImplementation((fn: (req: Request) => Promise<Response>) => {
    handler = fn;
  });

  await import("@edge/process-grocery-list/index.ts");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("process-grocery-list edge function", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    mockEnvGet.mockImplementation(
      createMockEnvGet().getMockImplementation()!,
    );
    await loadHandler();
  });

  it("returns 'ok' with CORS headers for OPTIONS preflight", async () => {
    const req = createEdgeRequest(null, "OPTIONS");
    const res = await handler(req);
    const { status } = res;

    expect(status).toBe(200);
    const body = await res.text();
    expect(body).toBe("ok");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns {success:true, skipped:true} when ANTHROPIC_API_KEY is missing", async () => {
    mockEnvGet.mockImplementation(
      createMockEnvGet({ ANTHROPIC_API_KEY: undefined }).getMockImplementation()!,
    );
    await loadHandler();

    const req = createEdgeRequest({ rawIngredients: [] });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, skipped: true });
  });

  it("returns {success:true, items:[], perRecipeItems:{}} when rawIngredients is empty", async () => {
    const req = createEdgeRequest({ rawIngredients: [] });
    const { data } = await parseResponse(await handler(req));

    expect(data).toEqual({ success: true, items: [], perRecipeItems: {} });
  });

  it("returns {success:true, items:[], perRecipeItems:{}} when rawIngredients is null", async () => {
    const req = createEdgeRequest({ rawIngredients: null });
    const { data } = await parseResponse(await handler(req));

    expect(data).toEqual({ success: true, items: [], perRecipeItems: {} });
  });

  it("returns parsed items and perRecipeItems from a successful AI response", async () => {
    const aiItems = [
      {
        name: "broccoli",
        displayName: "broccoli",
        totalQuantity: 3,
        unit: "head",
        category: "produce",
        sourceRecipes: ["Recipe A", "Recipe B"],
      },
    ];
    const aiPerRecipeItems = {
      "Recipe A": [
        { name: "broccoli", displayName: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["Recipe A"] },
      ],
      "Recipe B": [
        { name: "broccoli", displayName: "broccoli", totalQuantity: 1, unit: "head", category: "produce", sourceRecipes: ["Recipe B"] },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify({ items: aiItems, perRecipeItems: aiPerRecipeItems })),
    );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({
      rawIngredients: [
        {
          name: "broccoli floret",
          quantity: "2",
          unit: "head",
          category: "produce",
          recipeName: "Recipe A",
        },
        {
          name: "broccoli",
          quantity: "1",
          unit: "head",
          category: "produce",
          recipeName: "Recipe B",
        },
      ],
    });

    const { data } = await parseResponse(await handler(req));

    expect(data).toEqual({ success: true, items: aiItems, perRecipeItems: aiPerRecipeItems });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns items when AI response wraps JSON in markdown code block", async () => {
    const aiItems = [{ name: "garlic", displayName: "garlic", totalQuantity: 5, unit: "clove", category: "produce", sourceRecipes: ["R1"] }];
    const aiPerRecipeItems = { "R1": [{ name: "garlic", displayName: "garlic", totalQuantity: 5, unit: "clove", category: "produce", sourceRecipes: ["R1"] }] };
    const wrappedContent = "```json\n" + JSON.stringify({ items: aiItems, perRecipeItems: aiPerRecipeItems }) + "\n```";

    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(wrappedContent),
    );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({
      rawIngredients: [{ name: "garlic", quantity: "5", unit: "clove", category: "produce", recipeName: "R1" }],
    });

    const { data } = await parseResponse(await handler(req));
    expect(data).toEqual({ success: true, items: aiItems, perRecipeItems: aiPerRecipeItems });
  });

  it("returns 500 when AI API responds with non-ok status", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse("rate limited", false),
    );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({
      rawIngredients: [{ name: "broccoli", quantity: "1", unit: null, category: "produce", recipeName: "R1" }],
    });

    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("AI API error");
  });

  it("returns 500 when AI returns unparseable JSON", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createAnthropicResponse("this is not json at all"),
    );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({
      rawIngredients: [{ name: "onion", quantity: "1", unit: null, category: "produce", recipeName: "R1" }],
    });

    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to parse");
  });

  it("falls back to empty text when AI returns empty content array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    );

    const req = createEdgeRequest({
      rawIngredients: [{ name: "test", quantity: "1", unit: null, category: "produce", recipeName: "R1" }],
    });

    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to parse");
  });

  it("warns but proceeds when AI drops an ingredient", async () => {
    // AI returns only "garlic" but input had "garlic" + "onion"
    const aiItems = [
      { name: "garlic", displayName: "garlic", totalQuantity: 5, unit: "clove", category: "produce", sourceRecipes: ["R1"] },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify({ items: aiItems, perRecipeItems: {} })),
    );

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const req = createEdgeRequest({
      rawIngredients: [
        { name: "garlic", quantity: "5", unit: "clove", category: "produce", recipeName: "R1" },
        { name: "onion", quantity: "2", unit: null, category: "produce", recipeName: "R2" },
      ],
    });

    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toEqual({ success: true, items: aiItems, perRecipeItems: {} });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("onion"),
    );
    consoleSpy.mockRestore();
  });

  it("allows semantic merges where one name contains the other", async () => {
    // "broccoli floret" merged into "broccoli" is OK (substring match)
    const aiItems = [
      { name: "broccoli", displayName: "broccoli", totalQuantity: 3, unit: "head", category: "produce", sourceRecipes: ["R1", "R2"] },
    ];
    const aiPerRecipeItems = {
      "R1": [{ name: "broccoli", displayName: "broccoli", totalQuantity: 2, unit: "head", category: "produce", sourceRecipes: ["R1"] }],
      "R2": [{ name: "broccoli", displayName: "broccoli", totalQuantity: 1, unit: "head", category: "produce", sourceRecipes: ["R2"] }],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify({ items: aiItems, perRecipeItems: aiPerRecipeItems })),
    );

    const req = createEdgeRequest({
      rawIngredients: [
        { name: "broccoli floret", quantity: "2", unit: "head", category: "produce", recipeName: "R1" },
        { name: "broccoli", quantity: "1", unit: "head", category: "produce", recipeName: "R2" },
      ],
    });

    const { data } = await parseResponse(await handler(req));
    expect(data).toEqual({ success: true, items: aiItems, perRecipeItems: aiPerRecipeItems });
  });

  it("handles duplicate ingredient names across recipes (uses unique names for validation)", async () => {
    // Both recipes have "garlic" — input has 2 entries but only 1 unique name
    const aiItems = [
      { name: "garlic", displayName: "garlic", totalQuantity: 8, unit: "clove", category: "produce", sourceRecipes: ["R1", "R2"] },
    ];
    const aiPerRecipeItems = {
      "R1": [{ name: "garlic", displayName: "garlic", totalQuantity: 3, unit: "clove", category: "produce", sourceRecipes: ["R1"] }],
      "R2": [{ name: "garlic", displayName: "garlic", totalQuantity: 5, unit: "clove", category: "produce", sourceRecipes: ["R2"] }],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify({ items: aiItems, perRecipeItems: aiPerRecipeItems })),
    );

    const req = createEdgeRequest({
      rawIngredients: [
        { name: "garlic", quantity: "3", unit: "clove", category: "produce", recipeName: "R1" },
        { name: "garlic", quantity: "5", unit: "clove", category: "produce", recipeName: "R2" },
      ],
    });

    const { data } = await parseResponse(await handler(req));
    expect(data).toEqual({ success: true, items: aiItems, perRecipeItems: aiPerRecipeItems });
  });

  it("defaults perRecipeItems to empty object when AI omits it", async () => {
    const aiItems = [
      { name: "garlic", displayName: "garlic", totalQuantity: 5, unit: "clove", category: "produce", sourceRecipes: ["R1"] },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify({ items: aiItems })),
    );

    const req = createEdgeRequest({
      rawIngredients: [{ name: "garlic", quantity: "5", unit: "clove", category: "produce", recipeName: "R1" }],
    });

    const { data } = await parseResponse(await handler(req));
    expect(data).toEqual({ success: true, items: aiItems, perRecipeItems: {} });
  });

  it("adds displayName fallback to items and perRecipeItems when AI omits it", async () => {
    const aiItems = [
      { name: "garlic", totalQuantity: 5, unit: "clove", category: "produce", sourceRecipes: ["R1"] },
    ];
    const aiPerRecipeItems = {
      "R1": [{ name: "garlic", totalQuantity: 5, unit: "clove", category: "produce", sourceRecipes: ["R1"] }],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify({ items: aiItems, perRecipeItems: aiPerRecipeItems })),
    );

    const req = createEdgeRequest({
      rawIngredients: [{ name: "garlic", quantity: "5", unit: "clove", category: "produce", recipeName: "R1" }],
    });

    const { data } = await parseResponse(await handler(req));
    // displayName should be set to name as fallback
    expect((data as { items: { displayName: string }[] }).items[0].displayName).toBe("garlic");
    expect(
      (data as { perRecipeItems: Record<string, { displayName: string }[]> }).perRecipeItems["R1"][0].displayName
    ).toBe("garlic");
  });

  it("returns 'Unknown error' when a non-Error value is thrown", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue("string error");

    const req = createEdgeRequest({
      rawIngredients: [{ name: "test", quantity: "1", unit: null, category: "produce", recipeName: "R1" }],
    });

    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false, error: "Unknown error" });
  });

  it("returns 500 when AI response items is not an array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify({ items: "not an array" })),
    );

    const req = createEdgeRequest({
      rawIngredients: [{ name: "test", quantity: "1", unit: null, category: "produce", recipeName: "R1" }],
    });

    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("AI response items is not an array");
  });
});
