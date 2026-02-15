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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: mockEnvGet } };
  mockServe.mockImplementation((fn: (req: Request) => Promise<Response>) => {
    handler = fn;
  });
  await import("@edge/generate-cook-plan/index.ts");
}

const sampleRecipes = [
  {
    name: "Pasta",
    instructions: ["Boil water", "Cook pasta"],
    prepTime: "5 minutes",
    cookTime: "10 minutes",
    ingredients: ["pasta", "salt"],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("generate-cook-plan edge function", () => {
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

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns {success:true, skipped:true} when ANTHROPIC_API_KEY is missing", async () => {
    mockEnvGet.mockImplementation(
      createMockEnvGet({ ANTHROPIC_API_KEY: undefined }).getMockImplementation()!,
    );
    await loadHandler();

    const req = createEdgeRequest({ recipes: sampleRecipes });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, skipped: true });
  });

  it("returns 400 with 'No recipes provided' when recipes is empty", async () => {
    const req = createEdgeRequest({ recipes: [] });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(400);
    expect(data).toMatchObject({ success: false, error: "No recipes provided" });
  });

  it("returns 400 with 'No recipes provided' when recipes is null", async () => {
    const req = createEdgeRequest({ recipes: null });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(400);
    expect(data).toMatchObject({ success: false, error: "No recipes provided" });
  });

  it("returns {success:true, plan:{...}} from a successful AI response", async () => {
    const aiPlan = {
      totalTime: "30 minutes",
      steps: [
        { time: "0:00", action: "Boil water", recipe: "Pasta", equipment: "burner 1", duration: "10 minutes" },
      ],
      tips: ["Salt the water generously"],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse(JSON.stringify(aiPlan)),
    );

    const req = createEdgeRequest({ recipes: sampleRecipes });
    const { data } = await parseResponse(await handler(req));

    expect(data).toEqual({ success: true, plan: aiPlan });
  });

  it("returns 500 when AI API responds with non-ok status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse("service unavailable", false),
    );

    const req = createEdgeRequest({ recipes: sampleRecipes });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("AI API error");
  });

  it("returns 500 when AI returns unparseable JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createAnthropicResponse("Here's your cooking plan: it's great!"),
    );

    const req = createEdgeRequest({ recipes: sampleRecipes });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to parse");
  });
});
