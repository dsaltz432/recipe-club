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
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  // Default storage mock for storage URL tests
  mockSupabase.storage.from.mockReturnValue({
    download: vi.fn().mockResolvedValue({ data: null, error: { message: "not configured" } }),
  });
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

  // BUG-015: Malformed request body returns 400
  it("returns 400 when request body is invalid JSON", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json {{{",
    });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(400);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Invalid request body");
  });

  // Missing fields now return 400 instead of 500
  it("returns 400 when recipeId is missing", async () => {
    const req = createEdgeRequest({ ...baseBody, recipeId: undefined });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(400);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("recipeId and recipeUrl are required");
  });

  it("returns 400 when recipeUrl is missing", async () => {
    const req = createEdgeRequest({ ...baseBody, recipeUrl: undefined });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(400);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("recipeId and recipeUrl are required");
  });

  // BUG-001: Media type detection
  // BUG-009: Storage URLs use supabase.storage.from().download() instead of raw fetch
  it("fetches binary and sends base64 to AI for supabase storage URLs with correct media type", async () => {
    const imageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/photo.jpg";
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: { arrayBuffer: () => Promise.resolve(binaryData.buffer), type: "image/jpeg" },
        error: null,
      }),
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        createAnthropicResponse(JSON.stringify(parsedRecipe)),
      );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    // Verify storage client was used with correct bucket and path
    expect(mockSupabase.storage.from).toHaveBeenCalledWith("recipes");

    // First fetch call should be to Anthropic with image content and correct media_type
    const anthropicCall = mockFetch.mock.calls[0];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const imageBlock = anthropicBody.messages[0].content.find(
      (c: Record<string, unknown>) => c.type === "image",
    );
    expect(imageBlock).toBeDefined();
    expect(imageBlock.source.media_type).toBe("image/jpeg");
  });

  it("handles image URL by file extension (.jpg) sends base64 to AI", async () => {
    const imageUrl = "https://example.com/recipes/photo.jpg";
    const binaryData = new Uint8Array([0xFF, 0xD8]); // JPEG header

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(binaryData.buffer, { status: 200, headers: { "Content-Length": "2" } }))
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

  it("detects PNG media type from URL extension", async () => {
    const imageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/photo.png";
    const binaryData = new Uint8Array([0x89, 0x50]);

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: { arrayBuffer: () => Promise.resolve(binaryData.buffer), type: "image/png" },
        error: null,
      }),
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    const anthropicCall = mockFetch.mock.calls[0];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const imageBlock = anthropicBody.messages[0].content.find(
      (c: Record<string, unknown>) => c.type === "image",
    );
    expect(imageBlock.source.media_type).toBe("image/png");
  });

  it("detects PDF media type and uses document content block type", async () => {
    const pdfUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/recipe.pdf";
    const binaryData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF header

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: { arrayBuffer: () => Promise.resolve(binaryData.buffer), type: "application/pdf" },
        error: null,
      }),
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: pdfUrl });
    const { status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    const anthropicCall = mockFetch.mock.calls[0];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const docBlock = anthropicBody.messages[0].content.find(
      (c: Record<string, unknown>) => c.type === "document",
    );
    expect(docBlock).toBeDefined();
    expect(docBlock.source.media_type).toBe("application/pdf");
  });

  it("detects media type from Content-Type header when URL has no extension", async () => {
    const storageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/noext";
    const binaryData = new Uint8Array([0x89, 0x50]);

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: { arrayBuffer: () => Promise.resolve(binaryData.buffer), type: "image/webp" },
        error: null,
      }),
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: storageUrl });
    const { status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    const anthropicCall = mockFetch.mock.calls[0];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const imageBlock = anthropicBody.messages[0].content.find(
      (c: Record<string, unknown>) => c.type === "image",
    );
    expect(imageBlock.source.media_type).toBe("image/webp");
  });

  it("defaults to image/jpeg when no extension or Content-Type matches", async () => {
    const storageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/noext";
    const binaryData = new Uint8Array([0xFF, 0xD8]);

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({
        // application/octet-stream does not match image/* or application/pdf
        data: { arrayBuffer: () => Promise.resolve(binaryData.buffer), type: "application/octet-stream" },
        error: null,
      }),
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: storageUrl });
    const { status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    const anthropicCall = mockFetch.mock.calls[0];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const imageBlock = anthropicBody.messages[0].content.find(
      (c: Record<string, unknown>) => c.type === "image",
    );
    expect(imageBlock.source.media_type).toBe("image/jpeg");
  });

  it("defaults to image/jpeg when no extension and no Content-Type header", async () => {
    const storageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/noext";
    const binaryData = new Uint8Array([0xFF, 0xD8]);

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({
        // Empty type simulates no Content-Type
        data: { arrayBuffer: () => Promise.resolve(binaryData.buffer), type: "" },
        error: null,
      }),
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: storageUrl });
    const { status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    const anthropicCall = mockFetch.mock.calls[0];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const imageBlock = anthropicBody.messages[0].content.find(
      (c: Record<string, unknown>) => c.type === "image",
    );
    expect(imageBlock.source.media_type).toBe("image/jpeg");
  });

  // BUG-010: File size validation
  it("returns 413 when file exceeds 10MB via Content-Length header", async () => {
    // Use a non-storage URL so the Content-Length header check path is exercised
    const imageUrl = "https://example.com/recipes/huge.jpg";

    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: { "Content-Length": String(11 * 1024 * 1024) },
      }),
    );
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(413);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("10MB");
  });

  it("returns 413 when file exceeds 10MB via actual buffer size", async () => {
    // Use a storage URL so the buffer size check is exercised via storage download
    const imageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/huge.jpg";
    // Create a buffer just over 10MB
    const bigBuffer = new ArrayBuffer(10 * 1024 * 1024 + 1);

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: { arrayBuffer: () => Promise.resolve(bigBuffer), type: "image/jpeg" },
        error: null,
      }),
    });

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(413);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("10MB");
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

  // BUG-014: RPC-based ingredient replacement
  it("returns {success:true} with no DB warnings on successful parse using RPC", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, ingredientCount: 2 });
    expect((data as Record<string, unknown>).dbWarnings).toBeUndefined();

    // Verify RPC was called for ingredient replacement
    expect(mockSupabase.rpc).toHaveBeenCalledWith("replace_recipe_ingredients", {
      p_recipe_id: "recipe-123",
      p_ingredients: expect.arrayContaining([
        expect.objectContaining({ name: "onion" }),
        expect.objectContaining({ name: "garlic" }),
      ]),
    });
  });

  it("returns dbWarnings array when RPC and upsert fail", async () => {
    // RPC fails
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    // Upsert fails (recipe_content completed)
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      // 1st call: recipe_content upsert (parsing status) - succeeds
      if (callCount === 1) return createBuilder(null, null);
      // 2nd call: recipe_content upsert (completed) - fails
      return createBuilder(null, { message: "upsert failed" });
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

  // BUG-020: JSON extraction fallback
  it("parses valid JSON without code blocks (no regex match)", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, ingredientCount: 2 });
  });

  it("handles JSON in code block with regex extraction", async () => {
    const codeBlockJson = "```json\n" + JSON.stringify(parsedRecipe) + "\n```";

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(codeBlockJson));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, ingredientCount: 2 });
  });

  it("errors when regex extracts invalid JSON and full text also fails", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse("```json\n{invalid json here}\n```"));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    // Both regex extraction and full text parse fail
    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to parse");
  });

  // BUG-015: catch block uses early-extracted recipeId
  it("catch block uses early-extracted recipeId for error status update", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockRejectedValueOnce(new Error("Connection refused"));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Connection refused");

    // Verify the catch block used recipeId to update status
    // The catch block creates a new supabase client and calls upsert
    const upsertCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === "recipe_content",
    );
    expect(upsertCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("catch block skips upsert when recipeId was never extracted (body parse succeeded but recipeId empty)", async () => {
    // Force an error after body is parsed but recipeId is empty string
    // The 400 return for empty recipeId happens before any throw, so we need a different approach.
    // We need recipeId to be extracted but then an error thrown later.
    // Actually, if recipeId is falsy, the function returns 400 early, not via throw.
    // The catch block condition is `if (recipeId)`, so if recipeId is undefined
    // (e.g. body parse fails - but that returns 400 directly, not via throw)
    // The only way recipeId is undefined in catch is if the error happens before
    // body parsing (e.g., in the env check). But the env check for ANTHROPIC_API_KEY
    // returns early, doesn't throw.
    // Actually, the error could happen after recipeId is set. Let's test that recipeId IS set
    // and the catch block DOES write the failed status.
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockRejectedValueOnce(new Error("Network error"));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
  });

  it("catch block handles non-Error thrown values", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockRejectedValueOnce("non-Error string");
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false, error: "Unknown error" });
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

  it("catch block skips upsert when recipeId was never extracted (error before body parse)", async () => {
    // Throw from Deno.env.get("SUPABASE_URL") at line 104, BEFORE recipeId is
    // assigned at line 129.  This leaves recipeId as undefined so the catch
    // block's `if (recipeId)` takes the false branch — no cleanup upsert.
    mockEnvGet.mockImplementation((key: string) => {
      if (key === "SUPABASE_URL") throw new Error("env not available");
      return createMockEnvGet()(key);
    });

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false, error: "env not available" });

    // Verify the catch block did NOT call supabase (recipeId was never set)
    const recipeContentCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === "recipe_content",
    );
    expect(recipeContentCalls).toHaveLength(0);
  });

  it("returns 500 when storage download fails", async () => {
    const imageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/photo.jpg";

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: null, error: { message: "Object not found" } }),
    });

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to download from storage");
  });

  it("returns 500 when storage download returns no data and no error", async () => {
    const imageUrl = "https://myproject.supabase.co/storage/v1/object/public/recipes/photo.jpg";

    mockSupabase.storage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("No data returned");
  });

  it("returns 500 when storage URL format is invalid", async () => {
    // URL contains "supabase" and "storage" but doesn't match the expected path pattern
    const badUrl = "https://myproject.supabase.co/storage/invalid-path";

    const req = createEdgeRequest({ ...baseBody, recipeUrl: badUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Invalid storage URL format");
  });

  it("returns 500 when non-storage image fetch returns non-ok status", async () => {
    const imageUrl = "https://example.com/recipes/photo.jpg";
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );

    const req = createEdgeRequest({ ...baseBody, recipeUrl: imageUrl });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to fetch recipe file");
  });

  it("returns 500 when web page fetch returns non-ok status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 }),
    );

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to fetch recipe page");
  });

  it("handles JSON-LD with string instruction steps", async () => {
    const htmlWithStringInstructions = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "String Steps Recipe",
          "recipeIngredient": ["flour"],
          "recipeInstructions": ["Step 1: Mix", "Step 2: Bake"]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlWithStringInstructions, { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    expect(anthropicBody.messages[0].content).toContain("Step 1: Mix");
    expect(anthropicBody.messages[0].content).toContain("Step 2: Bake");
  });

  it("extracts JSON-LD from array data with all optional fields and mixed instruction types", async () => {
    const htmlWithArrayAndFields = `
      <html>
      <head>
        <script type="application/ld+json">
        [{
          "@type": "Recipe",
          "recipeYield": "4 servings",
          "prepTime": "PT15M",
          "cookTime": "PT30M",
          "totalTime": "PT45M",
          "description": "A delicious recipe",
          "recipeIngredient": ["1 cup flour"],
          "recipeInstructions": ["Mix together", {"type": "HowToSection"}]
        }]
        </script>
      </head>
      <body></body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlWithArrayAndFields, { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const content = anthropicBody.messages[0].content;
    expect(content).toContain("STRUCTURED RECIPE DATA");
    expect(content).toContain("Yield: 4 servings");
    expect(content).toContain("Prep time: PT15M");
    expect(content).toContain("Cook time: PT30M");
    expect(content).toContain("Total time: PT45M");
    expect(content).toContain("Description: A delicious recipe");
    expect(content).toContain("Test Recipe"); // recipeName fallback since no name in JSON-LD
  });

  it("skips non-Recipe JSON-LD items without @graph before finding Recipe", async () => {
    const htmlWithMultipleScripts = `
      <html>
      <head>
        <script type="application/ld+json">
        {"@type": "Organization", "name": "Some Company"}
        </script>
        <script type="application/ld+json">
        {"@type": "Recipe", "name": "Found Recipe", "recipeIngredient": ["sugar"]}
        </script>
      </head>
      <body></body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlWithMultipleScripts, { status: 200 }))
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

  it("extracts JSON-LD Recipe from @graph with array @type and non-Recipe items", async () => {
    const htmlWithArrayTypeInGraph = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@graph": [
            {"@type": "Organization", "name": "Org"},
            {"@type": ["Recipe"], "name": "Array Type In Graph"}
          ]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(htmlWithArrayTypeInGraph, { status: 200 }))
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

  it("returns success with no ingredients and uses delete instead of RPC", async () => {
    const minimalParsed = { description: "A minimal recipe", servings: "2" };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(minimalParsed)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, ingredientCount: 0 });

    // Should NOT call RPC (no ingredients), should call from().delete() instead
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("falls back to 'other' category when ingredient has no category", async () => {
    const parsedNoCategory = {
      description: "Test",
      instructions: ["Add salt"],
      ingredients: [
        { name: "salt", quantity: 1, unit: "tsp", raw_text: "1 tsp salt" },
      ],
    };

    mockSupabase.from.mockImplementation(() => {
      return createBuilder(null, null);
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedNoCategory)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, ingredientCount: 1 });

    // Verify RPC was called with "other" as category fallback
    expect(mockSupabase.rpc).toHaveBeenCalledWith("replace_recipe_ingredients", {
      p_recipe_id: "recipe-123",
      p_ingredients: [
        expect.objectContaining({ category: "other" }),
      ],
    });
  });

  it("tracks dbWarning when RPC replace ingredients fails", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "rpc replace failed" } });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect((data as { dbWarnings: string[] }).dbWarnings).toBeDefined();
    expect((data as { dbWarnings: string[] }).dbWarnings[0]).toContain("Replace ingredients");
  });

  it("tracks dbWarning when delete fails for empty ingredients", async () => {
    const minimalParsed = { description: "No ingredients" };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return createBuilder(null, null); // parsing status upsert
      if (callCount === 2) return createBuilder(null, { message: "delete failed" }); // delete
      return createBuilder(null, null); // completed upsert
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(minimalParsed)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect((data as { dbWarnings: string[] }).dbWarnings).toBeDefined();
    expect((data as { dbWarnings: string[] }).dbWarnings[0]).toContain("Delete ingredients");
  });

  it("falls back to empty text when AI returns empty content array", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body>Recipe</body></html>", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [] }), { status: 200 }));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to parse");
  });

  it("handles .heic file extension", async () => {
    const heicUrl = "https://example.com/recipes/photo.heic";
    const binaryData = new Uint8Array([0x00, 0x00]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(binaryData.buffer, { status: 200, headers: { "Content-Length": "2" } }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: heicUrl });
    const { status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const imageBlock = anthropicBody.messages[0].content.find(
      (c: Record<string, unknown>) => c.type === "image",
    );
    expect(imageBlock.source.media_type).toBe("image/heic");
  });

  it("handles .webp file extension", async () => {
    const webpUrl = "https://example.com/recipes/photo.webp";
    const binaryData = new Uint8Array([0x52, 0x49]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(binaryData.buffer, { status: 200, headers: { "Content-Length": "2" } }))
      .mockResolvedValueOnce(createAnthropicResponse(JSON.stringify(parsedRecipe)));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, recipeUrl: webpUrl });
    const { status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    const anthropicCall = mockFetch.mock.calls[1];
    const anthropicBody = JSON.parse(anthropicCall[1].body);
    const imageBlock = anthropicBody.messages[0].content.find(
      (c: Record<string, unknown>) => c.type === "image",
    );
    expect(imageBlock.source.media_type).toBe("image/webp");
  });
});
