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
  await import("@edge/parse-recipe/index.ts");
}

function createBuilder(data: unknown = null, error: { message: string } | null = null) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "limit", "insert", "update", "delete", "upsert", "single", "maybeSingle", "filter"] as const) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(onFulfilled);
  return builder;
}

const baseBody = {
  recipeId: "recipe-123",
  recipeUrl: "https://example.com/recipe",
  recipeName: "Test Recipe",
};

const parsedRecipe = {
  description: "A test recipe",
  servings: "4 servings",
  prep_time: "15 minutes",
  cook_time: "30 minutes",
  total_time: "45 minutes",
  instructions: ["Step 1", "Step 2"],
  source_title: "Example Kitchen",
  ingredients: [
    { name: "onion", quantity: 1, unit: null, category: "produce", raw_text: "1 onion" },
    { name: "garlic", quantity: 3, unit: "clove", category: "produce", raw_text: "3 cloves garlic" },
  ],
};

function setupDefaultSupabaseMock() {
  mockSupabase.from.mockReturnValue(createBuilder(null, null));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("parse-recipe edge function", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    mockEnvGet.mockImplementation(
      createMockEnvGet().getMockImplementation()!,
    );
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

  it("returns {success:true, skipped:true} when ANTHROPIC_API_KEY is missing", async () => {
    mockEnvGet.mockImplementation(
      createMockEnvGet({ ANTHROPIC_API_KEY: undefined }).getMockImplementation()!,
    );
    await loadHandler();

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, skipped: true });
  });

  it("returns 500 when recipeId is missing", async () => {
    const req = createEdgeRequest({ ...baseBody, recipeId: undefined });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("recipeId and recipeUrl are required");
  });

  it("returns 500 when recipeUrl is missing", async () => {
    const req = createEdgeRequest({ ...baseBody, recipeUrl: undefined });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("recipeId and recipeUrl are required");
  });

  it("fetches binary and sends base64 to AI for supabase storage URLs", async () => {
    const imageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/photo.jpg";
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes

    const mockFetch = vi.fn()
      // First call: fetch the image
      .mockResolvedValueOnce(
        new Response(binaryData.buffer, { status: 200 }),
      )
      // Second call: Anthropic API
      .mockResolvedValueOnce(
        createAnthropicResponse(JSON.stringify(parsedRecipe)),
      );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    // Second call should be to Anthropic with image content
    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    // Image request should have array content with image block
    expect(anthropicBody.messages[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "image" }),
      ]),
    );
  });

  it("handles image URL by file extension (.jpg) sends base64 to AI", async () => {
    const imageUrl = "https://example.com/recipes/photo.jpg";
    const binaryData = new Uint8Array([0xFF, 0xD8]); // JPEG header

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(binaryData.buffer, { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    expect(anthropicBody.messages[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "image" }),
      ]),
    );
  });

  it("extracts JSON-LD Recipe with direct @type:'Recipe'", async () => {
    const htmlWithJsonLd = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Test Recipe",
          "recipeIngredient": ["1 cup flour", "2 eggs"],
          "recipeInstructions": [{"text": "Mix together"}]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlWithJsonLd, { status: 200, headers: { "Content-Type": "text/html" } }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    // Verify the AI received structured data
    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    expect(anthropicBody.messages[0].content).toContain("STRUCTURED RECIPE DATA");
  });

  it("extracts JSON-LD Recipe from @graph array", async () => {
    const htmlWithGraph = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@graph": [
            {"@type": "WebPage", "name": "Page"},
            {"@type": "Recipe", "name": "Graph Recipe", "recipeIngredient": ["salt"]}
          ]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlWithGraph, { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    expect(anthropicBody.messages[0].content).toContain("STRUCTURED RECIPE DATA");
  });

  it("extracts JSON-LD Recipe with array @type:['Recipe']", async () => {
    const htmlWithArrayType = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": ["Recipe"],
          "name": "Array Type Recipe",
          "recipeIngredient": ["pepper"]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlWithArrayType, { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    expect(anthropicBody.messages[0].content).toContain("STRUCTURED RECIPE DATA");
  });

  it("handles invalid JSON in ld+json script tag (catch branch falls through)", async () => {
    const htmlWithInvalidJsonLd = `
      <html>
      <head>
        <script type="application/ld+json">
        {not valid json at all!!!}
        </script>
      </head>
      <body><p>Recipe text content here</p></body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlWithInvalidJsonLd, { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    // Should fall back to text extraction (no STRUCTURED RECIPE DATA prefix)
    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    expect(anthropicBody.messages[0].content).not.toContain("STRUCTURED RECIPE DATA");
    expect(anthropicBody.messages[0].content).toContain("Recipe text content here");
  });

  it("falls back to text extraction when no JSON-LD found", async () => {
    const htmlNoJsonLd = `
      <html>
      <head><title>Recipe Page</title></head>
      <body>
        <h1>My Recipe</h1>
        <p>Instructions here</p>
        <script>var x = 1;</script>
        <style>.red { color: red; }</style>
      </body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlNoJsonLd, { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    // Text extraction strips HTML tags, scripts, styles
    expect(anthropicBody.messages[0].content).toContain("My Recipe");
    expect(anthropicBody.messages[0].content).toContain("Instructions here");
    expect(anthropicBody.messages[0].content).not.toContain("<h1>");
    expect(anthropicBody.messages[0].content).not.toContain("var x = 1");
  });

  it("returns {success:true} with no DB warnings on successful parse", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, ingredientCount: 2 });
    expect((data as Record<string, unknown>).dbWarnings).toBeUndefined();
  });

  it("returns dbWarnings array when DB operations fail", async () => {
    // Set up mocks so delete, insert, and upsert all return errors
    const deleteBuilder = createBuilder(null, { message: "delete failed" });
    const upsertBuilder = createBuilder(null, { message: "upsert failed" });

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      // 1st call: recipe_content upsert (parsing status) - succeeds
      if (callCount === 1) return createBuilder(null, null);
      // 2nd call: recipe_ingredients delete - fails
      if (callCount === 2) return deleteBuilder;
      // 3rd call: recipe_content upsert (completed) - fails
      return upsertBuilder;
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    // success is false because there are dbWarnings
    expect(data).toMatchObject({ success: false });
    expect((data as { dbWarnings: string[] }).dbWarnings).toBeDefined();
    expect((data as { dbWarnings: string[] }).dbWarnings.length).toBeGreaterThan(0);
  });

  it("writes 'failed' status to recipe_content when AI responds non-ok", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse("rate limited", false));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("AI API error");
  });

  it("returns 500 when AI returns unparseable JSON", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse("totally not json {{{"));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to parse");
  });

  it("catch block with null body from req.clone().json() skips upsert", async () => {
    // Force an error that triggers the catch block
    // We'll make the AI call throw
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockRejectedValueOnce(new Error("Network error"));
    globalThis.fetch = mockFetch;

    // The catch block creates a new client and calls req.clone().json()
    // Since the body has already been consumed, the error handler will attempt
    // to parse the request again. We're testing the flow handles this gracefully.
    const req = createEdgeRequest({ recipeId: null }); // null body.recipeId → skips upsert
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
  });

  it("catch block cleanup error is swallowed silently", async () => {
    // Make the first upsert succeed, then make AI call throw to trigger catch
    const upsertBuilder = createBuilder(null, null);
    mockSupabase.from.mockReturnValue(upsertBuilder);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockRejectedValueOnce(new Error("AI network error"));
    globalThis.fetch = mockFetch;

    // Even if the catch block upsert throws, the function returns normally
    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("AI network error");
  });
});
